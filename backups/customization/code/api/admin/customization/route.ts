import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

const KEYS = ["brand_name","logo_url","colors","fonts","contact","modules"] as const
type Key = typeof KEYS[number]

export async function GET() {
  const supabase = supabaseServer
  const { data, error } = await supabase.from("system_customization").select("key, value")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const result: Record<string, any> = {}
  for (const row of data || []) result[row.key] = row.value
  return NextResponse.json(result)
}

export async function PUT(request: Request) {
  const supabase = supabaseServer
  const body = await request.json()
  const rows = [] as Array<{ key: string; value: any }>
  for (const k of KEYS) {
    if (k in body) {
      let v = body[k]
      if (k === "colors" && v && typeof v === "object") {
        v = {
          primary: v.primary || "#8B0000",
          accent: v.accent || "#6B0000",
          background: v.background || "#ffffff",
          text: v.text || "#111827",
          link: v.link || v.primary || "#8B0000",
        }
      }
      if (v !== undefined && v !== null) rows.push({ key: k, value: v })
    }
  }
  if (rows.length === 0) return NextResponse.json({ ok: true })
  for (const r of rows) {
    await supabase.from("system_customization").delete().eq("key", r.key)
    const { error } = await supabase.from("system_customization").insert([{ key: r.key, value: r.value }])
    if (error) {
      const msg = error.message || JSON.stringify(error)
      return NextResponse.json({ error: `Failed to save '${r.key}': ${msg}`, details: error }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true })
}
