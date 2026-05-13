import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { SEED_EMPLOYEE_ROWS } from './seed-demo-data.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

function parseDotEnv(text) {
  /** @type {Record<string, string>} */
  const out = {}
  String(text ?? '')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const idx = trimmed.indexOf('=')
      if (idx === -1) return
      const k = trimmed.slice(0, idx).trim()
      const v = trimmed.slice(idx + 1).trim()
      out[k] = v.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    })
  return out
}

async function loadEnv() {
  const envPath = path.join(root, '.env')
  const text = await readFile(envPath, 'utf8')
  const parsed = parseDotEnv(text)
  const url = (process.env.VITE_SUPABASE_URL ?? parsed.VITE_SUPABASE_URL ?? '').trim()
  const anon = (process.env.VITE_SUPABASE_ANON_KEY ?? parsed.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !anon) {
    throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env (or process env).')
  }
  return { url, anon }
}

async function main() {
  const { url, anon } = await loadEnv()
  const sb = createClient(url, anon)

  const rows = SEED_EMPLOYEE_ROWS.map((row) => ({
    id: crypto.randomUUID(),
    created_date: new Date().toISOString().slice(0, 10),
    ...row,
  }))

  const { error } = await sb.from('employees').insert(rows)
  if (error) throw error

  console.log(`Seeded ${rows.length} employees into Supabase.`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

