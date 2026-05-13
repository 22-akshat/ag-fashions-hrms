import Papa from 'papaparse'
import {
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  STATUS_OPTIONS,
  WEEKLY_OFF_OPTIONS,
  normalizeDepartmentName,
} from '@/module1/employees/lib/employeeFields'

const STATUS_SET = new Set(STATUS_OPTIONS)
const GENDER_SET = new Set(GENDER_OPTIONS)
const MARITAL_STATUS_SET = new Set(MARITAL_STATUS_OPTIONS)
const WEEKLY_OFF_SET = new Set(WEEKLY_OFF_OPTIONS)
const STATUS_CANONICAL = { active: 'Active', inactive: 'Inactive' }
const GENDER_CANONICAL = {
  male: 'Male',
  m: 'Male',
  female: 'Female',
  f: 'Female',
  other: 'Other',
  o: 'Other',
  transgender: 'Other',
  trans: 'Other',
  nonbinary: 'Other',
  non_binary: 'Other',
  na: 'Other',
  n_a: 'Other',
}
const MARITAL_CANONICAL = {
  single: 'Single',
  unmarried: 'Single',
  married: 'Married',
  marriage: 'Married',
  divorced: 'Divorced',
  divorcee: 'Divorced',
  widowed: 'Widowed',
  widow: 'Widowed',
}

export const EMPLOYEE_CSV_HEADER_COLUMNS = [
  'card_no', 'full_name', 'father_husband_name', 'status', 'date_of_interview', 'last_interview_date',
  'date_of_birth', 'gender', 'marital_status', 'job_location', 'department', 'designation', 'adhar_card',
  'pan_card', 'account_no', 'ifsc_code', 'salary', 'esic_no', 'uan_no', 'phone_no_1', 'phone_no_2',
  'personal_email', 'local_address', 'permanent_address', 'created_date', 'intime', 'outtime', 'weekly_off', 'personel_image',
]

export const PREVIEW_TABLE_COLUMNS = [
  'full_name', 'father_husband_name', 'department', 'designation', 'job_location', 'status', 'phone_no_1', 'salary',
]

