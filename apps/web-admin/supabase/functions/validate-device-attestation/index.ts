import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'POST only' })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    return json(500, { ok: false, code: 'SERVER_MISCONFIGURED', message: 'Missing env' })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON', message: 'Body must be JSON' })
  }

  const employeeId = typeof body.employee_id === 'string' ? body.employee_id.trim() : ''
  const deviceId = typeof body.device_id === 'string' ? body.device_id.trim() : ''
  const token = typeof body.attestation_token === 'string' ? body.attestation_token.trim() : ''
  const platform = typeof body.platform === 'string' ? body.platform.trim() : 'unknown'
  const isValid = Boolean(body.is_valid)

  if (!employeeId || !deviceId) {
    return json(400, { ok: false, code: 'MISSING_FIELDS', message: 'employee_id and device_id required' })
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await admin.from('device_attestation').insert({
    employee_id: employeeId,
    device_id: deviceId,
    attestation_token: token,
    is_valid: isValid,
    platform,
  })
  if (error) return json(500, { ok: false, code: 'ATTESTATION_SAVE_FAILED', message: error.message })

  return json(200, { ok: true, is_valid: isValid })
})

