import { supabase } from '../supabase';

export type SubmitRegistrationAccessRequestParams = {
  /** Must match an active employee card in HR (case-insensitive). */
  cardNo: string;
  requestedShopId: string | null;
  lat: number;
  lng: number;
  accuracyM: number | null;
  deviceId: string;
};

export type SubmitRegistrationAccessRequestResult = 'inserted' | 'already_pending';

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === '23505' || String(error.message ?? '').includes('duplicate key');
}

/**
 * Creates a pending attendance access request for HR review.
 * Skips insert when a pending row already exists for this employee (idempotent).
 */
export async function submitRegistrationAccessRequest(
  params: SubmitRegistrationAccessRequestParams,
): Promise<SubmitRegistrationAccessRequestResult> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const card = String(params.cardNo ?? '').trim();
  if (!card) throw new Error('Card number is required.');

  const { error } = await supabase.rpc('submit_registration_access_request_by_card', {
    p_card_no: card,
    p_requested_shop_id: params.requestedShopId,
    p_lat: params.lat,
    p_lng: params.lng,
    p_accuracy_m: params.accuracyM,
    p_device_id: params.deviceId.trim(),
  });

  if (error) {
    if (isUniqueViolation(error)) return 'already_pending';
    throw new Error(error.message);
  }

  return 'inserted';
}
