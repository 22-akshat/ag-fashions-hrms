import { markAttendance } from '../../../lib/attendanceApi';

import { canRetry, isExpired, nextRetryIso } from './offlineRetryEngine';
import { listOfflineQueue, removeOfflineItem, updateOfflineItem } from './offlineQueue';

const MAX_RETRIES = 8;

export async function syncOfflineAttendanceQueue() {
  const items = await listOfflineQueue();
  for (const item of items) {
    if (!canRetry(item.next_retry_at)) continue;
    if (isExpired(item.captured_at, 12)) {
      await removeOfflineItem(item.offline_id);
      continue;
    }
    try {
      await markAttendance({
        employeeId: item.employee_id,
        faceSessionToken: '', // offline queue never stores reusable session tokens
        deviceId: item.device_id,
        embeddingVersion: item.embedding_version,
        scanLatitude: item.lat,
        scanLongitude: item.lng,
        shopId: item.shop_id,
        punchType: item.punch_type === 'out' ? 'out' : 'in',
        idempotencyKey: item.idempotency_key?.trim() || undefined,
        offlineId: item.offline_id,
        capturedAtIso: item.captured_at,
        integritySnapshot: item.integrity_snapshot,
        riskSnapshot: item.risk_snapshot,
        offlineSignature: item.signature,
        attestationToken: item.attestation_token ?? null,
        attestationValid: item.attestation_valid ?? null,
        devicePublicKey: item.device_public_key ?? null,
        deviceSignature: item.signature,
      });
      await removeOfflineItem(item.offline_id);
    } catch {
      const retries = item.retries + 1;
      if (retries >= MAX_RETRIES) {
        await removeOfflineItem(item.offline_id);
        continue;
      }
      await updateOfflineItem({
        ...item,
        retries,
        next_retry_at: nextRetryIso(retries),
      });
    }
  }
}
