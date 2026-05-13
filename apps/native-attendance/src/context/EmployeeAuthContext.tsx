import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../supabase';
import { stopTracking } from '../locationService';
import { clearOfflineQueue } from '../modules/offline/lib/offlineQueue';
import { clearOfflineReplayGuard } from '../modules/offline/lib/offlineReplayGuard';
import { clearOfflineEncryptionKeys } from '../modules/offline/lib/offlineEncryption';
import { useApp } from './AppContext';

export type EmployeeAuthProfile = {
  auth_user_id: string;
  employee_id: string;
  status: 'active' | 'disabled';
  phone: string;
};

type EmployeeAuthContextValue = {
  session: Session | null;
  profile: EmployeeAuthProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signInWithFaceEmployee: (employeeId: string) => Promise<void>;
  signInWithCardAndPassword: (cardNoOrUuid: string, password: string) => Promise<void>;
  sendOtpForCardLogin: (cardNoOrUuid: string) => Promise<string>;
  verifyOtpForCardLogin: (phone: string, otp: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const EmployeeAuthContext = createContext<EmployeeAuthContextValue | undefined>(undefined);

async function loadMyProfile(): Promise<EmployeeAuthProfile | null> {
  const sb = supabase;
  if (!sb) return null;
  const { data, error } = await sb
    .from('employee_auth_profiles')
    .select('auth_user_id, employee_id, status, phone')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.employee_id) return null;
  return {
    auth_user_id: String(data.auth_user_id),
    employee_id: String(data.employee_id),
    status: data.status === 'disabled' ? 'disabled' : 'active',
    phone: String(data.phone ?? ''),
  };
}

export function EmployeeAuthProvider({ children }: { children: ReactNode }) {
  const { setEmployeeId, setStage, setFaceSession, clearRegistration } = useApp();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<EmployeeAuthProfile | null>(null);
  const [localFaceEmployeeId, setLocalFaceEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const sb = supabase;
    if (!sb) return;
    const p = await loadMyProfile();
    setProfile(p);
    if (p?.employee_id) {
      await setEmployeeId(p.employee_id);
    }
    if (p?.status === 'disabled') {
      await sb.auth.signOut();
      setStage('splash');
      throw new Error('Your account is disabled. Contact HR.');
    }
  }, [setEmployeeId, setStage]);

  useEffect(() => {
    const sb = supabase;
    if (!sb) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    sb.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      if (data.session) {
        try {
          await refreshProfile();
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    const { data } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        void refreshProfile();
      } else if (!localFaceEmployeeId) {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [localFaceEmployeeId, refreshProfile]);

  const signInWithFaceEmployee = useCallback(
    async (employeeId: string) => {
      const trimmed = String(employeeId ?? '').trim();
      if (!trimmed) throw new Error('Employee ID is required.');
      setLocalFaceEmployeeId(trimmed);
      setProfile({
        auth_user_id: `local-face:${trimmed}`,
        employee_id: trimmed,
        status: 'active',
        phone: '',
      });
      await setEmployeeId(trimmed);
      setStage('dashboard');
    },
    [setEmployeeId, setStage],
  );

  const resolvePhoneForCardLogin = useCallback(async (cardNoOrUuid: string) => {
    const sb = supabase;
    if (!sb) throw new Error('Supabase configuration missing in .env.');
    const raw = String(cardNoOrUuid ?? '').trim();
    if (!raw) throw new Error('Card number is required.');
    const { data: phone, error: phoneErr } = await sb.rpc('mobile_lookup_employee_phone_for_login', {
      p_card_no: raw,
    });
    if (phoneErr) throw new Error(phoneErr.message);
    const phoneStr = String(phone ?? '').trim();
    if (!phoneStr) throw new Error('Employee phone not set or employee not found. Contact HR.');
    return phoneStr;
  }, []);

  const signInWithCardAndPassword = useCallback(async (cardNoOrUuid: string, password: string) => {
    const sb = supabase;
    if (!sb) throw new Error('Supabase configuration missing in .env.');
    const phoneStr = await resolvePhoneForCardLogin(cardNoOrUuid);
    const { error } = await sb.auth.signInWithPassword({ phone: phoneStr, password });
    if (error) throw new Error(error.message);
  }, [resolvePhoneForCardLogin]);

  const sendOtpForCardLogin = useCallback(async (cardNoOrUuid: string) => {
    const sb = supabase;
    if (!sb) throw new Error('Supabase configuration missing in .env.');
    const phoneStr = await resolvePhoneForCardLogin(cardNoOrUuid);
    const { error } = await sb.auth.signInWithOtp({
      phone: phoneStr,
    });
    if (error) throw new Error(error.message);
    return phoneStr;
  }, [resolvePhoneForCardLogin]);

  const verifyOtpForCardLogin = useCallback(async (phone: string, otp: string) => {
    const sb = supabase;
    if (!sb) throw new Error('Supabase configuration missing in .env.');
    const phoneStr = String(phone ?? '').trim();
    const token = String(otp ?? '').trim();
    if (!phoneStr) throw new Error('Phone not found for this employee.');
    if (!token) throw new Error('OTP is required.');
    const { error } = await sb.auth.verifyOtp({
      phone: phoneStr,
      token,
      type: 'sms',
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    const sb = supabase;
    if (!sb) return;
    await stopTracking();
    await clearOfflineQueue();
    clearOfflineReplayGuard();
    await clearOfflineEncryptionKeys();
    await clearRegistration();
    setFaceSession(null, null);
    await sb.auth.signOut();
    setSession(null);
    setLocalFaceEmployeeId(null);
    setProfile(null);
    setStage('splash');
  }, [clearRegistration, setFaceSession, setStage]);

  useEffect(() => {
    const sb = supabase;
    if (!sb || !profile?.employee_id || !profile.auth_user_id) return;

    const channel = sb
      .channel(`employee-security-${profile.employee_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_devices',
          filter: `employee_id=eq.${profile.employee_id}`,
        },
        async (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
          if (!row) return;
          const blocked = row.blocked === true;
          const revoked = row.revoked_at != null;
          if (blocked || revoked) {
            await signOut();
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_auth_profiles',
          filter: `auth_user_id=eq.${profile.auth_user_id}`,
        },
        async (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
          if (!row) return;
          if (String(row.status ?? '').toLowerCase() === 'disabled') {
            await signOut();
          }
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [profile?.auth_user_id, profile?.employee_id, signOut]);

  const value = useMemo<EmployeeAuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      isAuthenticated: Boolean(session) || Boolean(localFaceEmployeeId),
      signInWithFaceEmployee,
      signInWithCardAndPassword,
      sendOtpForCardLogin,
      verifyOtpForCardLogin,
      signOut,
      refreshProfile,
    }),
    [
      loading,
      localFaceEmployeeId,
      profile,
      refreshProfile,
      signInWithFaceEmployee,
      sendOtpForCardLogin,
      session,
      signInWithCardAndPassword,
      signOut,
      verifyOtpForCardLogin,
    ],
  );

  return <EmployeeAuthContext.Provider value={value}>{children}</EmployeeAuthContext.Provider>;
}

export function useEmployeeAuth() {
  const ctx = useContext(EmployeeAuthContext);
  if (!ctx) throw new Error('useEmployeeAuth must be used inside EmployeeAuthProvider');
  return ctx;
}
