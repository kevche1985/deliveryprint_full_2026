import { supabaseServer } from "@/lib/supabase-server"

export type AIProviderSettings = {
  provider: string
  model: string
  baseUrl: string
  apiKey: string | null
  maxOutputTokens: number
  temperature: number
  timeoutMs: number
  isActive: boolean
}

function defaultBaseUrl(provider: string) {
  if (provider === "openrouter") return "https://openrouter.ai/api/v1"
  return "https://api.openai.com/v1"
}

export async function getAIProviderSettings(userId?: string | null): Promise<AIProviderSettings> {
  let tenantId: string | null = null

  if (userId) {
    const profile = await supabaseServer
      .from("user_profiles")
      .select("active_tenant_id")
      .eq("id", userId)
      .maybeSingle()
    tenantId = (profile.data as any)?.active_tenant_id ?? null
  }

  const baseQuery = supabaseServer
    .from("ai_settings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)

  const primary = tenantId ? await baseQuery.eq("tenant_id", tenantId).maybeSingle() : await baseQuery.is("tenant_id", null).maybeSingle()
  const fallback = tenantId && !primary.data ? await baseQuery.is("tenant_id", null).maybeSingle() : null
  const row = (primary.data || fallback?.data || null) as any

  const envKey = process.env.OPENAI_API_KEY || null
  const provider = row?.provider || "openai"
  const model = row?.model || "dall-e-3"
  const baseUrl = (row?.base_url as string | null) || defaultBaseUrl(provider)
  const apiKey = (row?.api_key as string | null) || envKey
  const isActive = row?.is_active != null ? Boolean(row.is_active) : !!apiKey

  return {
    provider,
    model,
    baseUrl,
    apiKey,
    maxOutputTokens: Number(row?.max_output_tokens ?? 2048),
    temperature: Number(row?.temperature ?? 0.2),
    timeoutMs: Number(row?.timeout_ms ?? 30000),
    isActive,
  }
}

