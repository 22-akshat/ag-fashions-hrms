import { supabase } from '@/module1/employees/lib/supabase/client'

export async function listAccessRequests() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('attendance_access_requests')
    .select(
      'id,employee_id,requester_name,card_no,requested_shop_id,status,created_at,request_lat,request_lng',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updateAccessRequestStatus(requestId, status) {
  if (!supabase) return
  const { error } = await supabase
    .from('attendance_access_requests')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw error
}

export async function findLatestAccessRequestByIdentity(term) {
  if (!supabase) return null
  const query = String(term ?? '').trim()
  if (!query) return null

  const baseQuery = supabase
    .from('attendance_access_requests')
    .select(
      'id,requester_name,card_no,requested_shop_id,status,created_at,request_lat,request_lng,request_accuracy_m,device_id',
    )
    .or(`card_no.ilike.%${query}%,requester_name.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  const { data: activeData, error: activeError } = await baseQuery.in('status', ['pending', 'approved']).maybeSingle()
  if (activeError) throw activeError
  if (activeData) return activeData

  const { data, error } = await supabase
    .from('attendance_access_requests')
    .select(
      'id,requester_name,card_no,requested_shop_id,status,created_at,request_lat,request_lng,request_accuracy_m,device_id',
    )
    .or(`card_no.ilike.%${query}%,requester_name.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function findShopById(shopId) {
  if (!supabase || !shopId) return null
  const { data, error } = await supabase
    .from('shops')
    .select('id,name,lat,lng,radius_meters')
    .eq('id', shopId)
    .maybeSingle()
  if (error) throw error
  return data
}
