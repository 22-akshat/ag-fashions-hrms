import DeviceInfo from 'react-native-device-info';

import { getOrCreateDeviceInstallId } from '../../../lib/deviceId';

export async function buildDeviceFingerprint() {
  const installId = await getOrCreateDeviceInstallId();
  return {
    installId,
    brand: DeviceInfo.getBrand(),
    modelName: DeviceInfo.getModel(),
    osName: DeviceInfo.getSystemName(),
    osVersion: DeviceInfo.getSystemVersion(),
    appId: DeviceInfo.getBundleId(),
  };
}
