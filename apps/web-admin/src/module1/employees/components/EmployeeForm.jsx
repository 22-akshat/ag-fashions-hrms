import { useState } from 'react'
import {
  DEPARTMENT_OPTIONS,
  DESIGNATION_DEPARTMENT_MAP,
  DESIGNATION_OPTIONS,
  FIELD_LABELS,
  GENDER_OPTIONS,
  LOCATION_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  STATUS_OPTIONS,
  TAB_FIELDS,
  TIME_SLOT_OPTIONS,
  WEEKLY_OFF_OPTIONS,
} from '@/module1/employees/lib/employeeFields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DatePickerField } from '@/components/ui/date-picker-field'

const TAB_CONFIG = [
  { value: 'personal', label: 'Personal Details', fields: TAB_FIELDS.personal },
  { value: 'work', label: 'Work Details', fields: TAB_FIELDS.work },
  { value: 'time', label: 'Time Policy', fields: TAB_FIELDS.time },
  { value: 'bank', label: 'Bank & IDs', fields: TAB_FIELDS.bank },
]

function fieldDomId(key) {
  return `emp-field-${key.replace(/\./g, '-')}`
}

function validate(values) {
  const e = {}
  const req = [
    ['full_name', 'Full name'],
    ['card_no', 'Card number'],
  ]
  req.forEach(([k, lbl]) => {
    if (!String(values[k] ?? '').trim()) e[k] = `${lbl} is required`
  })
  const em = String(values.personal_email ?? '').trim()
  if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) e.personal_email = 'Enter a valid email address'
  ;['phone_no_1', 'phone_no_2'].forEach((pk) => {
    const phone = String(values[pk] ?? '').trim()
    if (phone && phone.replace(/\D/g, '').length < 10) e[pk] = 'Include a reachable phone number'
  })
  return e
}

function FieldWrap({ children, label, hint, htmlFor }) {
  return (
    <div className="space-y-2">
      {label ? (
        <Label htmlFor={htmlFor} className="text-muted-foreground">
          {label}
        </Label>
      ) : null}
      {children}
      {hint ? <p className="text-xs text-destructive">{hint}</p> : null}
    </div>
  )
}

