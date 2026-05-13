import { getOrCreateDeviceKeypair } from './keypair';
import { buildDeviceFingerprint } from './deviceFingerprint';

export async function getDeviceIdentityContext() {
  const [keys, fingerprint] = await Promise.all([getOrCreateDeviceKeypair(), buildDeviceFingerprint()]);
  return {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    fingerprint,
  };
}
