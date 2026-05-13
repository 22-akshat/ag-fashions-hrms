import EncryptedStorage from 'react-native-encrypted-storage';

const PUB_KEY = 'enterprise_device_public_key_v1';
const PRIV_KEY = 'enterprise_device_private_key_v1';

export async function getStoredDeviceKeys() {
  const [publicKey, privateKey] = await Promise.all([
    EncryptedStorage.getItem(PUB_KEY),
    EncryptedStorage.getItem(PRIV_KEY),
  ]);
  return { publicKey, privateKey };
}

export async function setStoredDeviceKeys(input: { publicKey: string; privateKey: string }) {
  await Promise.all([
    EncryptedStorage.setItem(PUB_KEY, input.publicKey),
    EncryptedStorage.setItem(PRIV_KEY, input.privateKey),
  ]);
}

export async function clearStoredDeviceKeys() {
  await Promise.all([EncryptedStorage.removeItem(PUB_KEY), EncryptedStorage.removeItem(PRIV_KEY)]);
}
