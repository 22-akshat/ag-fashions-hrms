import { signOfflinePayloadV2 } from './offlineSigner';

export function verifyOfflinePayloadV2(input: {
  payload: Record<string, unknown>;
  privateKey: string;
  installId: string;
  deviceId: string;
  timestamp: string;
  signature: string;
}) {
  const expected = signOfflinePayloadV2({
    payload: input.payload,
    privateKey: input.privateKey,
    installId: input.installId,
    deviceId: input.deviceId,
    timestamp: input.timestamp,
  });
  return expected === input.signature;
}
