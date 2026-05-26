import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import crypto from "crypto"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 })
    }

    const auth = request.headers.get("authorization") || request.headers.get("Authorization")
    let userId: string | null = null
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice(7)
      const { data: userData } = await supabaseServer.auth.getUser(token)
      userId = userData?.user?.id || null
    }

    const form = await request.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })
    const fileType = (form.get("file_type") as string | null) || "design"
    const sessionId = (form.get("session_id") as string | null) || null

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const uploadId = crypto.randomUUID()
    const bucket = "order_files"
    const storagePrefix = sessionId ? `orders/pending/${sessionId}` : "uploads/temp"
    const storagePath = `${storagePrefix}/${uploadId}-${safeName}`

    const { error: upErr } = await supabaseServer.storage.from(bucket).upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    const { data: pub } = supabaseServer.storage.from(bucket).getPublicUrl(storagePath)
    const publicUrl = pub?.publicUrl || null
    if (!publicUrl) return NextResponse.json({ error: "Failed to generate public URL" }, { status: 500 })

    const { data: created, error: insErr } = await (supabaseServer as any)
      .from("order_files")
      .insert([
        {
          order_id: null,
          order_item_id: null,
          file_type: fileType,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
          uploaded_by: userId,
          is_print_ready: false,
          download_count: 0,
          storage_bucket: bucket,
          storage_path: storagePath,
          status: "temporary",
        },
      ])
      .select()
      .single()

    if (insErr || !created) return NextResponse.json({ error: insErr?.message || "Failed to create file record" }, { status: 500 })

    return NextResponse.json({
      success: true,
      orderFile: {
        id: created.id,
        name: file.name,
        bucket,
        path: storagePath,
        publicUrl,
        status: created.status || "temporary",
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
