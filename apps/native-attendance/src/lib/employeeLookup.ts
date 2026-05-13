import { lookupEmployeeByCardNo } from '../modules/face/lib/employeeLookup';

export type EmployeeBrief = {
  id: string;
  card_no: string;
  full_name: string;
  status: string;
  has_registered_face: boolean;
};

export async function fetchEmployeeBrief(cardNumber: string): Promise<EmployeeBrief | null> {
  const row = await lookupEmployeeByCardNo(cardNumber);
  if (!row) return null;
  return {
    id: row.id,
    card_no: row.card_no,
    full_name: row.full_name,
    status: row.status,
    has_registered_face: row.has_registered_face,
  };
}

export async function lookupEmployee(cardNumber: string): Promise<EmployeeBrief | null> {
  return fetchEmployeeBrief(cardNumber);
}
