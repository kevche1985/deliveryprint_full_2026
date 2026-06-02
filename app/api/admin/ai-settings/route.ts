import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRoleWithProfile } from "@/lib/rbac"

export const dynamic = "force-dynamic"

function maskApiKey(key: string) {
  const trimmed = key.trim()
  if (!trimmed) return ""
  const last4 = trimmed.slice(-4)
  return `****${last4}`
}

export async function GET(request: NextRequest) {
  const auth = await requireRoleWithProfile(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

  const tenantId = (auth as any).activeTenantId as string | null

  const query = supabaseServer
    .from("ai_settings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)

  const { data, error } = tenantId ? await query.eq("tenant_id", tenantId).maybeSingle() : await query.is("tenant_id", null).maybeSingle()

  if (error) return NextResponse.json({ error: "Failed to load AI settings" }, { status: 500 })

  const row = data || null
  const apiKey = (row as any)?.api_key ? String((row as any).api_key) : ""

  return NextResponse.json({
    provider: (row as any)?.provider || "openai",
    model: (row as any)?.model || "dall-e-3",
    base_url: (row as any)?.base_url || "",
    max_output_tokens: Number((row as any)?.max_output_tokens ?? 2048),
    temperature: Number((row as any)?.temperature ?? 0.2),
    timeout_ms: Number((row as any)?.timeout_ms ?? 30000),
    is_active: Boolean((row as any)?.is_active ?? false),
    has_api_key: !!apiKey,
    api_key_masked: apiKey ? maskApiKey(apiKey) : "",
  })
}

export async function PUT(request: NextRequest) {
  const auth = await requireRoleWithProfile(request, ["admin", "operator"])
  if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

  const tenantId = (auth as any).activeTenantId as string | null

  const Schema = z
    .object({
      provider: z.string().min(1),
      model: z.string().min(1),
      base_url: z.string().optional(),
      max_output_tokens: z.number().int().min(1).max(200000),
      temperature: z.number().min(0).max(2),
      timeout_ms: z.number().int().min(1000).max(120000),
      is_active: z.boolean(),
      api_key: z.string().optional(),
      clear_api_key: z.boolean().optional(),
    })
    .strict()

  const body = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const payload = parsed.data

  const baseQuery = supabaseServer
    .from("ai_settings")
    .select("id, api_key")
    .order("created_at", { ascending: false })
    .limit(1)

  const existing = tenantId
    ? await baseQuery.eq("tenant_id", tenantId).maybeSingle()
    : await baseQuery.is("tenant_id", null).maybeSingle()

  if (existing.error) return NextResponse.json({ error: "Failed to load AI settings" }, { status: 500 })

  const existingKey = existing.data?.api_key ? String(existing.data.api_key) : null
  const incomingKey = payload.api_key != null ? payload.api_key.trim() : null
  const nextKey =
    incomingKey && incomingKey.length > 0 ? incomingKey : payload.clear_api_key ? null : existingKey

  const record: Record<string, any> = {
    tenant_id: tenantId,
    provider: payload.provider,
    model: payload.model,
    base_url: payload.base_url?.trim() || null,
    max_output_tokens: payload.max_output_tokens,
    temperature: payload.temperature,
    timeout_ms: payload.timeout_ms,
    is_active: payload.is_active,
    api_key: nextKey,
    updated_at: new Date().toISOString(),
  }

  if (existing.data?.id) {
    const { error } = await supabaseServer.from("ai_settings").update(record).eq("id", existing.data.id)
    if (error) return NextResponse.json({ error: "Failed to update AI settings" }, { status: 500 })
  } else {
    const { error } = await supabaseServer.from("ai_settings").insert([record])
    if (error) return NextResponse.json({ error: "Failed to create AI settings" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

