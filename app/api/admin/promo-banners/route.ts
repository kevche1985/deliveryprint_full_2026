import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRole } from "@/lib/rbac"

export async function GET(request: Request) {
  const auth = await requireRole(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })
  const sb = supabaseServer
  const { data, error } = await sb
    .from("coupon_banners")
    .select("*, coupon:coupons(id, code, status)")
    .order("priority", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })
  const body = await request.json()
  const payload: any = {
    coupon_id: body.coupon_id,
    headline: body.headline,
    supporting_text: body.supporting_text || null,
    cta_label: body.cta_label || null,
    cta_url: body.cta_url || null,
    bg_type: body.bg_type || "color",
    bg_value: body.bg_value || null,
    text_color: body.text_color || null,
    position: body.position || "sticky",
    status: body.status || "disabled",
    start_at: body.start_at || null,
    end_at: body.end_at || null,
    priority: body.priority ?? 0,
  }
  const { data, error } = await supabaseServer.from("coupon_banners").insert([payload]).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}

