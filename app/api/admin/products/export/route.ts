import { NextResponse } from "next/server"
import { stringify } from "csv-stringify/sync"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRole } from "@/lib/rbac"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ["admin", "operator"])
    if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })
    const supabase = supabaseServer

    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get("ids")

    let query = supabase.from("products").select("*").order("created_at", { ascending: false })

    if (idsParam) {
      const productIds = idsParam.split(",")
      query = query.in("id", productIds)
    }

    const { data: products, error } = await query

    if (error) {
      console.error("Error fetching products for export:", error)
      return NextResponse.json({ error: "Failed to fetch products for export." }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return NextResponse.json({ error: "No products found to export." }, { status: 404 })
    }

    const productIds = products.map((p: any) => p.id)
    const { data: groups, error: groupsError } = await supabase
      .from("product_variant_groups")
      .select("id, product_id, name, display, sort_order")
      .in("product_id", productIds)
      .order("sort_order", { ascending: true, nullsFirst: true })

    if (groupsError) {
      return NextResponse.json({ error: "Failed to fetch variant groups for export." }, { status: 500 })
    }

    const groupIds = (groups || []).map((g: any) => g.id)
    const { data: options, error: optionsError } =
      groupIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from("product_variant_options")
            .select("group_id, label, price_modifier, is_available, sort_order")
            .in("group_id", groupIds)
            .order("sort_order", { ascending: true, nullsFirst: true })

    if (optionsError) {
      return NextResponse.json({ error: "Failed to fetch variant options for export." }, { status: 500 })
    }

    const optionsByGroupId = new Map<string, any[]>()
    for (const opt of options || []) {
      const gid = (opt as any).group_id as string
      const list = optionsByGroupId.get(gid) || []
      list.push({
        label: (opt as any).label,
        price_modifier: (opt as any).price_modifier,
        is_available: (opt as any).is_available,
        sort_order: (opt as any).sort_order,
      })
      optionsByGroupId.set(gid, list)
    }

    const groupsByProductId = new Map<string, any[]>()
    for (const g of groups || []) {
      const pid = (g as any).product_id as string
      const list = groupsByProductId.get(pid) || []
      list.push({
        name: (g as any).name,
        display: (g as any).display,
        sort_order: (g as any).sort_order,
        options: optionsByGroupId.get((g as any).id as string) || [],
      })
      groupsByProductId.set(pid, list)
    }

    const exportRows = products.map((p: any) => ({
      ...p,
      variants: JSON.stringify(groupsByProductId.get(p.id) || []),
    }))

    // Define columns for CSV, ensuring all relevant fields are included
    const columns = [
      { key: "id", header: "id" },
      { key: "name", header: "name" },
      { key: "description", header: "description" },
      { key: "price", header: "price" },
      { key: "category", header: "category" },
      { key: "image", header: "image" },
      { key: "is_active", header: "is_active" },
      { key: "is_featured", header: "is_featured" },
      { key: "variants", header: "variants" },
      { key: "created_at", header: "created_at" },
      { key: "updated_at", header: "updated_at" },
    ]

    const csvString = stringify(exportRows, {
      header: true,
      columns: columns,
    })

    return new NextResponse(csvString, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="products_export_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error: any) {
    console.error("API Error during product export:", error)
    return NextResponse.json({ error: error.message || "Internal server error during export." }, { status: 500 })
  }
}
