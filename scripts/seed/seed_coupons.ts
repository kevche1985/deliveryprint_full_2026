import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local")
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8")
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      let val = m[2]
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
      if (!process.env[key]) process.env[key] = val
    }
  }
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!url || !service) throw new Error("Missing Supabase envs")

const supabase = createClient(url, service)

async function upsertCoupon(data: any) {
  await supabase.from("coupons").delete().eq("code", data.code)
  const { error } = await supabase.from("coupons").insert([data])
  if (error) throw error
}

async function main() {
  const now = new Date().toISOString()
  const sevenDays = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  await upsertCoupon({
    code: "spring20",
    code_type: "standard",
    description: "20% off entire order",
    status: "enabled",
    discount_type: "order_percent",
    amount: 20,
    start_at: now,
    end_at: sevenDays,
    free_shipping: false,
  })
  await upsertCoupon({
    code: "tenoff",
    code_type: "standard",
    description: "$10 off orders over $30",
    status: "enabled",
    discount_type: "order_fixed",
    amount: 10,
    min_amount: 30,
    start_at: now,
    end_at: sevenDays,
    free_shipping: false,
  })
  console.log("Seeded sample coupons: spring20, tenoff")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

