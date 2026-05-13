import { supabase } from '../../../supabase';

export type LookupEmployeeSummary = {
  id: string;
  card_no: string;
  full_name: string;
  status: string;
  has_registered_face: boolean;
};

/**
 * Active employee only, exact trimmed card_no case-insensitive per SQL.
 * Embedding is NOT returned — use RPC for server-validated subsets only.
 */
export async function lookupEmployeeByCardNo(
  rawCardNo: string,
): Promise<LookupEmployeeSummary | null> {
  const sb = supabase;
  if (!sb) throw new Error('Supabase configuration missing.');
  const card = String(rawCardNo ?? '').trim();
  if (!card) return null;

  const { data, error } = await sb.rpc('mobile_lookup_active_employee_by_card', {
    p_card_no: card,
  });

  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  const row = rows[0];
  if (!row?.id) return null;

  return {
    id: String(row.id),
    card_no: String(row.card_no ?? ''),
    full_name: String(row.full_name ?? '').trim(),
    status: String(row.status ?? ''),
    has_registered_face: Boolean(row.has_registered_face),
  };
}
