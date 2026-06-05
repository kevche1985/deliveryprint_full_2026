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

export async function PATCH(request: Request, context: { params: { id: string; imageId: string } }) {
  try {
    const auth = await requireRoleWithProfile(request, ["admin", "operator"])
    if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

    const serviceId = context.params.id
    const imageId = context.params.imageId
    const tenantId = await resolveTenantId((auth as any).activeTenantId ?? null)
    if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 400 })

    const body = await request.json().catch(() => null)
    const altText = body?.altText != null ? String(body.altText) : ""

    const { data: updated, error } = await supabaseServer
      .from("service_images")
      .update({ alt_text: altText.trim() ? altText.trim() : null })
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)
      .eq("id", imageId)
      .select("*")
      .single()

    if (error || !updated) return NextResponse.json({ error: error?.message || "Failed to update image." }, { status: 500 })

    return NextResponse.json({
      image: {
        id: updated.id,
        serviceId: updated.service_id,
        storagePath: updated.storage_path,
        url: updated.url,
        altText: updated.alt_text ?? undefined,
        sortOrder: updated.sort_order,
        isPrimary: updated.is_primary,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: { params: { id: string; imageId: string } }) {
  try {
    const auth = await requireRoleWithProfile(_request, ["admin", "operator"])
    if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

    const serviceId = context.params.id
    const imageId = context.params.imageId
    const tenantId = await resolveTenantId((auth as any).activeTenantId ?? null)
    if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 400 })

    const { data: row, error: fetchError } = await supabaseServer
      .from("service_images")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)
      .eq("id", imageId)
      .single()

    if (fetchError || !row) return NextResponse.json({ error: "Image not found." }, { status: 404 })

    if (shouldDeleteStorageObject(String(row.storage_path ?? ""))) {
      await supabaseServer.storage.from("product-images").remove([String(row.storage_path)])
    }

    const wasPrimary = !!row.is_primary
    const { error: deleteError } = await supabaseServer
      .from("service_images")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)
      .eq("id", imageId)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    if (wasPrimary) {
      const { data: nextRow } = await supabaseServer
        .from("service_images")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("service_id", serviceId)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle()

      if (nextRow?.id) {
        await supabaseServer
          .from("service_images")
          .update({ is_primary: true, sort_order: 0 })
          .eq("tenant_id", tenantId)
          .eq("service_id", serviceId)
          .eq("id", nextRow.id)
      }
    }

    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error." }, { status: 500 })
  }
}

