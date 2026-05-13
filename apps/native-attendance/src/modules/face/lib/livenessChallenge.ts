export type LivenessChallengeType =
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'MOVE_CLOSER'
  | 'MOVE_AWAY'
  | 'BLINK_TWICE';

export type LivenessChallenge = {
  type: LivenessChallengeType;
  issuedAtMs: number;
  expiresAtMs: number;
};

const CHALLENGES: LivenessChallengeType[] = [
  'TURN_LEFT',
  'TURN_RIGHT',
  'MOVE_CLOSER',
  'MOVE_AWAY',
  'BLINK_TWICE',
];

export function createRandomChallenge(nowMs = Date.now(), ttlMs = 4500): LivenessChallenge {
  const type = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]!;
  return {
    type,
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + ttlMs,
  };
}

export function challengeInstruction(c: LivenessChallengeType): string {
  switch (c) {
    case 'TURN_LEFT':
      return 'Turn your head LEFT, then capture 3 photos.';
    case 'TURN_RIGHT':
      return 'Turn your head RIGHT, then capture 3 photos.';
    case 'MOVE_CLOSER':
      return 'Move CLOSER to the camera, then capture 3 photos.';
    case 'MOVE_AWAY':
      return 'Move AWAY from the camera, then capture 3 photos.';
    case 'BLINK_TWICE':
      return 'Blink TWICE naturally, then capture 3 photos.';
    default:
      return 'Follow the challenge, then capture 3 photos.';
  }
}
