import { trackLocalScanBehavior } from './localBehaviorTracker';

export function collectRiskSignals(input: {
  integrityFail: boolean;
  mockGps: boolean;
  emulator: boolean;
  vpn: boolean;
  rooted: boolean;
}) {
  const behavior = trackLocalScanBehavior();
  return {
    ...input,
    rapidMovement: behavior.rapid,
  };
}
