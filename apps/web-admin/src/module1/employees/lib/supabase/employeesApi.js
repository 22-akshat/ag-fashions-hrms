import { supabase } from '@/module1/employees/lib/supabase/client'
import { employeeToRow, rowToEmployee } from '@/module1/employees/lib/supabase/mapEmployee'

const TABLE = 'employees'

/** Omits bulky `face_embedding` jsonb from list queries. */
export const EMPLOYEE_LIST_COLUMNS = [
  'id',
  'card_no',
  'full_name',
  'father_husband_name',
  'status',
  'date_of_interview',
  'last_interview_date',
  'date_of_birth',
  'gender',
  'marital_status',
  'job_location',
  'department',
  'designation',
  'adhar_card',
  'pan_card',
  'account_no',
  'ifsc_code',
  'salary',
  'esic_no',
  'uan_no',
  'phone_no_1',
  'phone_no_2',
  'personal_email',
  'local_address',
  'permanent_address',
  'created_date',
  'intime',
  'outtime',
  'weekly_off',
  'personel_image',
  'updated_at',
  'face_registered_at',
  'face_embedding_version',
].join(',')

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).')
  }
  return supabase
}

export async function listEmployees() {
  const sb = requireClient()
  const {
    data: { session },
    error: sessionErr,
  } = await sb.auth.getSession()
  if (sessionErr) throw sessionErr

  if (session?.user?.id) {
    const { data: isHr, error: hrErr } = await sb.rpc('is_hr_user', {
      check_uid: session.user.id,
    })
    if (hrErr) throw hrErr
    if (isHr !== true) {
      throw new Error(
        'Authenticated user is not mapped in public.hr_users, so employees RLS returns zero rows.',
      )
    }
  }

  const { data, error } = await sb
    .from(TABLE)
    .select(EMPLOYEE_LIST_COLUMNS)
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

