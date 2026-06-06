import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRole } from "@/lib/rbac"

export const dynamic = "force-dynamic"

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

  try {
    const body = (await request.json().catch(() => null)) as any
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null
    const is_active = typeof body?.is_active === "boolean" ? body.is_active : true
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const baseSlug = slugify(name) || "category"
    let slug = baseSlug
    const { data: existing, error: existingError } = await supabaseServer.from("categories").select("id, slug").eq("slug", slug).maybeSingle()
    if (existingError) throw existingError
    if (existing?.id) {
      slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`
    }

    const { data, error } = await supabaseServer
      .from("categories")
      .insert([{ name, slug, description, is_active }])
      .select("*")
      .single()
    if (error) throw error
    return NextResponse.json({ category: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create category" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await requireRole(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

  try {
    const body = (await request.json().catch(() => null)) as any
    const id = typeof body?.id === "string" ? body.id : ""
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null
    const is_active = typeof body?.is_active === "boolean" ? body.is_active : true
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const slug = slugify(name) || null

    const { data, error } = await supabaseServer
      .from("categories")
      .update({ name, slug, description, is_active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single()
    if (error) throw error
    return NextResponse.json({ category: data }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await requireRole(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    const { error } = await supabaseServer.from("categories").delete().eq("id", id)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete category" }, { status: 500 })
  }
}

