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
    let uploadedBy: string | null = null
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice(7)
      const { data: userData } = await supabaseServer.auth.getUser(token)
      uploadedBy = userData?.user?.id || null
    }

    const form = await request.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const uploadId = crypto.randomUUID()
    const bucket = "designs"
    const storedFileName = `${uploadId}-${safeName}`
    const path = `uploads/temp/${storedFileName}`

    const { error: upErr } = await supabaseServer.storage.from(bucket).upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    const { data: pub } = supabaseServer.storage.from(bucket).getPublicUrl(path)
    const fileUrl = pub?.publicUrl || null
    if (!fileUrl) return NextResponse.json({ error: "Failed to create file URL" }, { status: 500 })

    const { data: uploadedFile, error: insErr } = await (supabaseServer as any)
      .from("uploaded_files")
      .insert([
        {
          uploaded_by: uploadedBy,
          file_url: fileUrl,
          file_name: storedFileName,
          original_filename: file.name,
          status: "temporary",
        },
      ])
      .select()
      .single()
    if (insErr || !uploadedFile) return NextResponse.json({ error: insErr?.message || "Failed to record upload" }, { status: 500 })

    return NextResponse.json({
      success: true,
      uploadedFile: {
        id: uploadedFile.id,
        file_url: uploadedFile.file_url,
        file_name: uploadedFile.file_name,
        original_filename: uploadedFile.original_filename,
        status: uploadedFile.status,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
