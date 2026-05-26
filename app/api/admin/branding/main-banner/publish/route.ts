import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRoleWithProfile } from "@/lib/rbac"
import { defaultMainBannerConfig, normalizeMainBannerConfig, validateMainBannerConfig } from "@/lib/branding"

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
    const userId = (auth as any).userId as string

    const { data: draftRow, error: draftErr } = await supabaseServer
      .from("tenant_branding")
      .select("id, config")
      .eq("tenant_id", tenantId)
      .eq("state", "draft")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (draftErr) return NextResponse.json({ error: draftErr.message }, { status: 500 })

    const hero = normalizeMainBannerConfig(draftRow?.config?.banners?.hero || defaultMainBannerConfig)
    const errors = validateMainBannerConfig(hero)
    if (errors.length) {
      return NextResponse.json({ error: "Invalid draft", details: errors }, { status: 400 })
    }

    const { data: currentPublished, error: pubErr } = await supabaseServer
      .from("tenant_branding")
      .select("id, version_number")
      .eq("tenant_id", tenantId)
      .eq("state", "published")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (pubErr) return NextResponse.json({ error: pubErr.message }, { status: 500 })

    const nextVersion = (currentPublished?.version_number || 0) + 1
    const now = new Date().toISOString()

    if (currentPublished?.id) {
      const { error: archiveErr } = await supabaseServer
        .from("tenant_branding")
        .update({ state: "archived" })
        .eq("id", currentPublished.id)
      if (archiveErr) return NextResponse.json({ error: archiveErr.message }, { status: 500 })
    }

    const config = draftRow?.config || { banners: { hero } }

    const { data: published, error: insErr } = await supabaseServer
      .from("tenant_branding")
      .insert([
        {
          tenant_id: tenantId,
          state: "published",
          version_number: nextVersion,
          published_at: now,
          published_by: userId,
          config,
        },
      ])
      .select("id, version_number, published_at, config")
      .single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    if (draftRow?.id) {
      await supabaseServer.from("tenant_branding").update({ config }).eq("id", draftRow.id)
    }

    const { data: archived, error: listErr } = await supabaseServer
      .from("tenant_branding")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("state", "archived")
      .order("version_number", { ascending: false })
    if (!listErr && (archived?.length || 0) > 10) {
      const toDelete = (archived || []).slice(10).map((r: any) => r.id)
      if (toDelete.length) {
        await supabaseServer.from("tenant_branding").delete().in("id", toDelete)
      }
    }

    return NextResponse.json({
      published: normalizeMainBannerConfig((published as any)?.config?.banners?.hero),
      version: (published as any)?.version_number,
      publishedAt: (published as any)?.published_at,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to publish" }, { status: 500 })
  }
}

