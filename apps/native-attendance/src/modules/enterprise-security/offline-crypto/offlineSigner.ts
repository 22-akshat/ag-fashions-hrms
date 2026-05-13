import { deriveOfflineSigningKey } from './offlineKeyDerivation';

export function signOfflinePayloadV2(input: {
  payload: Record<string, unknown>;
  privateKey: string;
  installId: string;
  deviceId: string;
  timestamp: string;
}) {
  const key = deriveOfflineSigningKey(input.privateKey, input.installId);
  const raw =
    JSON.stringify(input.payload) + '::' + input.deviceId + '::' + input.timestamp + '::' + key;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `sig_v2_${(hash >>> 0).toString(16)}`;
}
