import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRoleWithProfile } from "@/lib/rbac"

export const dynamic = "force-dynamic"

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

async function resolveTenantId(activeTenantId: string | null) {
  if (activeTenantId) return activeTenantId
  const { data } = await supabaseServer.from("tenants").select("id").eq("slug", "primary").single()
  return (data as any)?.id ?? null
}

function getExtension(file: File) {
  const byType = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : null
  if (byType) return byType
  const name = file.name || ""
  const parts = name.split(".")
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ""
  return ext || null
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const auth = await requireRoleWithProfile(request, ["admin", "operator"])
    if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

    const serviceId = context.params.id
    const tenantId = await resolveTenantId((auth as any).activeTenantId ?? null)
    if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 400 })

    const form = await request.formData()
    const file = form.get("file")
    if (!file || !(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 })

    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Unsupported file type." }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large." }, { status: 400 })

    const { count } = await supabaseServer
      .from("service_images")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)

    const existingCount = count ?? 0
    if (existingCount >= 10) return NextResponse.json({ error: "Maximum 10 images reached." }, { status: 400 })

    const ext = getExtension(file)
    if (!ext) return NextResponse.json({ error: "Unsupported file type." }, { status: 400 })

    const imageId = crypto.randomUUID()
    const storagePath = `services/${tenantId}/${serviceId}/${imageId}.${ext}`

    const { error: uploadError } = await supabaseServer.storage.from("product-images").upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

    const { data: publicUrlData } = supabaseServer.storage.from("product-images").getPublicUrl(storagePath)
    const url = publicUrlData?.publicUrl ?? ""
    if (!url) return NextResponse.json({ error: "Failed to create public URL." }, { status: 500 })

    const { data: maxRow } = await supabaseServer
      .from("service_images")
      .select("sort_order")
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextSort = typeof (maxRow as any)?.sort_order === "number" ? ((maxRow as any).sort_order as number) + 1 : 0
    const isPrimary = existingCount === 0

    const { data: inserted, error: insertError } = await supabaseServer
      .from("service_images")
      .insert([
        {
          id: imageId,
          tenant_id: tenantId,
          service_id: serviceId,
          storage_path: storagePath,
          url,
          alt_text: null,
          sort_order: nextSort,
          is_primary: isPrimary,
        },
      ])
      .select("*")
      .single()

    if (insertError || !inserted) return NextResponse.json({ error: insertError?.message || "Failed to insert image." }, { status: 500 })

    return NextResponse.json(
      {
        image: {
          id: inserted.id,
          serviceId: inserted.service_id,
          storagePath: inserted.storage_path,
          url: inserted.url,
          altText: inserted.alt_text ?? undefined,
          sortOrder: inserted.sort_order,
          isPrimary: inserted.is_primary,
        },
      },
      { status: 201 },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error." }, { status: 500 })
  }
}

