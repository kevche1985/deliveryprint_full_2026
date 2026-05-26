import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"

// Load .env.local manually if envs are missing
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local")
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8")
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      let val = m[2]
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  }
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  loadEnvLocal()
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceKey) {
  throw new Error("Missing Supabase envs: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(url, serviceKey)

async function ensureDir(p: string) {
  await fs.promises.mkdir(p, { recursive: true })
}

async function listAll(bucket: string): Promise<string[]> {
  const keys: string[] = []
  // Supabase JS lists by prefix; recursively fetch directories
  async function walk(prefix = "") {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 })
    if (error) throw error
    for (const entry of data || []) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id && entry.name && !entry.metadata) {
        // Folder (without metadata) is still a directory in some SDK versions
      }
      if (entry.id && entry.metadata) {
        keys.push(key)
      } else if (!entry.metadata && !entry.id) {
        // Fallback: if SDK doesn’t mark dirs, try to download; skip here
      }
      if (entry.name && entry.id && !entry.metadata) {
        await walk(key)
      }
    }
  }
  await walk("")
  return keys
}

async function downloadObject(bucket: string, key: string, outDir: string) {
  const outPath = path.join(outDir, bucket, key)
  await ensureDir(path.dirname(outPath))
  const { data, error } = await supabase.storage.from(bucket).download(key)
  if (error) throw error
  const arrayBuffer = await data.arrayBuffer()
  await fs.promises.writeFile(outPath, Buffer.from(arrayBuffer))
}

async function main() {
  const outDir = path.resolve("supabase-storage-backup")
  await ensureDir(outDir)

  // @ts-ignore listBuckets is available at runtime
  const { data: buckets, error } = await (supabase as any).storage.listBuckets()
  if (error) throw error

  for (const b of buckets) {
    const bucket = b.name as string
    console.log(`Listing ${bucket}...`)
    const keys = await listAll(bucket)
    console.log(`Found ${keys.length} objects in ${bucket}`)
    for (const key of keys) {
      await downloadObject(bucket, key, outDir)
    }
  }

  console.log("Storage export complete:", path.join(outDir))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
