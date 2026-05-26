/*
  Auth users + storage cleanup
  - Dry-run by default; pass --apply to execute deletions
  - Parameters loaded from scripts/cleanup/params.json
*/
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

type Params = { keepUsers: string[]; cutoffDays: number }

const paramsPath = path.resolve(__dirname, 'params.json')
const params: Params = JSON.parse(fs.readFileSync(paramsPath, 'utf8'))

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const DRY_RUN = !process.argv.includes('--apply')
const cutoffMs = params.cutoffDays * 24 * 60 * 60 * 1000
const cutoffDate = new Date(Date.now() - cutoffMs)

function olderThanCutoff(dateStr?: string | null) {
  if (!dateStr) return false
  return new Date(dateStr) < cutoffDate
}

async function listAllUsers() {
  const out: any[] = []
  let page = 1
  const perPage = 1000
  // @ts-ignore supabase-js may not type page param; still works at runtime
  while (true) {
    const { data, error } = await (supabase.auth as any).admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users || []
    out.push(...users)
    if (users.length < perPage) break
    page += 1
  }
  return out
}

async function ensureTableExists(table: string) {
  try {
    const { error } = await supabase.from(table).select('*').limit(1)
    if (error) throw error
    return true
  } catch {
    return false
  }
}

async function cleanAuthUsers() {
  const keep = new Set(params.keepUsers.map(e => e.toLowerCase()))
  const users = await listAllUsers()
  const candidates = users.filter((u: any) => !keep.has((u.email || '').toLowerCase()) && olderThanCutoff(u.created_at))

  const manifest = candidates.map((u: any) => ({ id: u.id, email: u.email, created_at: u.created_at }))
  console.log(`Auth users to delete (${manifest.length})`, manifest)

  if (DRY_RUN) return

  for (const u of candidates) {
    try {
      await (supabase.auth as any).admin.deleteUser(u.id, true)
      console.log('Deleted user', u.email)
    } catch (e) {
      console.warn('Failed to delete user', u.email, e)
    }
  }
}

function extractBucketAndPath(publicUrl: string): { bucket: string; key: string } | null {
  // example: https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<key>
  const idx = publicUrl.indexOf('/storage/v1/object/public/')
  if (idx === -1) return null
  const rest = publicUrl.slice(idx + '/storage/v1/object/public/'.length)
  const firstSlash = rest.indexOf('/')
  if (firstSlash === -1) return null
  return { bucket: rest.slice(0, firstSlash), key: rest.slice(firstSlash + 1) }
}

async function deleteStorageObjectsFromTable(table: string, urlColumn: string) {
  const exists = await ensureTableExists(table)
  if (!exists) return
  const { data, error } = await supabase.from(table).select(`${urlColumn}, created_at`).lte('created_at', cutoffDate.toISOString())
  if (error) throw error
  const urls = (data || []).map((r: any) => r[urlColumn]).filter(Boolean)
  const groups: Record<string, string[]> = {}
  for (const url of urls) {
    const parsed = extractBucketAndPath(url)
    if (!parsed) continue
    groups[parsed.bucket] = groups[parsed.bucket] || []
    groups[parsed.bucket].push(parsed.key)
  }
  console.log(`Storage deletions from ${table} (${urls.length})`, groups)
  if (DRY_RUN) return
  for (const [bucket, keys] of Object.entries(groups)) {
    // Delete in chunks of 100
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100)
      const { error: delErr } = await supabase.storage.from(bucket).remove(chunk)
      if (delErr) console.warn('Failed removing from bucket', bucket, delErr)
    }
  }
}

async function deleteRowsOlderThan(table: string) {
  const exists = await ensureTableExists(table)
  if (!exists) return
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).lte('created_at', cutoffDate.toISOString())
  if (error) throw error
  console.log(`Rows to delete in ${table}:`, count || 0)
  if (DRY_RUN) return
  const { error: delErr } = await supabase.from(table).delete().lte('created_at', cutoffDate.toISOString())
  if (delErr) throw delErr
}

async function main() {
  console.log('Cleanup parameters:', params, 'cutoffDate=', cutoffDate.toISOString(), 'mode=', DRY_RUN ? 'DRY-RUN' : 'APPLY')
  await cleanAuthUsers()

  // Storage driven by DB references
  await deleteStorageObjectsFromTable('order_files', 'file_url')
  await deleteRowsOlderThan('order_files')

  await deleteStorageObjectsFromTable('designs', 'file_url')
  await deleteRowsOlderThan('designs')

  console.log('Auth + storage cleanup completed.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
