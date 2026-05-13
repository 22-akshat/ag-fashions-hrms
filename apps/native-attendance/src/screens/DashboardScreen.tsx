import { calculateAttendanceClassification } from '@ag-fashions/shared/attendance/shiftClassification';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useApp } from '../context/AppContext';
import { useEmployeeAuth } from '../context/EmployeeAuthContext';
import {
  fetchEmployeeDashboardSnapshot,
  fetchMyAttendancePage,
  type DashboardSnapshot,
  type MyAttendanceRow,
} from '../lib/employeeDashboardApi';
import { supabase } from '../supabase';
import { hrTheme } from '../theme/hrTheme';

const IST_TZ = 'Asia/Kolkata';

function istCalendarDayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function istMonthYearKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
  }).format(d);
}

function formatIstDateTime(d: Date): string {
  return d.toLocaleString('en-IN', { timeZone: IST_TZ, dateStyle: 'medium', timeStyle: 'short' });
}

export default function DashboardScreen() {
  const { setStage, setPunchIntent, refreshShopFence, registeredFaceUri } = useApp();
  const { profile, signOut } = useEmployeeAuth();
  const isLocalFaceOnly = Boolean(profile?.auth_user_id?.startsWith('local-face:'));
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null);
  const [rows, setRows] = useState<MyAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (isLocalFaceOnly) {
      setSnap(null);
      setRows([]);
      try {
        await refreshShopFence();
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      const [s, r] = await Promise.all([
        fetchEmployeeDashboardSnapshot(),
        fetchMyAttendancePage({ limit: 80 }),
      ]);
      setSnap(s);
      setRows(r);
      await refreshShopFence();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [refreshShopFence, isLocalFaceOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sb = supabase;
    const empId = profile?.employee_id;
    if (!sb || !empId || isLocalFaceOnly) return;

    const ch = sb
      .channel(`employee-dash-${empId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_logs',
          filter: `employee_id=eq.${empId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_access_requests',
          filter: `employee_id=eq.${empId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(ch);
    };
  }, [load, profile?.employee_id, isLocalFaceOnly]);

  const todayKey = useMemo(() => istCalendarDayKey(nowTick), [nowTick]);
  const monthKeyNow = useMemo(() => istMonthYearKey(nowTick), [nowTick]);

  const todayRows = useMemo(
    () =>
      rows.filter(
        (r) => Number.isFinite(Date.parse(r.ts)) && istCalendarDayKey(new Date(r.ts)) === todayKey,
      ),
    [rows, todayKey],
  );

  const todayIn = useMemo(() => todayRows.find((r) => r.punch_type === 'in'), [todayRows]);
  const todayOut = useMemo(() => todayRows.find((r) => r.punch_type === 'out'), [todayRows]);

  const dayClass = useMemo(() => {
    return calculateAttendanceClassification({
      shiftStart: snap?.intime,
      shiftEnd: snap?.outtime,
      markInTime: todayIn?.ts ? new Date(todayIn.ts) : null,
      markOutTime: todayOut?.ts ? new Date(todayOut.ts) : null,
      timeZone: IST_TZ,
    });
  }, [snap?.intime, snap?.outtime, todayIn?.ts, todayOut?.ts]);

  const reqStatus = snap?.latest_access_request?.status
    ? String(snap.latest_access_request.status).toLowerCase().trim()
    : '';

  const hrBadgeStyle = useMemo(() => {
    if (reqStatus === 'approved') return styles.hrApproved;
    if (reqStatus === 'rejected') return styles.hrRejected;
    if (reqStatus === 'pending') return styles.hrPending;
    return styles.hrNeutral;
  }, [reqStatus]);

  const monthCounts = useMemo(() => {
    let present = 0;
    let late = 0;
    let earlyExit = 0;
    let absentish = 0;
    for (const r of rows) {
      const d = new Date(r.ts);
      if (!Number.isFinite(d.getTime())) continue;
      if (istMonthYearKey(d) !== monthKeyNow) continue;
      const st = String(r.status ?? '').toLowerCase();
      if (st === 'late') late += 1;
      else if (st === 'early_exit') earlyExit += 1;
      else if (st === 'absent') absentish += 1;
      else if (st === 'present') present += 1;
    }
    return { present, late, earlyExit, absentish, loaded: rows.length };
  }, [rows, monthKeyNow]);

  const remotePhoto = snap?.profile_photo_url?.trim();
  const showRemotePhoto = Boolean(remotePhoto && /^https?:\/\//i.test(remotePhoto));
  const showLocalPhoto = Boolean(registeredFaceUri && !showRemotePhoto);

  const displayName = snap?.full_name?.trim() || profile?.employee_id || 'Employee';

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Attendance</Text>
          <Text style={styles.clock}>{formatIstDateTime(nowTick)} IST</Text>
        </View>
        <Pressable style={styles.logoutBtn} onPress={() => void signOut()}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={hrTheme.brandOrange} />
          <Text style={styles.loadingMeta}>Loading your dashboard…</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errTitle}>Could not load</Text>
          <Text style={styles.err}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {isLocalFaceOnly ? (
        <View style={styles.warnCard}>
          <Text style={styles.warnTitle}>Phone sign-in for full dashboard</Text>
          <Text style={styles.warnBody}>
            Face unlock worked on this device. For HR status, attendance history, and monthly summary, sign in with SMS
            OTP from Register, then open the app again.
          </Text>
          <Pressable
            style={styles.primary}
            onPress={() => {
              void signOut();
              setStage('splash');
            }}
          >
            <Text style={styles.primaryText}>Go to login</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          {showRemotePhoto ? (
            <Image source={{ uri: remotePhoto! }} style={styles.avatar} resizeMode="cover" />
          ) : showLocalPhoto ? (
            <Image source={{ uri: registeredFaceUri! }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>{displayName.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={styles.profileText}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.metaLine}>Shop · {snap?.shop_name?.trim() || '—'}</Text>
          <Text style={styles.metaLine}>
            Shift · {snap?.intime || '—'} – {snap?.outtime || '—'}
          </Text>
        </View>
      </View>

      {!isLocalFaceOnly && reqStatus ? (
        <View style={[styles.hrCard, hrBadgeStyle]}>
          <Text style={styles.hrLabel}>HR registration</Text>
          <Text style={styles.hrStatus}>{reqStatus.toUpperCase()}</Text>
          <Text style={styles.hrHint}>
            {reqStatus === 'pending' && 'Waiting for HR. This updates automatically.'}
            {reqStatus === 'approved' && 'You can mark attendance from this device.'}
            {reqStatus === 'rejected' && 'Contact HR if you need access again.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.statusCard}>
        <Text style={styles.cardTitle}>Today</Text>
        <Text style={styles.dayStatusMain}>{String(dayClass.dayStatus).replace('_', ' ')}</Text>
        <Text style={styles.punchLine}>
          IN {todayIn ? new Date(todayIn.ts).toLocaleTimeString('en-IN', { timeZone: IST_TZ }) : '—'} · OUT{' '}
          {todayOut ? new Date(todayOut.ts).toLocaleTimeString('en-IN', { timeZone: IST_TZ }) : '—'}
        </Text>
        <View style={styles.badgeRow}>
          {dayClass.inStatus === 'late' ? (
            <View style={[styles.badge, styles.badgeLate]}>
              <Text style={styles.badgeText}>Late</Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgeOk]}>
              <Text style={styles.badgeText}>On time IN</Text>
            </View>
          )}
          {todayOut && dayClass.outStatus === 'early_exit' ? (
            <View style={[styles.badge, styles.badgeEarly]}>
              <Text style={styles.badgeText}>Early exit</Text>
            </View>
          ) : todayOut ? (
            <View style={[styles.badge, styles.badgeOk]}>
              <Text style={styles.badgeText}>Normal OUT</Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgeMuted]}>
              <Text style={styles.badgeText}>No OUT yet</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.row}>
        <Pressable
          style={[styles.markBtn, styles.markIn]}
          onPress={() => {
            setPunchIntent('in');
            setStage('scan');
          }}
        >
          <Text style={styles.markBtnTitle}>Mark IN</Text>
          <Text style={styles.markBtnSub}>Face verify</Text>
        </Pressable>
        <Pressable
          style={[styles.markBtn, styles.markOut]}
          onPress={() => {
            setPunchIntent('out');
            setStage('scan');
          }}
        >
          <Text style={styles.markBtnTitle}>Mark OUT</Text>
          <Text style={styles.markBtnSub}>Face verify</Text>
        </Pressable>
      </View>

      {!isLocalFaceOnly ? (
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>This month (IST)</Text>
          <Text style={styles.summaryLine}>Present rows · {monthCounts.present}</Text>
          <Text style={styles.summaryLine}>Late · {monthCounts.late}</Text>
          <Text style={styles.summaryLine}>Early exit · {monthCounts.earlyExit}</Text>
          <Text style={styles.summaryHint}>Based on loaded punches ({monthCounts.loaded}). Pull refresh for more.</Text>
        </View>
      ) : null}

      {!isLocalFaceOnly ? (
        <>
          <Text style={styles.section}>Latest punches</Text>
          <View style={styles.historyCard}>
            {rows.slice(0, 12).length === 0 ? (
              <Text style={styles.emptyHist}>No punches yet this session.</Text>
            ) : (
              rows.slice(0, 12).map((r) => (
                <View key={r.id} style={styles.logRow}>
                  <Text style={styles.logPunch}>{r.punch_type === 'out' ? 'OUT' : 'IN'}</Text>
                  <View style={styles.logMid}>
                    <Text style={styles.logStatus}>{r.status}</Text>
                    <Text style={styles.logTime}>
                      {Number.isFinite(Date.parse(r.ts))
                        ? new Date(r.ts).toLocaleString('en-IN', { timeZone: IST_TZ })
                        : r.ts}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}

      <Pressable style={styles.secondary} onPress={() => void load()}>
        <Text style={styles.secondaryText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 56, gap: 12, backgroundColor: hrTheme.bg },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '800', color: hrTheme.navyTitle },
  clock: { fontSize: 12, color: hrTheme.textMuted, marginTop: 2 },
  logoutBtn: {
    backgroundColor: hrTheme.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hrTheme.border,
  },
  logoutText: { fontWeight: '800', color: hrTheme.brandOrangeDark, fontSize: 13 },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: hrTheme.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hrTheme.border,
  },
  loadingMeta: { color: hrTheme.textMuted, fontSize: 13 },
  errorCard: {
    backgroundColor: hrTheme.dangerSoft,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 6,
  },
  errTitle: { fontWeight: '800', color: hrTheme.danger },
  err: { color: hrTheme.danger, fontSize: 13 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: hrTheme.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  warnCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hrTheme.warningBorder,
    padding: 14,
    backgroundColor: hrTheme.warningBg,
    gap: 8,
  },
  warnTitle: { fontSize: 15, fontWeight: '800', color: hrTheme.navyTitle },
  warnBody: { fontSize: 13, color: hrTheme.navyMuted, lineHeight: 18 },
  profileCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: hrTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: hrTheme.border,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: hrTheme.borderSoft,
  },
  avatar: { width: 72, height: 72 },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hrTheme.accentTeal,
  },
  avatarLetter: { fontSize: 28, fontWeight: '800', color: hrTheme.navyTitle },
  profileText: { flex: 1, gap: 4 },
  name: { fontSize: 18, fontWeight: '800', color: hrTheme.navyTitle },
  metaLine: { fontSize: 13, color: hrTheme.textMuted },
  hrCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 4,
  },
  hrNeutral: { backgroundColor: hrTheme.surfaceElevated, borderColor: hrTheme.border },
  hrPending: { backgroundColor: hrTheme.warningBg, borderColor: hrTheme.warningBorder },
  hrApproved: { backgroundColor: hrTheme.successSoft, borderColor: '#6ee7b7' },
  hrRejected: { backgroundColor: hrTheme.dangerSoft, borderColor: '#fca5a5' },
  hrLabel: { fontSize: 12, fontWeight: '700', color: hrTheme.textMuted, textTransform: 'uppercase' },
  hrStatus: { fontSize: 20, fontWeight: '900', color: hrTheme.navyTitle },
  hrHint: { fontSize: 13, color: hrTheme.navyMuted, marginTop: 4 },
  statusCard: {
    backgroundColor: hrTheme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: hrTheme.border,
    gap: 8,
  },
  cardTitle: { fontSize: 12, fontWeight: '800', color: hrTheme.textMuted, letterSpacing: 0.5 },
  dayStatusMain: { fontSize: 22, fontWeight: '900', color: hrTheme.navyTitle, textTransform: 'capitalize' },
  punchLine: { fontSize: 14, color: hrTheme.navyMuted, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeOk: { backgroundColor: hrTheme.successSoft },
  badgeLate: { backgroundColor: hrTheme.dangerSoft },
  badgeEarly: { backgroundColor: hrTheme.warningBg },
  badgeMuted: { backgroundColor: hrTheme.surfaceElevated },
  badgeText: { fontSize: 12, fontWeight: '800', color: hrTheme.navyTitle },
  row: { flexDirection: 'row', gap: 10 },
  markBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  markIn: { backgroundColor: hrTheme.brandOrange },
  markOut: { backgroundColor: hrTheme.navyMuted },
  markBtnTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  markBtnSub: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },
  summaryCard: {
    backgroundColor: hrTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: hrTheme.border,
    gap: 4,
  },
  summaryLine: { fontSize: 14, color: hrTheme.navyMuted, fontWeight: '600' },
  summaryHint: { fontSize: 11, color: hrTheme.textSoft, marginTop: 6 },
  section: { fontSize: 14, fontWeight: '800', color: hrTheme.navyTitle, marginTop: 4 },
  historyCard: {
    backgroundColor: hrTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: hrTheme.border,
    overflow: 'hidden',
  },
  emptyHist: { padding: 16, color: hrTheme.textSoft, fontSize: 14 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: hrTheme.borderLight,
    gap: 12,
  },
  logPunch: { fontSize: 13, fontWeight: '900', color: hrTheme.navyTitle, width: 36 },
  logMid: { flex: 1 },
  logStatus: { fontSize: 14, fontWeight: '700', color: hrTheme.navyMuted, textTransform: 'capitalize' },
  logTime: { fontSize: 12, color: hrTheme.textSoft, marginTop: 2 },
  primary: {
    marginTop: 4,
    backgroundColor: hrTheme.brandOrange,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondary: {
    borderWidth: 1,
    borderColor: hrTheme.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: hrTheme.surface,
  },
  secondaryText: { color: hrTheme.navyMuted, fontWeight: '700' },
});
