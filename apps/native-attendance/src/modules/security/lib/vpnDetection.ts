import NetInfo from '@react-native-community/netinfo';

export async function detectVpn(): Promise<{ vpn: boolean; reason: string | null }> {
  try {
    const state = await NetInfo.fetch();
    const details = state.details;
    const ip =
      details &&
      typeof details === 'object' &&
      'ipAddress' in details &&
      typeof (details as { ipAddress?: unknown }).ipAddress === 'string'
        ? String((details as { ipAddress?: string }).ipAddress)
        : '';
    const probableVpn = state.isConnected === true && (state.type === 'unknown' || state.type === 'other');
    if (probableVpn) {
      return { vpn: true, reason: `network_state_uncertain:${ip || 'ip_unavailable'}` };
    }
    return { vpn: false, reason: null };
  } catch (e) {
    return { vpn: false, reason: `vpn_detection_unavailable:${String(e)}` };
  }
}
