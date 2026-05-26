import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import crypto from "crypto"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const reference = crypto.randomUUID()

    const auth = request.headers.get("authorization") || request.headers.get("Authorization")
    let userId: string | null = body.user_id ?? null
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice(7)
      const { data: userData } = await supabaseServer.auth.getUser(token)
      userId = userData?.user?.id || userId
    }

    const cartItems = Array.isArray(body.cart_items) ? body.cart_items : []
    if (cartItems.length === 0) return NextResponse.json({ error: "Missing cart_items" }, { status: 400 })

    const payload: any = {
      reference,
      user_id: userId,
      email: body.email ?? null,
      cart_items: cartItems,
      shipping_address: body.shipping_address ?? {},
      billing_address: body.billing_address ?? {},
      subtotal: Number(body.subtotal ?? 0),
      tax: Number(body.tax ?? 0),
      shipping: Number(body.shipping ?? 0),
      total: Number(body.total ?? 0),
      payment_method: body.payment_method ?? "wompi",
      shipping_method: body.shipping_method ?? null,
      notes: body.notes ?? null,
      status: "pending",
    }

    const { data, error } = await (supabaseServer as any).from("checkout_sessions").insert([payload]).select().single()
    if (error || !data) return NextResponse.json({ error: error?.message || "Failed to create checkout session" }, { status: 500 })

    return NextResponse.json({ success: true, checkout_session: data }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
