import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRole } from "@/lib/rbac"

export async function GET(request: Request) {
  const auth = await requireRole(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })
  const supabase = supabaseServer
  const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })
  const supabase = supabaseServer
  const body = await request.json()
  const payload: any = {
    code: (body.code || "").toString().trim().toLowerCase(),
    code_type: body.code_type || "standard",
    description: body.description || "",
    status: body.status || "enabled",
    discount_type: body.discount_type,
    amount: body.amount ?? 0,
    start_at: body.start_at || new Date().toISOString(),
    end_at: body.end_at || null,
    free_shipping: !!body.free_shipping,
    min_amount: body.min_amount ?? 0,
    min_qty: body.min_qty ?? 0,
    max_discount_cap: body.max_discount_cap ?? null,
    usage_limit_total: body.usage_limit_total ?? null,
    usage_limit_per_customer: body.usage_limit_per_customer ?? null,
    eligible_product_ids: body.eligible_product_ids || null,
    eligible_category_ids: body.eligible_category_ids || null,
    eligible_group_ids: body.eligible_group_ids || null,
    eligible_emails: body.eligible_emails || null,
    new_customers_only: !!body.new_customers_only,
  }
  const { data, error } = await supabase.from("coupons").insert([payload]).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}