function stripBom(text) { return String(text ?? '').replace(/^\uFEFF/, '') }
function normalizeCell(v) {
  return v == null ? '' : String(v).replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
}
function parseToIsoDate(s) {
  const value = normalizeCell(s)
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10)
  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = Number(s)
    if (Number.isFinite(serial) && serial > 20000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30))
      const dt = new Date(excelEpoch.getTime() + Math.floor(serial) * 86400000)
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
    }
  }
  const m = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (!m) return null
  const a = Number(m[1]); const b = Number(m[2]); const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3])
  const ddMm = new Date(Date.UTC(year, b - 1, a))
  if (ddMm.getUTCFullYear() === year && ddMm.getUTCMonth() === b - 1 && ddMm.getUTCDate() === a) return `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
  const mmDd = new Date(Date.UTC(year, a - 1, b))
  if (mmDd.getUTCFullYear() === year && mmDd.getUTCMonth() === a - 1 && mmDd.getUTCDate() === b) return `${year}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
  return null
}
function parseDate(raw, label, rowMsgs, fallback = null) {
  const s = normalizeCell(raw)
  if (!s) return fallback
  const iso = parseToIsoDate(s)
  if (!iso) rowMsgs.push(`${label}: use YYYY-MM-DD or DD/MM/YYYY`)
  return iso
}
function newRowId() { return crypto.randomUUID?.() ?? `emp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}` }
function normalizeEnum(raw, map) {
  const key = normalizeCell(raw).replace(/^['"]|['"]$/g, '').toLowerCase()
  if (!key || key === '-' || key === '--' || key === 'na' || key === 'n/a' || key === 'null') return ''
  return map[key] ?? normalizeCell(raw)
}
function parseSalary(raw) {
  const base = normalizeCell(raw).replace(/^['"]|['"]$/g, '').toLowerCase()
  if (!base || base === '-' || base === '--' || base === 'na' || base === 'n/a' || base === 'null') return { ok: true, value: 0 }
  let s = base.replace(/[₹,\s]/g, '')
  let multiplier = 1
  if (s.endsWith('k')) { multiplier = 1000; s = s.slice(0, -1) }
  else if (s.endsWith('lakh') || s.endsWith('lac') || s.endsWith('l')) { multiplier = 100000; s = s.replace(/(lakh|lac|l)$/, '') }
  else if (s.endsWith('cr') || s.endsWith('crore')) { multiplier = 10000000; s = s.replace(/(cr|crore)$/, '') }
  s = s.replace(/[^0-9.+-]/g, '')
  const n = Number(s)
  if (!Number.isFinite(n)) return { ok: false, value: 0 }
  return { ok: true, value: n * multiplier }
}
function normalizeKey(k) { return String(k ?? '').trim().toLowerCase().replace(/[\s.-]+/g, '_') }
function getField(raw, ...keys) {
  const entries = Object.entries(raw ?? {})
  const normalizedMap = new Map(entries.map(([k, v]) => [normalizeKey(k), v]))
  for (const key of keys) {
    const exact = raw?.[key]
    if (exact != null && String(exact).trim() !== '') return exact
    const normalized = normalizedMap.get(normalizeKey(key))
    if (normalized != null && String(normalized).trim() !== '') return normalized
  }
  return ''
}

function validateAndBuildRow(raw) {
  const rowMsgs = []
  const fullName = normalizeCell(getField(raw, 'full_name', 'full name', 'employee_name', 'name'))
  const cardNo = normalizeCell(getField(raw, 'card_no', 'card no', 'cardno')).toUpperCase()
  const departmentRaw = normalizeCell(getField(raw, 'department', 'department_department', 'dept', 'department_name', 'team'))
  const department = normalizeDepartmentName(departmentRaw)
  if (!fullName) rowMsgs.push('full_name is required')
  if (!cardNo) rowMsgs.push('card_no is required')
  const status = normalizeEnum(getField(raw, 'status'), STATUS_CANONICAL) || 'Active'
  if (!STATUS_SET.has(status)) rowMsgs.push(`status must be one of: ${Array.from(STATUS_SET).join(', ')}`)
  let gender = normalizeEnum(getField(raw, 'gender', 'sex'), GENDER_CANONICAL) || 'Male'
  if (!GENDER_SET.has(gender)) gender = 'Other'
  const maritalStatus = normalizeEnum(getField(raw, 'marital_status', 'marital status'), MARITAL_CANONICAL) || 'Single'
  if (!MARITAL_STATUS_SET.has(maritalStatus)) rowMsgs.push(`marital_status must be one of: ${Array.from(MARITAL_STATUS_SET).join(', ')}`)
  const adhar = normalizeCell(getField(raw, 'adhar_card', 'aadhaar', 'aadhar', 'aadhaar_no')).replace(/\D/g, '')
  if (adhar && !/^\d{12}$/.test(adhar)) rowMsgs.push('adhar_card must be exactly 12 digits')
  const pan = normalizeCell(getField(raw, 'pan_card', 'pan')).toUpperCase()
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) rowMsgs.push('pan_card must match ABCDE1234F')
  const salaryRes = parseSalary(normalizeCell(getField(raw, 'salary', 'salary_inr')))
  const safeSalary = salaryRes.ok ? salaryRes.value : 0
  const weeklyOff = normalizeCell(getField(raw, 'weekly_off', 'weekly off'))
  if (weeklyOff && !WEEKLY_OFF_SET.has(weeklyOff)) rowMsgs.push(`weekly_off must be one day from: ${Array.from(WEEKLY_OFF_SET).join(', ')}`)

  const row = {
    id: newRowId(),
    card_no: cardNo,
    full_name: fullName,
    father_husband_name: normalizeCell(getField(raw, 'father_husband_name', 'father/husband_name', 'father_husband')),
    status,
    date_of_interview: parseDate(getField(raw, 'date_of_interview', 'date of interview', 'interview_date'), 'date_of_interview', rowMsgs),
    last_interview_date: parseDate(getField(raw, 'last_interview_date', 'last interview date'), 'last_interview_date', rowMsgs),
    date_of_birth: parseDate(getField(raw, 'date_of_birth', 'date of birth', 'dob'), 'date_of_birth', rowMsgs),
    gender,
    marital_status: maritalStatus,
    job_location: normalizeCell(getField(raw, 'job_location', 'job location', 'location')),
    department,
    designation: normalizeCell(getField(raw, 'designation', 'design_code', 'designation_code')),
    adhar_card: adhar,
    pan_card: pan,
    account_no: normalizeCell(getField(raw, 'account_no', 'account no', 'bank_account_no')),
    ifsc_code: normalizeCell(getField(raw, 'ifsc_code', 'ifsc', 'ifsc code')),
    salary: safeSalary,
    esic_no: normalizeCell(getField(raw, 'esic_no', 'esic')),
    uan_no: normalizeCell(getField(raw, 'uan_no', 'uan')),
    phone_no_1: normalizeCell(getField(raw, 'phone_no_1', 'phone_1', 'phone')),
    phone_no_2: normalizeCell(getField(raw, 'phone_no_2', 'phone_2')),
    personal_email: normalizeCell(getField(raw, 'personal_email', 'email', 'personal email')),
    local_address: normalizeCell(getField(raw, 'local_address', 'local address')),
    permanent_address: normalizeCell(getField(raw, 'permanent_address', 'permanent address')),
    created_date:
      parseDate(getField(raw, 'created_date', 'created date', 'joining_date'), 'created_date', rowMsgs, new Date().toISOString().slice(0, 10)) ??
      new Date().toISOString().slice(0, 10),
    intime: normalizeCell(getField(raw, 'intime', 'in_time', 'in time')),
    outtime: normalizeCell(getField(raw, 'outtime', 'out_time', 'out time')),
    weekly_off: weeklyOff,
    personel_image: normalizeCell(getField(raw, 'personel_image', 'personnel_image', 'image')),
  }
  if (rowMsgs.length > 0) return { ok: false, message: rowMsgs.join('; ') }
  return { ok: true, row }
}

export function importEmployeesFromCsv(csvText) {
  const valid = []
  const errors = []
  const previewRows = []
  const text = stripBom(String(csvText ?? '')).trim()
  if (!text) return { valid, errors: [{ rowNumber: 0, message: 'File is empty' }], previewRows }
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false, transformHeader: (h) => String(h ?? '').trim() })
  for (const pe of parsed.errors ?? []) {
    errors.push({ rowNumber: typeof pe.row === 'number' ? pe.row + 1 : 0, message: pe.message ?? 'CSV parse error' })
  }
  const rows = Array.isArray(parsed.data) ? parsed.data : []
  for (const r of rows.slice(0, 5)) {
    const pr = {}
    for (const col of PREVIEW_TABLE_COLUMNS) pr[col] = normalizeCell(r?.[col])
    previewRows.push(pr)
  }
  rows.forEach((raw, i) => {
    const built = validateAndBuildRow(raw)
    if (built.ok) valid.push(built.row)
    else errors.push({ rowNumber: i + 2, message: built.message })
  })
  return { valid, errors, previewRows }
}

