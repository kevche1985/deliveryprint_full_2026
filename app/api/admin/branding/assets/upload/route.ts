import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRoleWithProfile } from "@/lib/rbac"

export const runtime = "nodejs"

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"])

async function getTenantId(activeTenantId: string | null) {
  if (activeTenantId) return activeTenantId
  const { data, error } = await supabaseServer
    .from("tenants")
    .select("id")
    .eq("slug", "primary")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data?.id) return data.id as string
  throw new Error("No active tenant")
}

function extForMime(mime: string) {
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  if (mime === "image/svg+xml") return "svg"
  return "jpg"
}

function sanitizeSvg(input: string) {
  let s = input
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "")
  s = s.replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
  s = s.replace(/\son\w+\s*=\s*'[^']*'/gi, "")
  s = s.replace(/javascript:/gi, "")
  return s
}

export async function POST(request: Request) {
  const auth = await requireRoleWithProfile(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

  try {
    const tenantId = await getTenantId((auth as any).activeTenantId)
    const form = await request.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })

    const mime = file.type || ""
    if (!ALLOWED.has(mime)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 400 })

    const ab = await file.arrayBuffer()
    let buf = Buffer.from(ab)
    if (mime === "image/svg+xml") {
      const sanitized = sanitizeSvg(buf.toString("utf-8"))
      buf = Buffer.from(sanitized, "utf-8")
    }

    const ext = extForMime(mime)
    const name = `tenant/${tenantId}/main-banner/${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await supabaseServer.storage
      .from("branding")
      .upload(name, buf, { contentType: mime, cacheControl: "3600", upsert: true })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    const { data } = supabaseServer.storage.from("branding").getPublicUrl(name)
    return NextResponse.json({ url: data.publicUrl, path: name })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 500 })
  }
}

