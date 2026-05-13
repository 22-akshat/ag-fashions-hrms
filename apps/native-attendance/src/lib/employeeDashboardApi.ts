import { supabase } from '../supabase';

export type DashboardSnapshot = {
  employee_id: string;
  full_name: string;
  intime: string;
  outtime: string;
  shop_id: string | null;
  shop_name: string;
  /** Public URL or storage path from employees.personel_image */
  profile_photo_url: string;
  latest_access_request: {
    status: string;
    requested_shop_id: string | null;
    created_at: string;
  } | null;
};

export type MyAttendanceRow = {
  id: string;
  ts: string;
  punch_type: string;
  status: string;
  face_verified: boolean;
  shop_id: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function fetchEmployeeDashboardSnapshot(): Promise<DashboardSnapshot | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('employee_dashboard_snapshot');
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') return null;
  const j = data as Record<string, unknown>;
  return {
    employee_id: String(j.employee_id ?? ''),
    full_name: String(j.full_name ?? ''),
    intime: String(j.intime ?? ''),
    outtime: String(j.outtime ?? ''),
    shop_id: j.shop_id != null ? String(j.shop_id) : null,
    shop_name: String(j.shop_name ?? ''),
    profile_photo_url: String(j.profile_photo_url ?? ''),
    latest_access_request:
      j.latest_access_request && typeof j.latest_access_request === 'object'
        ? (j.latest_access_request as DashboardSnapshot['latest_access_request'])
        : null,
  };
}

export async function fetchMyAttendancePage(params: {
  limit?: number;
  before?: string | null;
}): Promise<MyAttendanceRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('employee_list_my_attendance', {
    p_limit: params.limit ?? 40,
    p_before: params.before ?? null,
  });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  return rows.map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ''),
    ts: String(r.ts ?? ''),
    punch_type: String(r.punch_type ?? 'in'),
    status: String(r.status ?? ''),
    face_verified: Boolean(r.face_verified),
    shop_id: r.shop_id != null ? String(r.shop_id) : null,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
  }));
}
