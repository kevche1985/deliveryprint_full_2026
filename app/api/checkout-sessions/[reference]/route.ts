import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET(_request: Request, { params }: { params: { reference: string } }) {
  try {
    const reference = params.reference
    if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 })

    const { data, error } = await (supabaseServer as any)
      .from("checkout_sessions")
      .select("id, reference, status, order_id, created_at, updated_at")
      .eq("reference", reference)
      .single()

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ success: true, checkout_session: data }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
