import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET(request: Request) {
  try {
    const auth = request.headers.get("authorization") || request.headers.get("Authorization")
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) return NextResponse.json({ error: "Auth required" }, { status: 401 })
    const token = auth.slice(7)
    const { data: userData } = await supabaseServer.auth.getUser(token)
    const userId = userData?.user?.id
    const userEmail = userData?.user?.email || null
    if (!userId) return NextResponse.json({ error: "Invalid session" }, { status: 401 })

    const { data: ordersByUser } = await supabaseServer
      .from("orders")
      .select("id, order_number, status, total, created_at, payment_status, payment_method")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25)

    let merged = ordersByUser || []

    if (userEmail) {
      const { data: ordersByEmail } = await supabaseServer
        .from("orders")
        .select("id, order_number, status, total, created_at, payment_status, payment_method")
        .is("user_id", null)
        .eq("email", userEmail)
        .order("created_at", { ascending: false })
        .limit(25)

      if (ordersByEmail && ordersByEmail.length > 0) {
        try {
          await supabaseServer.from("orders").update({ user_id: userId }).is("user_id", null).eq("email", userEmail)
        } catch {}
        const seen = new Set<string>(merged.map((o: any) => o.id))
        for (const o of ordersByEmail) {
          if (!seen.has((o as any).id)) merged.push(o as any)
        }
      }

      const { data: ordersByBillingEmail } = await supabaseServer
        .from("orders")
        .select("id, order_number, status, total, created_at, payment_status, payment_method")
        .is("user_id", null)
        .is("email", null)
        .filter("billing_address->>email", "eq", userEmail)
        .order("created_at", { ascending: false })
        .limit(25)

      if (ordersByBillingEmail && ordersByBillingEmail.length > 0) {
        try {
          await supabaseServer
            .from("orders")
            .update({ user_id: userId, email: userEmail })
            .is("user_id", null)
            .is("email", null)
            .filter("billing_address->>email", "eq", userEmail)
        } catch {}
        const seen = new Set<string>(merged.map((o: any) => o.id))
        for (const o of ordersByBillingEmail) {
          if (!seen.has((o as any).id)) merged.push(o as any)
        }
      }
    }

    merged = merged
      .slice()
      .sort((a: any, b: any) => {
        const at = new Date(a.created_at).getTime()
        const bt = new Date(b.created_at).getTime()
        return bt - at
      })
      .slice(0, 25)

    const res = NextResponse.json({ orders: merged })
    res.headers.set("Cache-Control", "private, max-age=30")
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
