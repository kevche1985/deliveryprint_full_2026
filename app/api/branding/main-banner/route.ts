import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { defaultMainBannerConfig, normalizeMainBannerConfig } from "@/lib/branding"

export const runtime = "nodejs"

async function getTenantIdBySlug(slug: string) {
  const s = slug.trim().toLowerCase()
  const { data, error } = await supabaseServer.from("tenants").select("id").eq("slug", s).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.id ? (data.id as string) : null
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const slug = url.searchParams.get("slug") || "primary"
    const tenantId = await getTenantIdBySlug(slug)
    if (!tenantId) return NextResponse.json({ banner: null })

    const { data, error } = await supabaseServer
      .from("tenant_branding")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("state", "published")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const hero = data?.config?.banners?.hero
    if (!hero) return NextResponse.json({ banner: null })
    return NextResponse.json({ banner: normalizeMainBannerConfig(hero || defaultMainBannerConfig) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load" }, { status: 500 })
  }
}

