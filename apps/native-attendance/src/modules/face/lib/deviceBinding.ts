import { supabase } from '../../../supabase';

/**
 * Persists embedding + binds device row (SECURITY DEFINER RPC).
 * Server blocks replace unless forceReplaceApproved (audit-friendly contract).
 */
export async function registerEmployeeDevice(input: {
  employeeId: string;
  embedding: number[];
  deviceId: string;
  embeddingVersion?: number;
  forceReplaceApproved?: boolean;
}): Promise<void> {
  const sb = supabase;
  if (!sb) throw new Error('Supabase configuration missing.');

  const { error } = await sb.rpc('mobile_register_employee_face_and_device', {
    p_employee_id: input.employeeId,
    p_face_embedding: input.embedding,
    p_device_id: input.deviceId.trim(),
    p_embedding_version: input.embeddingVersion ?? 1,
    p_allow_replace: Boolean(input.forceReplaceApproved),
  });

  if (error) throw new Error(error.message);
}

export async function updateDeviceLastSeen(employeeId: string, deviceId: string): Promise<void> {
  const sb = supabase;
  if (!sb) throw new Error('Supabase configuration missing.');

  const { error } = await sb.rpc('mobile_touch_employee_device', {
    p_employee_id: employeeId,
    p_device_id: deviceId.trim(),
  });

  if (error) throw new Error(error.message);
}