export function EmployeeForm({
  employee,
  departmentOptions = DEPARTMENT_OPTIONS,
  submitLabel = 'Save employee',
  onCancel,
  onSubmitted,
  onAddDepartment,
  onOfferLetter,
}) {
  const [tab, setTab] = useState('personal')
  const [values, setValues] = useState(() => ({ ...employee }))
  const [errors, setErrors] = useState({})
  const [customDepartment, setCustomDepartment] = useState('')
  const [customDesignation, setCustomDesignation] = useState('')
  const [customLocation, setCustomLocation] = useState('')
  const [showCustomDepartment, setShowCustomDepartment] = useState(false)
  const [showCustomDesignation, setShowCustomDesignation] = useState(false)
  const [showCustomLocation, setShowCustomLocation] = useState(false)

  function patch(key, next) {
    setValues((v) => ({ ...v, [key]: next }))
  }

  function renderControl(key) {
    const fid = fieldDomId(key)
    const commonErr = errors[key]
    if (key === 'department') {
      const selected = values[key] ?? ''
      const isCustom = selected && !departmentOptions.includes(selected)
      return (
        <FieldWrap label={FIELD_LABELS[key]} hint={commonErr}>
          <Select value={isCustom ? '__custom__' : selected} onValueChange={(v) => {
            if (v === '__custom__') {
              setShowCustomDepartment(true)
              return
            }
            setShowCustomDepartment(false)
            patch('department', v)
          }}>
            <SelectTrigger id={fid} aria-invalid={Boolean(commonErr)}>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departmentOptions.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
              <SelectItem value="__custom__">+ Add new department</SelectItem>
            </SelectContent>
          </Select>
          {showCustomDepartment || isCustom ? (
            <div className="flex gap-2">
              <Input value={customDepartment} onChange={(ev) => setCustomDepartment(ev.target.value)} placeholder="Enter new department" />
              <Button type="button" variant="outline" onClick={() => {
                const d = customDepartment.trim()
                if (!d) return
                onAddDepartment?.(d)
                patch('department', d)
                setCustomDepartment('')
                setShowCustomDepartment(false)
              }}>Add</Button>
            </div>
          ) : null}
        </FieldWrap>
      )
    }
    if (key === 'weekly_off') {
      return (
        <FieldWrap label={FIELD_LABELS[key]} hint={commonErr}>
          <Select value={values[key] ?? ''} onValueChange={(v) => patch(key, v)}>
            <SelectTrigger id={fid} aria-invalid={Boolean(commonErr)}>
              <SelectValue placeholder="Select one weekly off day" />
            </SelectTrigger>
            <SelectContent>
              {WEEKLY_OFF_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldWrap>
      )
    }
    if (key === 'designation') {
      const department = String(values.department ?? '')
      const filteredOptions = department
        ? DESIGNATION_OPTIONS.filter((d) => DESIGNATION_DEPARTMENT_MAP[d] === department)
        : DESIGNATION_OPTIONS
      const options = filteredOptions.length > 0 ? filteredOptions : DESIGNATION_OPTIONS
      const selected = String(values.designation ?? '')
      const isCustom = selected && !options.includes(selected)
      return (
        <FieldWrap label={FIELD_LABELS[key]} hint={commonErr}>
          <Select
            value={isCustom ? '__custom__' : selected}
            onValueChange={(v) => {
              if (v === '__custom__') {
                setShowCustomDesignation(true)
                return
              }
              setShowCustomDesignation(false)
              patch('designation', v)
              const mappedDepartment = DESIGNATION_DEPARTMENT_MAP[v]
              if (mappedDepartment) patch('department', mappedDepartment)
            }}
          >
            <SelectTrigger id={fid} aria-invalid={Boolean(commonErr)}>
              <SelectValue placeholder="Select designation" />
            </SelectTrigger>
            <SelectContent>
              {options.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
              <SelectItem value="__custom__">+ Add custom designation</SelectItem>
            </SelectContent>
          </Select>
          {showCustomDesignation || isCustom ? (
            <div className="flex gap-2">
              <Input
                value={customDesignation}
                onChange={(ev) => setCustomDesignation(ev.target.value)}
                placeholder="Enter custom designation"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const d = customDesignation.trim()
                  if (!d) return
                  patch('designation', d)
                  setCustomDesignation('')
                  setShowCustomDesignation(false)
                }}
              >
                Add
              </Button>
            </div>
          ) : null}
        </FieldWrap>
      )
    }
    if (key === 'job_location') {
      const selected = String(values.job_location ?? '')
      const isCustom = selected && !LOCATION_OPTIONS.includes(selected)
      return (
        <FieldWrap label={FIELD_LABELS[key]} hint={commonErr}>
          <Select value={isCustom ? '__custom__' : selected} onValueChange={(v) => {
            if (v === '__custom__') {
              setShowCustomLocation(true)
              return
            }
            setShowCustomLocation(false)
            patch('job_location', v)
          }}>
            <SelectTrigger id={fid} aria-invalid={Boolean(commonErr)}>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {LOCATION_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
              <SelectItem value="__custom__">+ Add custom location</SelectItem>
            </SelectContent>
          </Select>
          {showCustomLocation || isCustom ? (
            <div className="flex gap-2">
              <Input
                value={customLocation}
                onChange={(ev) => setCustomLocation(ev.target.value)}
                placeholder="Enter custom location"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const l = customLocation.trim()
                  if (!l) return
                  patch('job_location', l)
                  setCustomLocation('')
                  setShowCustomLocation(false)
                }}
              >
                Add
              </Button>
            </div>
          ) : null}
        </FieldWrap>
      )
    }
    if (key === 'status') {
      return (
        <FieldWrap label={FIELD_LABELS[key]} hint={commonErr}>
          <Select value={values.status ?? ''} onValueChange={(v) => patch('status', v)}>
            <SelectTrigger id={fid} aria-invalid={Boolean(commonErr)}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldWrap>
      )
    }
    if (key === 'gender') {
      return (
        <FieldWrap label={FIELD_LABELS[key]} hint={commonErr}>
          <Select value={values.gender ?? ''} onValueChange={(v) => patch('gender', v)}>
            <SelectTrigger id={fid}><SelectValue placeholder="Select gender" /></SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldWrap>
      )
    }
    if (key === 'date_of_birth' || key === 'date_of_interview' || key === 'last_interview_date' || key === 'created_date') {
      return (
        <FieldWrap label={FIELD_LABELS[key]} hint={commonErr}>
          <DatePickerField id={fid} value={values[key] ?? ''} onChange={(v) => patch(key, v)} placeholder={FIELD_LABELS[key]} />
        </FieldWrap>
      )
    }
    if (key === 'marital_status') {
      return (
        <FieldWrap label={FIELD_LABELS[key]} hint={commonErr}>
          <Select value={values.marital_status ?? ''} onValueChange={(v) => patch('marital_status', v)}>
            <SelectTrigger id={fid} aria-invalid={Boolean(commonErr)}>
              <SelectValue placeholder="Select marital status" />
            </SelectTrigger>
            <SelectContent>
              {MARITAL_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldWrap>
      )
    }
    if (key === 'salary') {
      return (
        <FieldWrap label={FIELD_LABELS[key]} hint={commonErr} htmlFor={fid}>
          <div className="flex items-center rounded-md border border-input bg-background">
            <span className="px-3 text-sm text-muted-foreground">INR</span>
            <Input id={fid} type="number" min="0" step="0.01" className="border-0" value={values.salary ?? '0'} onChange={(ev) => patch('salary', ev.target.value)} aria-invalid={Boolean(commonErr)} />
          </div>
        </FieldWrap>
      )
    }
    if (key === 'intime' || key === 'outtime') {
      return (
        <FieldWrap label={FIELD_LABELS[key]} hint={commonErr} htmlFor={fid}>
          <Select value={String(values[key] ?? '')} onValueChange={(v) => patch(key, v)}>
            <SelectTrigger id={fid} aria-invalid={Boolean(commonErr)}>
              <SelectValue placeholder="Select slot" />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOT_OPTIONS.map((slot) => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldWrap>
      )
    }
    if (key === 'local_address' || key === 'permanent_address') {
      const localAddress = String(values.local_address ?? '')
      return (
        <FieldWrap label={FIELD_LABELS[key]} hint={commonErr} htmlFor={fid}>
          {key === 'permanent_address' ? (
            <div className="mb-2 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => patch('permanent_address', localAddress)}
                disabled={!localAddress.trim()}
              >
                Same as local
              </Button>
            </div>
          ) : null}
          <textarea id={fid} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={values[key] ?? ''} onChange={(ev) => patch(key, ev.target.value)} />
        </FieldWrap>
      )
    }
    if (key === 'personel_image') {
      return (
        <FieldWrap label={FIELD_LABELS[key]} hint={commonErr} htmlFor={fid}>
          <Input id={fid} type="url" placeholder="https://" value={values[key] ?? ''} onChange={(ev) => patch(key, ev.target.value)} aria-invalid={Boolean(commonErr)} />
        </FieldWrap>
      )
    }
    return (
      <FieldWrap label={FIELD_LABELS[key]} hint={commonErr} htmlFor={fid}>
        <Input id={fid} value={typeof values[key] === 'boolean' ? String(values[key]) : (values[key] ?? '')} onChange={(ev) => patch(key, ev.target.value)} aria-invalid={Boolean(commonErr)} />
      </FieldWrap>
    )
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    const nextValues = { ...values }
    if (!String(nextValues.last_interview_date ?? '').trim()) nextValues.status = 'Active'
    const nextErr = validate(nextValues)
    const card = String(nextValues.card_no ?? '').trim().toUpperCase()
    const weeklyOff = String(nextValues.weekly_off ?? '').trim()
    if (weeklyOff && !WEEKLY_OFF_OPTIONS.includes(weeklyOff)) nextErr.weekly_off = 'Weekly off must be a single weekday'
    const salary = String(nextValues.salary ?? '').trim()
    if (salary && Number.isNaN(Number(salary))) nextErr.salary = 'Salary must be numeric'
    setErrors(nextErr)
    const firstBadTab = TAB_CONFIG.find((t) => t.fields.some((f) => Object.prototype.hasOwnProperty.call(nextErr, f)))
    if (firstBadTab) setTab(firstBadTab.value)
    if (Object.keys(nextErr).length === 0) onSubmitted?.({ ...nextValues, card_no: card })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          {TAB_CONFIG.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className="flex-1 whitespace-nowrap px-3 text-xs sm:text-sm">{label}</TabsTrigger>
          ))}
        </TabsList>
        {TAB_CONFIG.map(({ value, fields }) => (
          <TabsContent key={value} value={value} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {fields.map((key) => <div key={key}>{renderControl(key)}</div>)}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        {onOfferLetter ? (
          <Button type="button" variant="secondary" onClick={() => onOfferLetter({ ...values })}>
            Offer letter
          </Button>
        ) : null}
        <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">{submitLabel}</Button>
      </div>
    </form>
  )
}

