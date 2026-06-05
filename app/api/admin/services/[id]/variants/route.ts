import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRoleWithProfile } from "@/lib/rbac"

export const dynamic = "force-dynamic"

async function resolveTenantId(activeTenantId: string | null) {
  if (activeTenantId) return activeTenantId
  const { data } = await supabaseServer.from("tenants").select("id").eq("slug", "primary").single()
  return (data as any)?.id ?? null
}

export async function PUT(request: Request, context: { params: { id: string } }) {
  try {
    const auth = await requireRoleWithProfile(request, ["admin", "operator"])
    if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

    const serviceId = context.params.id
    const tenantId = await resolveTenantId((auth as any).activeTenantId ?? null)
    if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 400 })

    const body = await request.json().catch(() => null)
    const variants = Array.isArray(body?.variants) ? body.variants : []

    const { data, error } = await supabaseServer.rpc("admin_replace_service_variants", {
      p_tenant_id: tenantId,
      p_service_id: serviceId,
      p_variants: variants,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ variants: data ?? [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error." }, { status: 500 })
  }
}

