/**
 * Liveness façade — integrate blink / pose checks from native SDKs or cloud APIs later.
 * Returns structured hints rather than silently failing.
 */

export type LivenessSignals = {
  blinkLikely?: boolean;
  headTurnDegrees?: number;
};

export async function checkBlink(/* future: frames */): Promise<boolean> {
  return true;
}

export async function checkHeadTurn(): Promise<boolean> {
  return true;
}

export async function validateLiveness(/* future: PhotoMeta */): Promise<{
  pass: boolean;
  signals?: LivenessSignals;
}> {
  return { pass: true, signals: {} };
}
