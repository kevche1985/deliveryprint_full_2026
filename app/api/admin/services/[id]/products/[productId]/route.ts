import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRoleWithProfile } from "@/lib/rbac"

export const dynamic = "force-dynamic"

async function resolveTenantId(activeTenantId: string | null) {
  if (activeTenantId) return activeTenantId
  const { data } = await supabaseServer.from("tenants").select("id").eq("slug", "primary").single()
  return (data as any)?.id ?? null
}

function shouldDeleteStorageObject(storagePath: string) {
  const p = storagePath.trim()
  if (!p) return false
  if (p.startsWith("http://") || p.startsWith("https://")) return false
  return true
}

export async function PATCH(request: Request, context: { params: { id: string; productId: string } }) {
  try {
    const auth = await requireRoleWithProfile(request, ["admin", "operator"])
    if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

    const tenantId = await resolveTenantId((auth as any).activeTenantId ?? null)
    if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 400 })

    const serviceId = context.params.id
    const productId = context.params.productId

    const body = await request.json().catch(() => null)
    const patch: any = {}

    if (body?.name != null) {
      const name = String(body.name).trim()
      if (!name) return NextResponse.json({ error: "Name required." }, { status: 400 })
      patch.name = name
    }
    if (body?.description !== undefined) patch.description = body.description != null ? String(body.description) : null
    if (body?.basePrice !== undefined) patch.base_price = Number.isFinite(Number(body.basePrice)) ? Number(body.basePrice) : 0
    if (body?.isActive !== undefined) patch.is_active = Boolean(body.isActive)
    if (body?.config !== undefined) patch.config = body.config != null ? body.config : null

    const { data, error } = await supabaseServer
      .from("service_products")
      .update(patch)
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)
      .eq("id", productId)
      .select("*")
      .single()

    if (error || !data) return NextResponse.json({ error: error?.message || "Failed to update product." }, { status: 500 })

    return NextResponse.json({ product: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error." }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: { params: { id: string; productId: string } }) {
  try {
    const auth = await requireRoleWithProfile(request, ["admin", "operator"])
    if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

    const tenantId = await resolveTenantId((auth as any).activeTenantId ?? null)
    if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 400 })

    const serviceId = context.params.id
    const productId = context.params.productId

    const { data: images, error: imagesError } = await supabaseServer
      .from("service_product_images")
      .select("storage_path")
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)
      .eq("product_id", productId)

    if (imagesError) return NextResponse.json({ error: imagesError.message }, { status: 500 })

    const paths = (images || [])
      .map((r: any) => String(r.storage_path ?? ""))
      .filter((p) => shouldDeleteStorageObject(p))

    if (paths.length > 0) {
      const { error: removeError } = await supabaseServer.storage.from("product-images").remove(paths)
      if (removeError) return NextResponse.json({ error: removeError.message }, { status: 500 })
    }

    const { error: deleteRowError } = await supabaseServer
      .from("service_products")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)
      .eq("id", productId)

    if (deleteRowError) return NextResponse.json({ error: deleteRowError.message }, { status: 500 })

    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error." }, { status: 500 })
  }
}
