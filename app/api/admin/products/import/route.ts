import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRole } from "@/lib/rbac"

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ["admin", "operator"])
    if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })
    const supabase = supabaseServer

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const csvString = buffer.toString("utf-8")

    const records = parse(csvString, {
      columns: true, // Treat the first row as column headers
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, any>>

    let createdCount = 0
    let updatedCount = 0
    const errors: string[] = []

    const normalizeRecord = (record: Record<string, any>) => {
      const normalized: Record<string, any> = {}
      for (const [key, value] of Object.entries(record || {})) {
        const normalizedKey = String(key).trim().toLowerCase().replace(/\s+/g, "_")
        normalized[normalizedKey] = value
      }
      return normalized
    }

    const parseBool = (value: any, defaultValue: boolean) => {
      if (value === null || value === undefined || String(value).trim() === "") return defaultValue
      const s = String(value).trim().toLowerCase()
      if (s === "true" || s === "1" || s === "yes") return true
      if (s === "false" || s === "0" || s === "no") return false
      return defaultValue
    }

    for (const record of records) {
      try {
        const row = normalizeRecord(record)
        const { operation, id, name, description, price, category, image, is_active, is_featured, wholesale_tiers, variants } = row

        if (!name || !price) {
          errors.push(`Skipping row due to missing name or price: ${JSON.stringify(record)}`)
          continue
        }

        const productData: any = {
          name: String(name),
          description: description ? String(description) : null,
          price: Number.parseFloat(price),
          category: category ? String(category) : null,
          image: image ? String(image) : null,
          is_active: parseBool(is_active, true),
          is_featured: parseBool(is_featured, false),
        }

        if (isNaN(productData.price)) {
          errors.push(`Skipping row due to invalid price: ${JSON.stringify(record)}`)
          continue
        }

        if (wholesale_tiers !== null && wholesale_tiers !== undefined && String(wholesale_tiers).trim() !== "") {
          try {
            productData.wholesale_tiers = JSON.parse(String(wholesale_tiers))
          } catch (e: any) {
            errors.push(`Skipping wholesale_tiers due to invalid JSON: ${e?.message || "Invalid JSON"} - ${JSON.stringify(record)}`)
          }
        }

        let variantsPayload: any[] | null = null
        if (variants !== null && variants !== undefined && String(variants).trim() !== "") {
          try {
            const parsed = JSON.parse(String(variants))
            variantsPayload = Array.isArray(parsed) ? parsed : null
            if (!variantsPayload) {
              errors.push(`Skipping variants due to invalid JSON shape: ${JSON.stringify(record)}`)
            }
          } catch (e: any) {
            errors.push(`Skipping variants due to invalid JSON: ${e?.message || "Invalid JSON"} - ${JSON.stringify(record)}`)
          }
        }

        let productId: string | null = null
        const op = operation ? String(operation).trim().toLowerCase() : ""
        const isExplicitNew = op === "new" || op === "create" || op === "insert"
        const isExplicitUpdate = op === "update"

        if (isExplicitUpdate && !id) {
          errors.push(`Skipping row due to missing id for update operation: ${JSON.stringify(record)}`)
          continue
        }

        if (isExplicitNew) {
          const insertRow = id ? [{ ...productData, id: String(id) }] : [productData]
          const { data, error } = await supabase.from("products").insert(insertRow).select().single()
          if (error) {
            errors.push(`Failed to create product: ${error.message} - ${JSON.stringify(record)}`)
          } else {
            productId = data?.id || null
            createdCount++
          }
        } else if (isExplicitUpdate) {
          const { data, error } = await supabase.from("products").update(productData).eq("id", String(id)).select().single()
          if (error) {
            errors.push(`Failed to update product with ID ${String(id)}: ${error.message} - ${JSON.stringify(record)}`)
          } else {
            productId = data?.id || String(id)
            updatedCount++
          }
        } else if (id) {
          // Attempt to update existing product
          const { data, error } = await supabase.from("products").update(productData).eq("id", id).select().single()

          if (error) {
            if (error.code === "PGRST116") {
              // No rows found for update
              // If ID exists but no row found, it might be a new product with an ID, or an invalid ID.
              // For simplicity, we'll treat it as an insert if no row was updated.
              const { data: insertData, error: insertError } = await supabase
                .from("products")
                .insert([{ ...productData, id: id }]) // Try inserting with provided ID
                .select()
                .single()
              if (insertError) {
                errors.push(
                  `Failed to insert product with ID ${id}: ${insertError.message} - ${JSON.stringify(record)}`,
                )
              } else {
                productId = insertData?.id || String(id)
                createdCount++
              }
            } else {
              errors.push(`Failed to update product with ID ${id}: ${error.message} - ${JSON.stringify(record)}`)
            }
          } else {
            productId = data?.id || String(id)
            updatedCount++
          }
        } else {
          // Insert new product
          const { data, error } = await supabase.from("products").insert([productData]).select().single()
          if (error) {
            errors.push(`Failed to create product: ${error.message} - ${JSON.stringify(record)}`)
          } else {
            productId = data?.id || null
            createdCount++
          }
        }

        if (productId && variantsPayload && variantsPayload.length > 0) {
          const { data: existingGroups, error: existingGroupsError } = await supabase
            .from("product_variant_groups")
            .select("id")
            .eq("product_id", productId)

          if (existingGroupsError) {
            errors.push(`Failed loading existing variant groups: ${existingGroupsError.message} - ${JSON.stringify(record)}`)
          } else {
            const existingGroupIds = (existingGroups || []).map((g: any) => g.id)
            if (existingGroupIds.length > 0) {
              const { error: deleteOptionsError } = await supabase
                .from("product_variant_options")
                .delete()
                .in("group_id", existingGroupIds)
              if (deleteOptionsError) {
                errors.push(`Failed deleting existing variant options: ${deleteOptionsError.message} - ${JSON.stringify(record)}`)
              }
            }
            const { error: deleteGroupsError } = await supabase
              .from("product_variant_groups")
              .delete()
              .eq("product_id", productId)
            if (deleteGroupsError) {
              errors.push(`Failed deleting existing variant groups: ${deleteGroupsError.message} - ${JSON.stringify(record)}`)
            }

            for (const g of variantsPayload) {
              const groupName = g?.name
              if (!groupName) continue
              const display = g?.display ? String(g.display) : "dropdown"
              const sortOrder =
                g?.sort_order === null || g?.sort_order === undefined || String(g?.sort_order).trim() === ""
                  ? null
                  : Number.parseInt(String(g.sort_order), 10)
              const { data: insertedGroup, error: insertGroupError } = await supabase
                .from("product_variant_groups")
                .insert([
                  {
                    product_id: productId,
                    name: String(groupName),
                    display,
                    sort_order: Number.isFinite(sortOrder as any) ? sortOrder : null,
                  },
                ])
                .select("id")
                .single()
              if (insertGroupError || !insertedGroup?.id) {
                errors.push(
                  `Failed inserting variant group "${String(groupName)}": ${insertGroupError?.message || "Unknown error"} - ${JSON.stringify(record)}`,
                )
                continue
              }

              const options = Array.isArray(g?.options) ? g.options : []
              if (options.length === 0) continue
              const optionRows = options
                .filter((o: any) => o && (o.label || o.name))
                .map((o: any) => {
                  const label = o.label ?? o.name
                  const priceModifier =
                    o.price_modifier === null || o.price_modifier === undefined || String(o.price_modifier).trim() === ""
                      ? 0
                      : Number.parseFloat(String(o.price_modifier))
                  const isAvailable = parseBool(o.is_available, true)
                  const optionSortOrder =
                    o.sort_order === null || o.sort_order === undefined || String(o.sort_order).trim() === ""
                      ? null
                      : Number.parseInt(String(o.sort_order), 10)
                  const tierPricing = o.tier_pricing ?? o.tierPricing ?? null
                  return {
                    group_id: insertedGroup.id,
                    label: String(label),
                    price_modifier: Number.isFinite(priceModifier) ? priceModifier : 0,
                    tier_pricing: tierPricing,
                    is_available: isAvailable,
                    sort_order: Number.isFinite(optionSortOrder as any) ? optionSortOrder : null,
                  }
                })

              const { error: insertOptionsError } = await supabase.from("product_variant_options").insert(optionRows)
              if (insertOptionsError) {
                errors.push(
                  `Failed inserting variant options for group "${String(groupName)}": ${insertOptionsError.message} - ${JSON.stringify(record)}`,
                )
              }
            }
          }
        }
      } catch (rowError: any) {
        errors.push(`Error processing row ${JSON.stringify(record)}: ${rowError.message}`)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          message: "Import completed with errors.",
          created: createdCount,
          updated: updatedCount,
          errors: errors,
        },
        { status: 200 },
      )
    }

    return NextResponse.json({
      message: "Products imported successfully.",
      created: createdCount,
      updated: updatedCount,
    })
  } catch (error: any) {
    console.error("API Error during product import:", error)
    return NextResponse.json({ error: error.message || "Internal server error during import." }, { status: 500 })
  }
}
