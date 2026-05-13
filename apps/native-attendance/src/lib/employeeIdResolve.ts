import { supabase } from '../supabase';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cache = new Map<string, string | null>();

export async function resolveEmployeeUuidForSupabase(
  employeeIdOrCardNo: string,
): Promise<string | null> {
  const raw = String(employeeIdOrCardNo ?? '').trim();
  if (!raw) return null;
  if (UUID_RE.test(raw)) return raw;

  if (cache.has(raw)) return cache.get(raw) ?? null;
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('mobile_lookup_active_employee_by_card', {
    p_card_no: raw,
  });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  const id = rows[0]?.id ? String(rows[0].id) : null;
  cache.set(raw, id);
  return id;
}

export async function invalidateEmployeeUuidCache(): Promise<void> {
  cache.clear();
}

export async function resolveEmployeeId(employeeIdOrCardNo: string): Promise<string | null> {
  return resolveEmployeeUuidForSupabase(employeeIdOrCardNo);
}
