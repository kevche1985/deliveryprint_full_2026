import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })

    const supabase = supabaseServer

    await supabase.storage.createBucket("web", { public: true }).catch(() => {})

    const ext = file.name.split(".").pop() || "png"
    const path = `web-logo-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadErr } = await supabase.storage.from("web").upload(path, Buffer.from(arrayBuffer), {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/png",
    })
    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

    const { data: pub } = supabase.storage.from("web").getPublicUrl(path)
    const url = pub?.publicUrl
    if (!url) return NextResponse.json({ error: "Failed to generate public URL" }, { status: 500 })

    await supabase.from("system_customization").upsert([{ key: "logo_url", value: url }], { onConflict: "key" })

    return NextResponse.json({ url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

