import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET() {
  try {
    const sb = supabaseServer
    // Fetch highest priority active banner
    const { data: banners, error } = await sb
      .from("coupon_banners")
      .select("*")
      .eq("status", "enabled")
      .order("priority", { ascending: false })
      .limit(1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const banner = banners?.[0]
    if (!banner) return NextResponse.json({})

    // Validate linked coupon still active
    const { data: coupon, error: cerr } = await sb
      .from("coupons")
      .select("id, code, status, start_at, end_at")
      .eq("id", banner.coupon_id)
      .maybeSingle()
    if (cerr) return NextResponse.json({})
    if (!coupon || coupon.status !== "enabled") return NextResponse.json({})
    const now = new Date().toISOString()
    if ((coupon.start_at && coupon.start_at > now) || (coupon.end_at && coupon.end_at < now)) {
      return NextResponse.json({})
    }

    return NextResponse.json({
      id: banner.id,
      headline: banner.headline,
      supporting_text: banner.supporting_text,
      cta_label: banner.cta_label,
      cta_url: banner.cta_url,
      bg_type: banner.bg_type,
      bg_value: banner.bg_value,
      text_color: banner.text_color,
      position: banner.position,
      updated_at: banner.updated_at,
      code: coupon.code,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load banner" }, { status: 500 })
  }
}
