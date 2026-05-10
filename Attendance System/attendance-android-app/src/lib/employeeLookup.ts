import { looksLikeEmployeeUuid } from './employeeIdResolve';
import { supabase } from '../supabase';

export type EmployeeBrief = {
  id: string;
  full_name: string;
  card_no: string;
};

function normalizeUuid(value: string): string {
  return String(value ?? '').trim().toLowerCase();
}

/** Load employee row for registration UI after card number (or UUID). */
export async function fetchEmployeeBrief(rawInput: string): Promise<EmployeeBrief | null> {
  const raw = String(rawInput ?? '').trim();
  if (!raw) return null;

  const sb = supabase;
  if (!sb) throw new Error('Supabase is not configured.');

  type Row = { id: string; full_name: string | null; card_no: string | null };

  let data: Row | null = null;

  if (looksLikeEmployeeUuid(raw)) {
    const { data: byId, error } = await sb
      .from('employees')
      .select('id,full_name,card_no')
      .eq('id', normalizeUuid(raw))
      .maybeSingle();
    if (error) throw new Error(error.message);
    data = byId as Row | null;
  } else {
    const { data: exact, error: errExact } = await sb
      .from('employees')
      .select('id,full_name,card_no')
      .eq('card_no', raw)
      .maybeSingle();

    if (errExact) throw new Error(errExact.message);
    data = exact as Row | null;

    if (!data) {
      const { data: fold, error: errFold } = await sb
        .from('employees')
        .select('id,full_name,card_no')
        .ilike('card_no', raw)
        .maybeSingle();

      if (errFold) throw new Error(errFold.message);
      data = fold as Row | null;
    }
  }

  if (!data?.id) return null;

  return {
    id: String(data.id),
    full_name: String(data.full_name ?? '').trim() || '(No name)',
    card_no: String(data.card_no ?? '').trim(),
  };
}
