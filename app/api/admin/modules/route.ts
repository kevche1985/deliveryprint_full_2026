import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRole } from "@/lib/rbac"

export const dynamic = "force-dynamic"

const ADMIN_KEY = "admin_modules_visibility"
const WEB_KEY = "web_modules_visibility"

async function getSetting(key: string) {
  // Prefer schema: system_settings(key TEXT PRIMARY KEY, value JSONB)
  const { data } = await (supabaseServer as any)
    .from("system_settings")
    .select("key, value")
    .eq("key", key)
    .maybeSingle()
  return (data?.value as any) || null
}

async function upsertSetting(key: string, value: any) {
  const payload = { key, value }
  await (supabaseServer as any)
    .from("system_settings")
    .upsert(payload, { onConflict: "key" })
}

const defaultAdminVisibility = {
  dashboard: true,
  orders: true,
  products: true,
  services: true,
  coupons: true,
  users: true,
  quotes: true,
  transactions: true,
  disputes: true,
  emailSettings: true,
}

const defaultWebVisibility = {
  products: true,
  services: true,
  services_digital_printing: true,
  services_large_format: true,
  services_event_stands: true,
  services_illuminated_signs: true,
  aiStudio: true,
  supplierPortal: true,
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req as any, ["admin", "operator"])
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

    const adminVis = (await getSetting(ADMIN_KEY)) || defaultAdminVisibility
    const webVis = (await getSetting(WEB_KEY)) || defaultWebVisibility
    return NextResponse.json({ admin_modules_visibility: adminVis, web_modules_visibility: webVis })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireRole(req as any, ["admin", "operator"])
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

    const body = await req.json()
    const adminVis = body?.admin_modules_visibility || defaultAdminVisibility
    const webVis = body?.web_modules_visibility || defaultWebVisibility

    await upsertSetting(ADMIN_KEY, adminVis)
    await upsertSetting(WEB_KEY, webVis)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}

