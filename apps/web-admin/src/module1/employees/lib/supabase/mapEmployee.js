import { normalizeDepartmentName } from '@/module1/employees/lib/employeeFields'
const OPTIONAL_DATE_COLS = ['date_of_interview', 'last_interview_date', 'date_of_birth']

function dateOrNull(v) {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

function nullToEmptyDate(v) {
  return v == null ? '' : String(v).slice(0, 10)
}

export function rowToEmployee(r) {
  const salaryNum = Number(r.salary ?? 0)
  const faceRegisteredAt = r.face_registered_at != null ? String(r.face_registered_at) : null
  const faceEmbeddingVersion = Number(r.face_embedding_version ?? 1)
  return {
    id: String(r.id),
    card_no: String(r.card_no ?? ''),
    full_name: String(r.full_name ?? ''),
    father_husband_name: String(r.father_husband_name ?? ''),
    status: String(r.status ?? 'Active'),
    date_of_interview: nullToEmptyDate(r.date_of_interview),
    last_interview_date: nullToEmptyDate(r.last_interview_date),
    date_of_birth: nullToEmptyDate(r.date_of_birth),
    gender: String(r.gender ?? 'Male'),
    marital_status: String(r.marital_status ?? 'Single'),
    job_location: String(r.job_location ?? ''),
    department: normalizeDepartmentName(String(r.department ?? '')),
    designation: String(r.designation ?? ''),
    adhar_card: String(r.adhar_card ?? ''),
    pan_card: String(r.pan_card ?? ''),
    account_no: String(r.account_no ?? ''),
    ifsc_code: String(r.ifsc_code ?? ''),
    salary: Number.isFinite(salaryNum) ? String(salaryNum) : '0',
    esic_no: String(r.esic_no ?? ''),
    uan_no: String(r.uan_no ?? ''),
    phone_no_1: String(r.phone_no_1 ?? ''),
    phone_no_2: String(r.phone_no_2 ?? ''),
    personal_email: String(r.personal_email ?? ''),
    local_address: String(r.local_address ?? ''),
    permanent_address: String(r.permanent_address ?? ''),
    created_date: nullToEmptyDate(r.created_date),
    intime: String(r.intime ?? ''),
    outtime: String(r.outtime ?? ''),
    weekly_off: String(r.weekly_off ?? ''),
    personel_image: String(r.personel_image ?? ''),
    face_registered_at: faceRegisteredAt,
    face_embedding_version: Number.isFinite(faceEmbeddingVersion) ? faceEmbeddingVersion : 1,
    face_registered: Boolean(faceRegisteredAt),
  }
}

export function employeeToRow(e, opts = {}) {
  const includeId = opts.includeId !== false
  const salaryNum = Number(e.salary ?? 0)
  const row = {
    ...(includeId && e.id != null && String(e.id).trim() !== '' ? { id: String(e.id) } : {}),
    card_no: String(e.card_no ?? ''),
    full_name: String(e.full_name ?? ''),
    father_husband_name: String(e.father_husband_name ?? ''),
    status: String(e.status ?? 'Active'),
    date_of_interview: dateOrNull(e.date_of_interview),
    last_interview_date: dateOrNull(e.last_interview_date),
    date_of_birth: dateOrNull(e.date_of_birth),
    gender: String(e.gender ?? 'Male'),
    marital_status: String(e.marital_status ?? 'Single'),
    job_location: String(e.job_location ?? ''),
    department: normalizeDepartmentName(String(e.department ?? '')),
    designation: String(e.designation ?? ''),
    adhar_card: String(e.adhar_card ?? ''),
    pan_card: String(e.pan_card ?? ''),
    account_no: String(e.account_no ?? ''),
    ifsc_code: String(e.ifsc_code ?? ''),
    salary: Number.isFinite(salaryNum) ? salaryNum : 0,
    esic_no: String(e.esic_no ?? ''),
    uan_no: String(e.uan_no ?? ''),
    phone_no_1: String(e.phone_no_1 ?? ''),
    phone_no_2: String(e.phone_no_2 ?? ''),
    personal_email: String(e.personal_email ?? ''),
    local_address: String(e.local_address ?? ''),
    permanent_address: String(e.permanent_address ?? ''),
    created_date: dateOrNull(e.created_date) ?? new Date().toISOString().slice(0, 10),
    intime: String(e.intime ?? ''),
    outtime: String(e.outtime ?? ''),
    weekly_off: String(e.weekly_off ?? ''),
    personel_image: String(e.personel_image ?? ''),
  }
  OPTIONAL_DATE_COLS.forEach((k) => {
    if (row[k] === '') row[k] = null
  })
  return row
}

