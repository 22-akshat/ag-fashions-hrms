import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { challengeInstruction, createRandomChallenge, type LivenessChallenge } from '../lib/livenessChallenge';
import { validateLivenessSequence, type LivenessFrame, type LivenessValidationResult } from '../lib/livenessValidator';

type Phase = 'idle' | 'collecting' | 'validating' | 'passed' | 'failed' | 'cooldown';

type Options = {
  framesNeeded?: number;
  challengeTtlMs?: number;
  timeoutMs?: number;
  cooldownMs?: number;
};

export function useLivenessCheck(options?: Options) {
  const framesNeeded = options?.framesNeeded ?? 3;
  const challengeTtlMs = options?.challengeTtlMs ?? 4500;
  const timeoutMs = options?.timeoutMs ?? 5500;
  const cooldownMs = options?.cooldownMs ?? 7000;

  const [phase, setPhase] = useState<Phase>('idle');
  const [challenge, setChallenge] = useState<LivenessChallenge | null>(null);
  const [frames, setFrames] = useState<LivenessFrame[]>([]);
  const [result, setResult] = useState<LivenessValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startedAtMsRef = useRef<number | null>(null);
  const cooldownUntilRef = useRef<number>(0);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const instruction = useMemo(
    () => (challenge ? challengeInstruction(challenge.type) : 'Preparing liveness check…'),
    [challenge],
  );

  const progressText = useMemo(() => {
    const count = frames.length;
    if (phase === 'passed') return 'Liveness OK';
    if (phase === 'validating') return 'Checking liveness…';
    if (phase === 'cooldown') return 'Please wait a moment…';
    if (phase === 'failed') return 'Liveness failed. Retry.';
    if (phase === 'collecting') return `Capture frames: ${Math.min(count, framesNeeded)}/${framesNeeded}`;
    return '';
  }, [frames.length, framesNeeded, phase]);

  const reset = useCallback(() => {
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    timeoutTimerRef.current = null;
    startedAtMsRef.current = null;
    setPhase('idle');
    setChallenge(null);
    setFrames([]);
    setResult(null);
    setError(null);
  }, []);

  const start = useCallback(() => {
    const now = Date.now();
    if (now < cooldownUntilRef.current) {
      setPhase('cooldown');
      return;
    }

    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    timeoutTimerRef.current = null;

    startedAtMsRef.current = now;
    setResult(null);
    setError(null);
    setFrames([]);
    setChallenge(createRandomChallenge(now, challengeTtlMs));
    setPhase('collecting');

    timeoutTimerRef.current = setTimeout(() => {
      cooldownUntilRef.current = Date.now() + cooldownMs;
      setPhase('cooldown');
      setError('Timed out. Try again.');
    }, timeoutMs);
  }, [challengeTtlMs, cooldownMs, timeoutMs]);

  const retry = useCallback(() => {
    const now = Date.now();
    cooldownUntilRef.current = now + cooldownMs;
    setPhase('cooldown');
    setTimeout(() => {
      start();
    }, cooldownMs);
  }, [cooldownMs, start]);

  const addFrame = useCallback(
    async (uri: string) => {
      const now = Date.now();
      if (phase !== 'collecting' || !challenge) return;
      if (now < cooldownUntilRef.current) {
        setPhase('cooldown');
        return;
      }
      if (now > challenge.expiresAtMs) {
        setError('Challenge expired. Try again.');
        setPhase('failed');
        cooldownUntilRef.current = now + cooldownMs;
        return;
      }

      setFrames((prev) => {
        const next = [...prev, { uri, capturedAtMs: now }];
        return next.slice(-Math.max(framesNeeded, 3));
      });
    },
    [challenge, cooldownMs, framesNeeded, phase],
  );

  useEffect(() => {
    const run = async () => {
      if (phase !== 'collecting') return;
      if (!challenge) return;
      if (frames.length < framesNeeded) return;

      setPhase('validating');
      try {
        const r = await validateLivenessSequence({
          challenge: challenge.type,
          frames,
        });
        setResult(r);
        if (r.ok) {
          setPhase('passed');
          setError(null);
          if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
          timeoutTimerRef.current = null;
        } else {
          setPhase('failed');
          setError('Liveness failed. Avoid photos/screens and follow the instruction.');
          cooldownUntilRef.current = Date.now() + cooldownMs;
        }
      } catch (e) {
        setPhase('failed');
        setError(e instanceof Error ? e.message : 'Liveness failed');
        cooldownUntilRef.current = Date.now() + cooldownMs;
      }
    };
    void run();
  }, [challenge, cooldownMs, frames, framesNeeded, phase]);

  useEffect(() => {
    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    };
  }, []);

  const isReadyForSession = phase === 'passed' && Boolean(result?.ok);

  return {
    phase,
    challenge,
    frames,
    instruction,
    progressText,
    result,
    error,
    isReadyForSession,
    start,
    addFrame,
    retry,
    reset,
  };
}
