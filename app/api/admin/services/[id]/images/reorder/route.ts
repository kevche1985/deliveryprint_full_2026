import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRoleWithProfile } from "@/lib/rbac"

export const dynamic = "force-dynamic"

async function resolveTenantId(activeTenantId: string | null) {
  if (activeTenantId) return activeTenantId
  const { data } = await supabaseServer.from("tenants").select("id").eq("slug", "primary").single()
  return (data as any)?.id ?? null
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const auth = await requireRoleWithProfile(request, ["admin", "operator"])
    if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

    const serviceId = context.params.id
    const tenantId = await resolveTenantId((auth as any).activeTenantId ?? null)
    if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 400 })

    const body = await request.json().catch(() => null)
    const orderedIds = Array.isArray(body?.orderedIds) ? (body.orderedIds as any[]).map((x) => String(x)) : []
    if (orderedIds.length === 0) return NextResponse.json({ error: "orderedIds required." }, { status: 400 })

    const { data: rows, error } = await supabaseServer
      .from("service_images")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const existingIds = new Set((rows || []).map((r: any) => String(r.id)))
    for (const id of orderedIds) {
      if (!existingIds.has(id)) return NextResponse.json({ error: "Invalid image id in orderedIds." }, { status: 400 })
    }

    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i]
      const { error: updateError } = await supabaseServer
        .from("service_images")
        .update({ sort_order: i, is_primary: i === 0 })
        .eq("tenant_id", tenantId)
        .eq("service_id", serviceId)
        .eq("id", id)
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error." }, { status: 500 })
  }
}

