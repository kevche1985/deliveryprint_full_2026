import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRoleWithProfile } from "@/lib/rbac"
import { defaultMainBannerConfig, mergeTenantBrandingConfig, normalizeMainBannerConfig } from "@/lib/branding"

export const runtime = "nodejs"

async function getTenantId(activeTenantId: string | null) {
  if (activeTenantId) return activeTenantId
  const { data, error } = await supabaseServer
    .from("tenants")
    .select("id")
    .eq("slug", "primary")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data?.id) return data.id as string
  throw new Error("No active tenant")
}

export async function POST(request: Request) {
  const auth = await requireRoleWithProfile(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

  try {
    const tenantId = await getTenantId((auth as any).activeTenantId)

    const { data: publishedRow, error: pubErr } = await supabaseServer
      .from("tenant_branding")
      .select("id, config")
      .eq("tenant_id", tenantId)
      .eq("state", "published")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (pubErr) return NextResponse.json({ error: pubErr.message }, { status: 500 })

    const hero = normalizeMainBannerConfig(publishedRow?.config?.banners?.hero || defaultMainBannerConfig)

    const { data: draftRow, error: draftErr } = await supabaseServer
      .from("tenant_branding")
      .select("id, config, updated_at")
      .eq("tenant_id", tenantId)
      .eq("state", "draft")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (draftErr) return NextResponse.json({ error: draftErr.message }, { status: 500 })

    const nextConfig = mergeTenantBrandingConfig(draftRow?.config || {}, hero)

    if (draftRow?.id) {
      const { data, error } = await supabaseServer
        .from("tenant_branding")
        .update({ config: nextConfig })
        .eq("id", draftRow.id)
        .select("updated_at, config")
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ draft: normalizeMainBannerConfig((data as any)?.config?.banners?.hero), updatedAt: (data as any)?.updated_at })
    }

    const { data, error } = await supabaseServer
      .from("tenant_branding")
      .insert([
        {
          tenant_id: tenantId,
          state: "draft",
          version_number: 1,
          config: nextConfig,
        },
      ])
      .select("updated_at, config")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ draft: normalizeMainBannerConfig((data as any)?.config?.banners?.hero), updatedAt: (data as any)?.updated_at })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to revert" }, { status: 500 })
  }
}

