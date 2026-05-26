import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

type CartItem = { productId?: string | null; categoryId?: string | null; quantity: number; unitPrice: number }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const codeRaw: string = (body?.code || "").toString()
    const cart = body?.cart || {}
    const items: CartItem[] = Array.isArray(cart.items) ? cart.items : []
    const subtotal: number = Number(cart.subtotal || 0)
    const userId: string | null = body?.userId || null

    const code = codeRaw.trim().toLowerCase()
    if (!code) return NextResponse.json({ error: "This coupon code is invalid." }, { status: 400 })

    const supabase = supabaseServer

    const { data: foundCoupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code)
      .maybeSingle()

    let coupon = foundCoupon
    if (!coupon) {
      const { data: cc } = await supabase
        .from("coupon_codes")
        .select("code,coupon_id,status")
        .eq("code", code)
        .maybeSingle()
      if (!cc) return NextResponse.json({ error: "This coupon code is invalid." }, { status: 404 })
      const { data: parent } = await supabase.from("coupons").select("*").eq("id", cc.coupon_id).maybeSingle()
      coupon = parent || null
      if (!coupon) return NextResponse.json({ error: "This coupon code is invalid." }, { status: 404 })
      if (cc.status !== "pending") return NextResponse.json({ error: "This coupon has reached its usage limit." }, { status: 400 })
    }

    const now = new Date().toISOString()
    if (coupon.status !== "enabled") return NextResponse.json({ error: "This coupon is currently inactive." }, { status: 400 })
    if (coupon.start_at && coupon.start_at > now) return NextResponse.json({ error: "This coupon is currently inactive." }, { status: 400 })
    if (coupon.end_at && coupon.end_at < now) return NextResponse.json({ error: "This coupon has expired." }, { status: 400 })

    if (coupon.min_amount && Number(coupon.min_amount) > subtotal) {
      const diff = Number(coupon.min_amount) - subtotal
      return NextResponse.json({ error: `Add $${diff.toFixed(2)} more to your cart to use this coupon.` }, { status: 400 })
    }

    const totalQty = items.reduce((s, i) => s + Number(i.quantity || 0), 0)
    if (coupon.min_qty && totalQty < Number(coupon.min_qty)) {
      const diff = Number(coupon.min_qty) - totalQty
      return NextResponse.json({ error: `Add ${diff} more items to use this coupon.` }, { status: 400 })
    }

    let discount = 0
    const cap = coupon.max_discount_cap ? Number(coupon.max_discount_cap) : null

    const type = coupon.discount_type as string
    if (type === "order_fixed") {
      discount = Math.min(Number(coupon.amount || 0), subtotal)
    } else if (type === "order_percent") {
      const pct = Math.max(0, Math.min(100, Number(coupon.amount || 0)))
      discount = (subtotal * pct) / 100
    } else if (type === "product_fixed" || type === "product_percent") {
      const eligibleProductIds: string[] = coupon.eligible_product_ids || []
      const eligibleCategoryIds: string[] = coupon.eligible_category_ids || []
      const eligibleItems = items.filter((it) => {
        const pid = it.productId || null
        const cid = it.categoryId || null
        const matchPid = pid && eligibleProductIds.includes(pid)
        const matchCid = cid && eligibleCategoryIds.includes(cid)
        return !eligibleProductIds?.length && !eligibleCategoryIds?.length ? true : (matchPid || matchCid)
      })
      if (!eligibleItems.length) return NextResponse.json({ error: "This coupon is not applicable to your cart." }, { status: 400 })
      if (type === "product_fixed") {
        for (const it of eligibleItems) discount += Math.min(Number(coupon.amount || 0) * Number(it.quantity || 0), Number(it.unitPrice || 0) * Number(it.quantity || 0))
      } else {
        const pct = Math.max(0, Math.min(100, Number(coupon.amount || 0)))
        for (const it of eligibleItems) discount += (Number(it.unitPrice || 0) * Number(it.quantity || 0) * pct) / 100
      }
    } else {
      return NextResponse.json({ error: "Unsupported discount type." }, { status: 400 })
    }

    if (cap !== null) discount = Math.min(discount, cap)
    if (discount <= 0) return NextResponse.json({ error: "This coupon is not applicable to your cart." }, { status: 400 })

    const freeShipping = !!coupon.free_shipping

    return NextResponse.json({ ok: true, discount: Number(discount.toFixed(2)), freeShipping })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to apply coupon" }, { status: 500 })
  }
}

