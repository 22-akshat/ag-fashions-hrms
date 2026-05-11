import { supabase } from '@/module1/employees/lib/supabase/client'

const TABLE = 'shops'

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).')
  }
  return supabase
}

export function mapShopRow(row) {
  if (!row || typeof row !== 'object') return null
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    lat: Number(row.lat),
    lng: Number(row.lng),
    radius_meters: Number(row.radius_meters ?? 200),
    is_active: Boolean(row.is_active),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

export async function listShops() {
  const sb = requireClient()
  const { data, error } = await sb
    .from(TABLE)
    .select('id,name,lat,lng,radius_meters,is_active,created_at,updated_at')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapShopRow).filter(Boolean)
}

export async function createShop(payload) {
  const sb = requireClient()
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      name: payload.name,
      lat: payload.lat,
      lng: payload.lng,
      radius_meters: payload.radius_meters,
      is_active: payload.is_active,
    })
    .select('id,name,lat,lng,radius_meters,is_active,created_at,updated_at')
    .single()
  if (error) throw error
  return mapShopRow(data)
}

export async function updateShop(id, payload) {
  const sb = requireClient()
  const { data, error } = await sb
    .from(TABLE)
    .update({
      name: payload.name,
      lat: payload.lat,
      lng: payload.lng,
      radius_meters: payload.radius_meters,
      is_active: payload.is_active,
    })
    .eq('id', id)
    .select('id,name,lat,lng,radius_meters,is_active,created_at,updated_at')
    .single()
  if (error) throw error
  return mapShopRow(data)
}

export async function setShopActive(id, is_active) {
  const sb = requireClient()
  const { data, error } = await sb
    .from(TABLE)
    .update({ is_active })
    .eq('id', id)
    .select('id,name,lat,lng,radius_meters,is_active,created_at,updated_at')
    .single()
  if (error) throw error
  return mapShopRow(data)
}

export async function deleteShop(id) {
  const sb = requireClient()
  const { error } = await sb.from(TABLE).delete().eq('id', id)
  if (error) throw error
}
