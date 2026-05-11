import { supabase } from '../supabase';

export type SubmitRegistrationAccessRequestParams = {
  employeeUuid: string;
  requesterName: string;
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

  const { data: existing, error: selectError } = await supabase
    .from('attendance_access_requests')
    .select('id')
    .eq('employee_id', params.employeeUuid)
    .eq('status', 'pending')
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existing?.id) {
    return 'already_pending';
  }

  const { error: insertError } = await supabase.from('attendance_access_requests').insert({
    employee_id: params.employeeUuid,
    requester_name: params.requesterName.trim(),
    card_no: params.cardNo.trim(),
    requested_shop_id: params.requestedShopId,
    device_id: params.deviceId.trim(),
    status: 'pending',
    request_lat: params.lat,
    request_lng: params.lng,
    request_accuracy_m: params.accuracyM,
  });

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      return 'already_pending';
    }
    throw new Error(insertError.message);
  }

  return 'inserted';
}
