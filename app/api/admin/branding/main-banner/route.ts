import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRoleWithProfile } from "@/lib/rbac"
import { defaultMainBannerConfig, mergeTenantBrandingConfig, normalizeMainBannerConfig, validateMainBannerConfig } from "@/lib/branding"

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

async function loadLatestByState(tenantId: string, state: "draft" | "published") {
  const { data, error } = await supabaseServer
    .from("tenant_branding")
    .select("id, tenant_id, state, version_number, published_at, published_by, config, updated_at")
    .eq("tenant_id", tenantId)
    .eq("state", state)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function GET(request: Request) {
  const auth = await requireRoleWithProfile(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

  try {
    const tenantId = await getTenantId((auth as any).activeTenantId)
    const [draftRow, publishedRow] = await Promise.all([
      loadLatestByState(tenantId, "draft"),
      loadLatestByState(tenantId, "published"),
    ])

    const draftHero = normalizeMainBannerConfig(draftRow?.config?.banners?.hero || publishedRow?.config?.banners?.hero || defaultMainBannerConfig)
    const publishedHero = publishedRow?.config?.banners?.hero ? normalizeMainBannerConfig(publishedRow.config.banners.hero) : null

    return NextResponse.json({
      tenantId,
      draft: draftHero,
      published: publishedHero,
      meta: {
        draftUpdatedAt: draftRow?.updated_at || null,
        publishedAt: publishedRow?.published_at || null,
        publishedVersion: publishedRow?.version_number || null,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const auth = await requireRoleWithProfile(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

  try {
    const tenantId = await getTenantId((auth as any).activeTenantId)
    const body = await request.json().catch(() => null)
    const draft = normalizeMainBannerConfig(body?.draft)
    const errors = validateMainBannerConfig(draft).filter((x) => x !== "Banner image is required")
    if (errors.length) {
      return NextResponse.json({ error: "Invalid draft", details: errors }, { status: 400 })
    }

    const existingDraft = await loadLatestByState(tenantId, "draft")
    const nextConfig = mergeTenantBrandingConfig(existingDraft?.config || {}, draft)

    if (existingDraft?.id) {
      const { data, error } = await supabaseServer
        .from("tenant_branding")
        .update({ config: nextConfig })
        .eq("id", existingDraft.id)
        .select("id, updated_at, config")
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
      .select("id, updated_at, config")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ draft: normalizeMainBannerConfig((data as any)?.config?.banners?.hero), updatedAt: (data as any)?.updated_at })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to save draft" }, { status: 500 })
  }
}

