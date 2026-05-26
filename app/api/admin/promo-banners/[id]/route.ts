import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRole } from "@/lib/rbac"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })
  const body = await request.json()
  const allowed = [
    "coupon_id",
    "headline",
    "supporting_text",
    "cta_label",
    "cta_url",
    "bg_type",
    "bg_value",
    "text_color",
    "position",
    "status",
    "start_at",
    "end_at",
    "priority",
  ] as const
  const payload: any = {}
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) payload[k] = body[k]
  }
  payload.updated_at = new Date().toISOString()
  const { data, error } = await supabaseServer.from("coupon_banners").update(payload).eq("id", params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })
  const { error } = await supabaseServer.from("coupon_banners").delete().eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
