export function detectMockLocation(input: { mocked?: boolean | null; accuracy?: number | null }): {
  mockGps: boolean;
  reason: string | null;
} {
  if (input.mocked === true) {
    return { mockGps: true, reason: 'coords_mocked_true' };
  }
  const accuracy = Number(input.accuracy ?? NaN);
  if (Number.isFinite(accuracy) && accuracy > 1500) {
    return { mockGps: true, reason: `implausible_accuracy:${accuracy}` };
  }
  return { mockGps: false, reason: null };
}
