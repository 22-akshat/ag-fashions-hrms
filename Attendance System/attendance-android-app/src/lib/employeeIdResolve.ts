import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';

/** Matches Postgres UUID text format (management `employees.id`). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UUID_CACHE_KEY = 'attendance_employee_uuid_cache';

type UuidCache = { raw: string; uuid: string };

export function looksLikeEmployeeUuid(value: string): boolean {
  return UUID_RE.test(String(value ?? '').trim());
}

/** Normalize for Postgres (uuid type accepts lowercase hex). */
function normalizeUuid(value: string): string {
  return String(value ?? '').trim().toLowerCase();
}

export async function invalidateEmployeeUuidCache(): Promise<void> {
  await AsyncStorage.removeItem(UUID_CACHE_KEY);
}

/**
 * Converts card no. (or any `employees.card_no`) to UUID for FK columns (`employee_locations`, etc.).
 * Caches successful lookups while the entered raw id matches.
 */
export async function resolveEmployeeUuidForSupabase(rawInput: string): Promise<string | null> {
  const raw = String(rawInput ?? '').trim();
  if (!raw) return null;

  if (looksLikeEmployeeUuid(raw)) {
    return normalizeUuid(raw);
  }

  if (!supabase) return null;

  try {
    const cachedRaw = await AsyncStorage.getItem(UUID_CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as UuidCache;
      if (parsed?.raw === raw && parsed?.uuid && looksLikeEmployeeUuid(parsed.uuid)) {
        return normalizeUuid(parsed.uuid);
      }
    }
  } catch {
    await AsyncStorage.removeItem(UUID_CACHE_KEY);
  }

  const { data: exact, error: errExact } = await supabase
    .from('employees')
    .select('id')
    .eq('card_no', raw)
    .maybeSingle();

  if (errExact) {
    console.warn('[employeeIdResolve] card_no.eq failed:', errExact.message);
    return null;
  }

  let id = exact?.id as string | undefined;

  if (!id) {
    const { data: fold, error: errIlike } = await supabase
      .from('employees')
      .select('id')
      .ilike('card_no', raw)
      .maybeSingle();

    if (errIlike) {
      console.warn('[employeeIdResolve] card_no.ilike failed:', errIlike.message);
      return null;
    }
    id = fold?.id as string | undefined;
  }

  if (!id || !looksLikeEmployeeUuid(id)) return null;

  const uuid = normalizeUuid(id);
  await AsyncStorage.setItem(UUID_CACHE_KEY, JSON.stringify({ raw, uuid } satisfies UuidCache));
  return uuid;
}
