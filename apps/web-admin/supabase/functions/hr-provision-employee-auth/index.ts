/**
 * hr-provision-employee-auth — HR-only provisioning for employee Supabase Auth accounts.
 *
 * - Validates HR JWT (Authorization: Bearer <token>) via auth.getUser()
 * - Ensures caller exists in public.hr_users
 * - Creates (or updates) employee auth user using phone + password
 * - Upserts public.employee_auth_profiles mapping
 *
 * This keeps service_role off the web client.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import type { User } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function getBearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

async function requireHr(admin: ReturnType<typeof createClient>, jwt: string): Promise<User> {
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data?.user) {
    throw new Error('UNAUTHORIZED')
  }
  const user = data.user
  const { data: hrRow, error: hrErr } = await admin
    .from('hr_users')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (hrErr || !hrRow?.id) {
    throw new Error('FORBIDDEN')
  }
  return user
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'POST only' })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    return json(500, { ok: false, code: 'SERVER_MISCONFIGURED', message: 'Missing Supabase env' })
  }

  const jwt = getBearer(req)
  if (!jwt) return json(401, { ok: false, code: 'UNAUTHORIZED', message: 'Missing Authorization bearer token' })

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON', message: 'Body must be JSON' })
  }

  const employeeId = typeof body.employee_id === 'string' ? body.employee_id.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const status = typeof body.status === 'string' ? body.status.trim() : 'active'

  if (!employeeId || !phone || !password) {
    return json(400, {
      ok: false,
      code: 'MISSING_FIELDS',
      message: 'employee_id, phone, password are required',
    })
  }

  try {
    const hrUser = await requireHr(admin, jwt)

    const { data: employee, error: empErr } = await admin
      .from('employees')
      .select('id, status, phone_no_1')
      .eq('id', employeeId)
      .maybeSingle()
    if (empErr) return json(500, { ok: false, code: 'EMPLOYEE_LOOKUP_FAILED', message: empErr.message })
    if (!employee?.id) return json(404, { ok: false, code: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found' })

    // Prefer phone from DB if present.
    const canonicalPhone = String(employee.phone_no_1 ?? '').trim() || phone

    // Create or update auth user by phone.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      phone: canonicalPhone,
      password,
      phone_confirm: true,
      user_metadata: { kind: 'employee', employee_id: employee.id },
    })

    if (createErr && !String(createErr.message).toLowerCase().includes('already registered')) {
      return json(400, { ok: false, code: 'AUTH_CREATE_FAILED', message: createErr.message })
    }

    let authUserId = created?.user?.id ?? null
    if (!authUserId) {
      // If user already exists, look it up.
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 })
      if (listErr) return json(500, { ok: false, code: 'AUTH_LOOKUP_FAILED', message: listErr.message })
      const hit = (list?.users ?? []).find((u) => (u.phone ?? '').trim() === canonicalPhone)
      authUserId = hit?.id ?? null
    }
    if (!authUserId) return json(500, { ok: false, code: 'AUTH_LOOKUP_FAILED', message: 'Cannot resolve auth user' })

    const { error: mapErr } = await admin.from('employee_auth_profiles').upsert(
      {
        auth_user_id: authUserId,
        employee_id: employee.id,
        status: status === 'disabled' ? 'disabled' : 'active',
        phone: canonicalPhone,
      },
      { onConflict: 'auth_user_id' },
    )
    if (mapErr) return json(500, { ok: false, code: 'PROFILE_UPSERT_FAILED', message: mapErr.message })

    return json(200, {
      ok: true,
      employee_id: employee.id,
      auth_user_id: authUserId,
      phone: canonicalPhone,
      provisioned_by: hrUser.id,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'UNAUTHORIZED') return json(401, { ok: false, code: 'UNAUTHORIZED', message: 'Invalid session' })
    if (msg === 'FORBIDDEN') return json(403, { ok: false, code: 'FORBIDDEN', message: 'HR only' })
    return json(500, { ok: false, code: 'UNKNOWN', message: msg })
  }
})

