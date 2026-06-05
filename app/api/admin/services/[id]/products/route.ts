import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRoleWithProfile } from "@/lib/rbac"

export const dynamic = "force-dynamic"

async function resolveTenantId(activeTenantId: string | null) {
  if (activeTenantId) return activeTenantId
  const { data } = await supabaseServer.from("tenants").select("id").eq("slug", "primary").single()
  return (data as any)?.id ?? null
}

export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const auth = await requireRoleWithProfile(request, ["admin", "operator"])
    if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

    const tenantId = await resolveTenantId((auth as any).activeTenantId ?? null)
    if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 400 })

    const serviceId = context.params.id

    const { data, error } = await supabaseServer
      .from("service_products")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)
      .order("sort_order", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ products: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error." }, { status: 500 })
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const auth = await requireRoleWithProfile(request, ["admin", "operator"])
    if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

    const tenantId = await resolveTenantId((auth as any).activeTenantId ?? null)
    if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 400 })

    const serviceId = context.params.id
    const body = await request.json().catch(() => null)

    const name = String(body?.name ?? "").trim()
    if (!name) return NextResponse.json({ error: "Name required." }, { status: 400 })

    const description = body?.description != null ? String(body.description) : null
    const basePrice = Number.isFinite(Number(body?.basePrice)) ? Number(body.basePrice) : 0
    const isActive = body?.isActive != null ? Boolean(body.isActive) : true
    const config = body?.config != null ? body.config : null

    const { data: maxRow } = await supabaseServer
      .from("service_products")
      .select("sort_order")
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextSort = typeof (maxRow as any)?.sort_order === "number" ? ((maxRow as any).sort_order as number) + 1 : 0

    const { data, error } = await supabaseServer
      .from("service_products")
      .insert([
        {
          tenant_id: tenantId,
          service_id: serviceId,
          name,
          description,
          base_price: basePrice,
          sort_order: nextSort,
          is_active: isActive,
          config,
        },
      ])
      .select("*")
      .single()

    if (error || !data) return NextResponse.json({ error: error?.message || "Failed to create product." }, { status: 500 })

    return NextResponse.json({ product: data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error." }, { status: 500 })
  }
}
