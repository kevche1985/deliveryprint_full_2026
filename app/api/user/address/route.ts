import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

async function getUserId(request: Request) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization")
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null
  const token = auth.slice(7)
  const { data } = await supabaseServer.auth.getUser(token)
  return data?.user?.id || null
}

export async function GET(request: Request) {
  const userId = await getUserId(request)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data, error } = await supabaseServer.from("user_profiles").select("address, phone").eq("id", userId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ address: data?.address || null, phone: data?.phone || null })
}

export async function PUT(request: Request) {
  const userId = await getUserId(request)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json()
  const address = body?.address || null
  const phone = body?.phone || null
  const { error } = await supabaseServer.from("user_profiles").update({ address, phone }).eq("id", userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

