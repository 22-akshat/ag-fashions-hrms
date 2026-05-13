import { supabase } from '@/module1/employees/lib/supabase/client'

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).')
  }
  return supabase
}

export function mapLocationRow(row) {
  if (!row?.employee_id) return null
  return {
    employee_id: String(row.employee_id),
    lat: Number(row.lat),
    lng: Number(row.lng),
    accuracy: row.accuracy != null ? Number(row.accuracy) : null,
    recorded_at: row.recorded_at ?? null,
  }
}

export function mapShopRow(row) {
  if (!row?.id) return null
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    lat: Number(row.lat),
    lng: Number(row.lng),
    radius_meters: Number(row.radius_meters ?? 200),
    is_active: Boolean(row.is_active),
  }
}

export async function fetchEmployeeLocationsSnapshot() {
  const sb = requireClient()
  const { data, error } = await sb
    .from('employee_locations')
    .select('employee_id, lat, lng, accuracy, recorded_at')
  if (error) throw error
  const map = {}
  for (const row of data ?? []) {
    const m = mapLocationRow(row)
    if (m) map[m.employee_id] = m
  }
  return map
}

export async function fetchShopsSnapshot() {
  const sb = requireClient()
  const { data, error } = await sb
    .from('shops')
    .select('id,name,lat,lng,radius_meters,is_active')
    .order('name', { ascending: true })
  if (error) throw error
  const list = (data ?? []).map(mapShopRow).filter(Boolean)
  const byId = new Map(list.map((s) => [s.id, s]))
  return { list, byId }
}

/**
 * Latest approved access request per employee_id → requested_shop_id (for assigned-shop semantics).
 */
export async function fetchApprovedShopByEmployee() {
  const sb = requireClient()
  const { data, error } = await sb
    .from('attendance_access_requests')
    .select('employee_id, requested_shop_id, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(800)
  if (error) throw error
  const map = new Map()
  for (const row of data ?? []) {
    const eid = row.employee_id != null ? String(row.employee_id) : ''
    const sid = row.requested_shop_id != null ? String(row.requested_shop_id) : ''
    if (!eid || !sid || map.has(eid)) continue
    map.set(eid, sid)
  }
  return map
}
