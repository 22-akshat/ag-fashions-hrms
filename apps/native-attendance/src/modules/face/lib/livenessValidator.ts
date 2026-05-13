import RNFS from 'react-native-fs';

import type { LivenessChallengeType } from './livenessChallenge';

export type LivenessFrame = {
  uri: string;
  capturedAtMs: number;
};

export type LivenessValidationResult = {
  ok: boolean;
  confidence: number; // 0..1 heuristic
  reason?: string;
  metrics: {
    frameCount: number;
    durationMs: number;
    uniqueFrameRatio: number;
    faceDetectedFrames?: number;
    liveFrames?: number;
  };
};

type FaceDetectionModule = {
  checkLiveness?: (imageBase64: string) => Promise<{ faceDetected?: boolean; isLive?: boolean }>;
};

async function tryLoadFD(): Promise<FaceDetectionModule | null> {
  return null;
}

async function uriToBase64(uri: string): Promise<string> {
  const path = uri.startsWith('file://') ? uri.replace(/^file:\/\//, '') : uri;
  return RNFS.readFile(path, 'base64');
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function clamp01(n: number): number {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/**
 * Phase-3: lightweight liveness heuristics.
 *
 * Constraints:
 * - No heavy ML. Uses optional native liveness probe if available.
 * - Ensures temporal sequence and rejects identical/replayed frames.
 *
 * This is NOT a cryptographic anti-spoof guarantee; it raises the bar for static photo replays.
 */
export async function validateLivenessSequence(input: {
  challenge: LivenessChallengeType;
  frames: LivenessFrame[];
  nowMs?: number;
}): Promise<LivenessValidationResult> {
  const nowMs = input.nowMs ?? Date.now();
  const frames = [...(input.frames ?? [])].sort((a, b) => a.capturedAtMs - b.capturedAtMs);

  if (frames.length < 3) {
    return {
      ok: false,
      confidence: 0,
      reason: 'NEED_MORE_FRAMES',
      metrics: { frameCount: frames.length, durationMs: 0, uniqueFrameRatio: 0 },
    };
  }

  const durationMs = frames[frames.length - 1]!.capturedAtMs - frames[0]!.capturedAtMs;
  if (durationMs < 600) {
    return {
      ok: false,
      confidence: 0,
      reason: 'TOO_FAST',
      metrics: { frameCount: frames.length, durationMs, uniqueFrameRatio: 0 },
    };
  }
  if (durationMs > 6000) {
    return {
      ok: false,
      confidence: 0,
      reason: 'TOO_SLOW',
      metrics: { frameCount: frames.length, durationMs, uniqueFrameRatio: 0 },
    };
  }

  const base64s = await Promise.all(frames.map((f) => uriToBase64(f.uri)));
  const hashes = base64s.map((b64) => fnv1a32(b64.slice(0, 20000)));
  const uniqueHashes = new Set(hashes);
  const uniqueFrameRatio = uniqueHashes.size / hashes.length;
  if (uniqueHashes.size < 2) {
    return {
      ok: false,
      confidence: 0,
      reason: 'FRAMES_NOT_UNIQUE',
      metrics: { frameCount: frames.length, durationMs, uniqueFrameRatio },
    };
  }

  const FD = await tryLoadFD();
  let faceDetectedFrames = 0;
  let liveFrames = 0;
  if (FD?.checkLiveness) {
    for (const b64 of base64s) {
      try {
        const r = await FD.checkLiveness(b64);
        if (r?.faceDetected) faceDetectedFrames += 1;
        if (r?.isLive) liveFrames += 1;
      } catch {
        // ignore per-frame failures
      }
    }
    if (faceDetectedFrames === 0) {
      return {
        ok: false,
        confidence: 0,
        reason: 'NO_FACE_DETECTED',
        metrics: { frameCount: frames.length, durationMs, uniqueFrameRatio, faceDetectedFrames, liveFrames },
      };
    }
  }

  const temporalScore = clamp01((durationMs - 600) / 2500);
  const uniqScore = clamp01((uniqueFrameRatio - 0.5) / 0.5);
  const liveScore =
    typeof liveFrames === 'number' && frames.length > 0 ? clamp01(liveFrames / frames.length) : 0.4;

  let confidence = 0.45 * uniqScore + 0.35 * temporalScore + 0.2 * liveScore;

  if (input.challenge === 'BLINK_TWICE' && FD?.checkLiveness) {
    confidence += 0.05;
  }

  confidence = clamp01(confidence);

  const ok = confidence >= 0.55 && uniqueHashes.size >= 3;

  return {
    ok,
    confidence,
    reason: ok ? undefined : 'LIVENESS_FAILED',
    metrics: {
      frameCount: frames.length,
      durationMs,
      uniqueFrameRatio,
      faceDetectedFrames: FD?.checkLiveness ? faceDetectedFrames : undefined,
      liveFrames: FD?.checkLiveness ? liveFrames : undefined,
    },
  };
}
