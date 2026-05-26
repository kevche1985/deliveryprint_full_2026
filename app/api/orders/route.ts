import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const auth = request.headers.get("authorization") || request.headers.get("Authorization")
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice(7)
      const { data: userData } = await supabaseServer.auth.getUser(token)
      const userId = userData?.user?.id
      if (userId) {
        body.user_id = userId
      }
    }

    // Insert order; auth-derived user_id (if available) overrides client body
    const { data, error } = await supabaseServer.from("orders").insert([body]).select().single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ order: data }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
