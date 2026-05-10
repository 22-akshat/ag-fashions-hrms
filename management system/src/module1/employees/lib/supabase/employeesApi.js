import { supabase } from '@/module1/employees/lib/supabase/client'
import { employeeToRow, rowToEmployee } from '@/module1/employees/lib/supabase/mapEmployee'

const TABLE = 'employees'

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).')
  }
  return supabase
}

export async function listEmployees() {
  const sb = requireClient()
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .order('date_of_interview', { ascending: false })
    .order('created_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToEmployee)
}

export async function insertEmployee(payload) {
  const sb = requireClient()
  if (payload?.id == null || String(payload.id).trim() === '') {
    throw new Error('insertEmployee requires payload.id (UUID).')
  }
  const row = employeeToRow(payload, { includeId: true })
  const { data, error } = await sb.from(TABLE).insert(row).select('*').single()
  if (error) throw error
  return rowToEmployee(data)
}

export async function updateEmployeeRow(id, payload) {
  const sb = requireClient()
  const row = employeeToRow({ ...payload, id }, { includeId: false })
  const { data, error } = await sb.from(TABLE).update(row).eq('id', id).select('*').single()
  if (error) throw error
  return rowToEmployee(data)
}

export async function deleteEmployeeRow(id) {
  const sb = requireClient()
  const { error } = await sb.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

export async function bulkInsertEmployees(rows) {
  const sb = requireClient()
  const { error } = await sb.from(TABLE).insert(rows)
  if (error) throw error
}

