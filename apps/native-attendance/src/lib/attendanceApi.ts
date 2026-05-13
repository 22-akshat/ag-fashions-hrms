import { resolveEmployeeUuidForSupabase } from './employeeIdResolve';
import { supabase } from '../supabase';

function edgeInvocationKey(): string {
  return String(process.env.EXPO_PUBLIC_ATTENDANCE_EDGE_INVOCATION_KEY ?? '').trim();
}

function newIdempotencyKey(): string {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export type MarkAttendanceInput = {
  employeeId: string;
  faceSessionToken: string;
  deviceId: string;
  embeddingVersion?: number;
  offlineId?: string;
  capturedAtIso?: string;
  integritySnapshot?: Record<string, unknown> | null;
  riskSnapshot?: Record<string, unknown> | null;
  offlineSignature?: string | null;
  attestationToken?: string | null;
  attestationValid?: boolean | null;
  devicePublicKey?: string | null;
  deviceSignature?: string | null;
  scanLatitude?: number;
  scanLongitude?: number;
  shopId?: string | null;
  idempotencyKey?: string;
  punchType?: 'in' | 'out';
};

/** Punches always go through the `mark-attendance` Edge Function (service_role INSERT). */
export async function markAttendance(input: MarkAttendanceInput) {
  if (!supabase) {
    throw new Error('Supabase configuration missing in .env.');
  }

  const employeeUuid = await resolveEmployeeUuidForSupabase(input.employeeId);
  if (!employeeUuid) {
    throw new Error(
      'Employee not found. Enter the same Card No. as in Employees (or the full UUID).',
    );
  }

  const key = edgeInvocationKey();
  if (!key) {
    throw new Error(
      'EXPO_PUBLIC_ATTENDANCE_EDGE_INVOCATION_KEY is required. Match Supabase secret ATTENDANCE_EDGE_INVOCATION_KEY.',
    );
  }

  const lat = input.scanLatitude;
  const lng = input.scanLongitude;
  const shopId = input.shopId?.trim() || '';
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !shopId) {
    throw new Error(
      'Server punch requires GPS and a Supabase shop id. Finish loading the store row or check network.',
    );
  }

  const idempotencyKey = input.idempotencyKey?.trim() || newIdempotencyKey();
  const punchType = input.punchType === 'out' ? 'out' : 'in';
  const faceSessionToken = input.faceSessionToken?.trim();
  const deviceId = input.deviceId?.trim();
  const isOfflinePayload = Boolean(input.offlineId && input.offlineSignature);
  if ((!faceSessionToken && !isOfflinePayload) || !deviceId) {
    throw new Error('Face verification session token (or valid offline payload) and device id are required.');
  }
  const embeddingVersion = Number.isFinite(input.embeddingVersion) ? Number(input.embeddingVersion) : 1;

  const { data, error } = await supabase.functions.invoke('mark-attendance', {
    body: {
      employee_id: employeeUuid,
      face_session_token: faceSessionToken ?? null,
      device_id: deviceId,
      embedding_version: embeddingVersion,
      latitude: lat,
      longitude: lng,
      shop_id: shopId,
      status: 'present',
      punch_type: punchType,
      idempotency_key: idempotencyKey,
      offline_id: input.offlineId ?? null,
      captured_at: input.capturedAtIso ?? null,
      integrity_snapshot: input.integritySnapshot ?? null,
      risk_snapshot: input.riskSnapshot ?? null,
      offline_signature: input.offlineSignature ?? null,
      attestation_token: input.attestationToken ?? null,
      attestation_valid: input.attestationValid ?? null,
      device_public_key: input.devicePublicKey ?? null,
      device_signature: input.deviceSignature ?? null,
    },
    headers: {
      'x-attendance-edge-invocation-key': key,
      'x-idempotency-key': idempotencyKey,
    },
  });

  if (error) {
    let message = error.message;
    let code: string | undefined;
    const ctx = (error as { context?: { body?: string } }).context;
    if (ctx?.body) {
      try {
        const j = JSON.parse(ctx.body) as { message?: string; code?: string };
        if (typeof j.message === 'string') {
          message = j.code ? `${j.message} (${j.code})` : j.message;
          code = typeof j.code === 'string' ? j.code : undefined;
        }
      } catch {
        /* keep error.message */
      }
    }
    throw new Error(message);
  }

  const payload = data as { ok?: boolean; message?: string; code?: string } | null;
  if (!payload || payload.ok !== true) {
    const msg = payload?.message ?? 'mark-attendance failed';
    const code = payload?.code ? ` (${payload.code})` : '';
    throw new Error(`${msg}${code}`);
  }
}

