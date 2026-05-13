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

function calculateAnomalyScore(input: Record<string, unknown> = {}) {
  let score = 0
  const reasons: string[] = []
  if (input.integrityFailure === true) {
    score += 40
    reasons.push('integrity_failure')
  }
  if (input.replayAttempt === true) {
    score += 45
    reasons.push('replay_attempt')
  }
  if (input.geoJump === true) {
    score += 20
    reasons.push('geo_jump')
  }
  if (input.offlineBurst === true) {
    score += 20
    reasons.push('offline_burst')
  }
  if (input.failedLiveness === true) {
    score += 15
    reasons.push('failed_liveness')
  }
  if (score > 100) score = 100
  const level = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low'
  return { score, level, reasons }
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
  if (!employeeId || !deviceId) {
    return json(400, { ok: false, code: 'MISSING_FIELDS', message: 'employee_id and device_id required' })
  }

  const risk = calculateAnomalyScore(body.signals ?? {})
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await admin.from('anomaly_detection_events').insert({
    employee_id: employeeId,
    device_id: deviceId,
    attendance_log_id: typeof body.attendance_log_id === 'string' ? body.attendance_log_id : null,
    risk_score: risk.score,
    risk_level: risk.level,
    reasons: risk.reasons,
    details: body.signals ?? {},
  })
  if (error) return json(500, { ok: false, code: 'ANOMALY_STORE_FAILED', message: error.message })

  await admin.from('employee_risk_profiles').upsert({
    employee_id: employeeId,
    last_risk_score: risk.score,
    last_risk_level: risk.level,
    reasons: risk.reasons,
    updated_at: new Date().toISOString(),
  })

  return json(200, { ok: true, risk })
})

