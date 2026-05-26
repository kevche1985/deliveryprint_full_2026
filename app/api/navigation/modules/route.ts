import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

const ADMIN_KEY = "admin_modules_visibility"
const WEB_KEY = "web_modules_visibility"

async function getSetting(key: string) {
  const { data } = await (supabaseServer as any)
    .from("system_settings")
    .select("key, value")
    .eq("key", key)
    .maybeSingle()
  return (data?.value as any) || null
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

export async function GET() {
  try {
    const adminVis = (await getSetting(ADMIN_KEY)) || defaultAdminVisibility
    const webVis = (await getSetting(WEB_KEY)) || defaultWebVisibility
    return NextResponse.json({ admin_modules_visibility: adminVis, web_modules_visibility: webVis })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}

