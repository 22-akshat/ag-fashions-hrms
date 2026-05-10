import { resolveEmployeeUuidForSupabase } from './employeeIdResolve';
import { supabase } from '../supabase';

export async function markAttendance(input: {
  employeeId: string;
  faceVerified: boolean;
}) {
  if (!supabase) {
    throw new Error('Supabase configuration missing in .env.');
  }

  const employeeUuid = await resolveEmployeeUuidForSupabase(input.employeeId);
  if (!employeeUuid) {
    throw new Error(
      'Employee not found. Enter the same Card No. as in Employees (or the full UUID).',
    );
  }

  const { error } = await supabase.from('attendance_logs').insert({
    employee_id: employeeUuid,
    timestamp: new Date().toISOString(),
    face_verified: input.faceVerified,
    status: 'present',
  });

  if (error) {
    throw new Error(error.message);
  }
}