export function classifyAttendanceError(message: string): {
  kind:
    | 'network'
    | 'expired'
    | 'used'
    | 'device_blocked'
    | 'device_integrity_failed'
    | 'mock_location'
    | 'emulator_not_allowed'
    | 'device_revoked'
    | 'offline_expired'
    | 'offline_replay'
    | 'offline_signature_invalid'
    | 'invalid'
    | 'rate_limited'
    | 'embedding_mismatch'
    | 'unknown';
  code?: string;
} {
  const m = String(message ?? '');
  const codeMatch = m.match(/\(([A-Z0-9_]+)\)\s*$/);
  const code = codeMatch?.[1];
  switch (code) {
    case 'FACE_SESSION_EXPIRED':
      return { kind: 'expired', code };
    case 'FACE_SESSION_USED':
      return { kind: 'used', code };
    case 'FACE_SESSION_DEVICE_MISMATCH':
      return { kind: 'invalid', code };
    case 'FACE_SESSION_INVALID':
      return { kind: 'invalid', code };
    case 'DEVICE_BLOCKED':
      return { kind: 'device_blocked', code };
    case 'DEVICE_REVOKED':
      return { kind: 'device_revoked', code };
    case 'DEVICE_INTEGRITY_FAILED':
      return { kind: 'device_integrity_failed', code };
    case 'MOCK_LOCATION_DETECTED':
      return { kind: 'mock_location', code };
    case 'EMULATOR_NOT_ALLOWED':
      return { kind: 'emulator_not_allowed', code };
    case 'RATE_LIMITED':
      return { kind: 'rate_limited', code };
    case 'FACE_EMBEDDING_VERSION_MISMATCH':
      return { kind: 'embedding_mismatch', code };
    case 'OFFLINE_ATTENDANCE_EXPIRED':
      return { kind: 'offline_expired', code };
    case 'OFFLINE_REPLAY_DETECTED':
      return { kind: 'offline_replay', code };
    case 'INVALID_OFFLINE_SIGNATURE':
      return { kind: 'offline_signature_invalid', code };
    case 'ATTESTATION_INVALID':
      return { kind: 'device_integrity_failed', code };
    case 'INVOCATION_KEY_INVALID':
      return { kind: 'invalid', code };
    case 'SHOP_ID_REQUIRED':
    case 'GEOFENCE_INVALID':
    case 'GEOFENCE_BLOCKED':
    case 'DUPLICATE_PUNCH_IN':
    case 'DUPLICATE_PUNCH_OUT':
    case 'NO_OPEN_IN_PUNCH':
      return { kind: 'invalid', code };
    case 'HIGH_RISK_BLOCKED':
      return { kind: 'rate_limited', code };
    case 'DEVICE_SIGNATURE_INVALID':
      return { kind: 'offline_signature_invalid', code };
    case 'POLICY_BLOCKED':
      return { kind: 'device_blocked', code };
    case 'ANOMALY_RISK_BLOCKED':
      return { kind: 'rate_limited', code };
    default:
      break;
  }
  if (/network|fetch|timeout|timed out|failed to fetch/i.test(m)) return { kind: 'network' };
  return { kind: 'unknown', code };
}
