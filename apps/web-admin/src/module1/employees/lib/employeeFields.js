export const STATUS_OPTIONS = /** @type {const} */ (['Active', 'Inactive'])
export const GENDER_OPTIONS = /** @type {const} */ (['Male', 'Female', 'Other'])
export const MARITAL_STATUS_OPTIONS = /** @type {const} */ ([
  'Single',
  'Married',
  'Divorced',
  'Widowed',
])
export const DEPARTMENT_OPTIONS = /** @type {const} */ ([
  'Admin',
  'Accounts',
  'Buying',
  'Quality Analyzer',
  'IT',
  'Marketing',
  'Warehouse',
  'Sales',
])
export const DESIGNATION_DEPARTMENT_MAP = {
  Hr: 'Admin',
  Accountant: 'Accounts',
  Buyer: 'Buying',
  'Quality Checker': 'Quality Analyzer',
  'Software Developer': 'IT',
  EDP: 'IT',
  'Marketing Head': 'Marketing',
  Scanning: 'Warehouse',
  Helper: 'Warehouse',
  'Stock Recorder': 'Warehouse',
  'Sales Manager': 'Sales',
  'Sales Man': 'Sales',
}
export const DESIGNATION_OPTIONS = Object.freeze(Object.keys(DESIGNATION_DEPARTMENT_MAP))
export const LOCATION_OPTIONS = /** @type {const} */ ([
  'Khanpur',
  'Mukherjee Nagar',
  'Ateli Mandi',
  'Jind',
  'Panipat',
  'Tosham',
  'Charkhi Dadri',
  'Bhiwani',
  'Dadri',
  'Palwal',
  'Head Office/ Warehouse',
  'Hansi',
  'Jhajjar',
  'Gurugram Sec-14',
  'Rewari',
  'Jind 2',
])
export const WEEKLY_OFF_OPTIONS = /** @type {const} */ ([
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
])
export const TIME_SLOT_OPTIONS = /** @type {const} */ ([
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
])

function toTitleCase(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function normalizeDepartmentName(value) {
  const raw = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!raw) return ''
  const canonical = DEPARTMENT_OPTIONS.find((d) => d.toLowerCase() === raw.toLowerCase())
  if (canonical) return canonical
  return toTitleCase(raw)
}

export const ALL_FIELD_KEYS = [
  'card_no',
  'full_name',
  'father_husband_name',
  'status',
  'date_of_interview',
  'last_interview_date',
  'date_of_birth',
  'gender',
  'marital_status',
  'job_location',
  'department',
  'designation',
  'adhar_card',
  'pan_card',
  'account_no',
  'ifsc_code',
  'salary',
  'esic_no',
  'uan_no',
  'phone_no_1',
  'phone_no_2',
  'personal_email',
  'local_address',
  'permanent_address',
  'created_date',
  'intime',
  'outtime',
  'weekly_off',
  'personel_image',
]

export const FIELD_LABELS = {
  card_no: 'Card No.',
  full_name: 'Full name',
  father_husband_name: 'Father/Husband name',
  status: 'Status',
  date_of_interview: 'Date of interview',
  last_interview_date: 'Last interview date',
  date_of_birth: 'Date of birth',
  gender: 'Gender',
  marital_status: 'Marital status',
  job_location: 'Job location',
  department: 'Department',
  designation: 'Designation',
  adhar_card: 'Aadhaar',
  pan_card: 'PAN',
  account_no: 'Bank account no.',
  ifsc_code: 'IFSC code',
  salary: 'Salary (INR)',
  esic_no: 'ESIC No.',
  uan_no: 'UAN No.',
  phone_no_1: 'Phone (primary)',
  phone_no_2: 'Phone (secondary)',
  personal_email: 'Personal email',
  local_address: 'Local address',
  permanent_address: 'Permanent address',
  created_date: 'Created date',
  intime: 'In time',
  outtime: 'Out time',
  weekly_off: 'Weekly off',
  personel_image: 'Personal image URL',
}

export const TAB_FIELDS = {
  personal: [
    'full_name',
    'father_husband_name',
    'date_of_birth',
    'gender',
    'marital_status',
    'personal_email',
    'phone_no_1',
    'phone_no_2',
    'local_address',
    'permanent_address',
    'personel_image',
  ],
  work: [
    'card_no',
    'department',
    'designation',
    'job_location',
    'date_of_interview',
    'last_interview_date',
    'status',
    'salary',
  ],
  bank: ['adhar_card', 'pan_card', 'account_no', 'ifsc_code', 'esic_no', 'uan_no'],
  time: ['intime', 'outtime', 'weekly_off', 'created_date'],
}

export function createEmptyEmployee(id, createdDate) {
  const today = createdDate ?? new Date().toISOString().slice(0, 10)
  return {
    id,
    card_no: '',
    full_name: '',
    father_husband_name: '',
    status: 'Active',
    date_of_interview: '',
    last_interview_date: '',
    date_of_birth: '',
    gender: 'Male',
    marital_status: 'Single',
    job_location: '',
    department: '',
    designation: '',
    adhar_card: '',
    pan_card: '',
    account_no: '',
    ifsc_code: '',
    salary: '0',
    esic_no: '',
    uan_no: '',
    phone_no_1: '',
    phone_no_2: '',
    personal_email: '',
    local_address: '',
    permanent_address: '',
    created_date: today,
    intime: '',
    outtime: '',
    weekly_off: '',
    personel_image: '',
  }
}

export function mergeDepartmentOptions(extra = []) {
  const byLower = new Map()
  ;[...DEPARTMENT_OPTIONS, ...extra]
    .map(normalizeDepartmentName)
    .filter(Boolean)
    .forEach((d) => {
      const k = d.toLowerCase()
      if (!byLower.has(k)) byLower.set(k, d)
    })
  return Array.from(byLower.values()).sort((a, b) => a.localeCompare(b))
}

