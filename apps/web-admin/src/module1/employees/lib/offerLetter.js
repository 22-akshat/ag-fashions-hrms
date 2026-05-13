import { parseISO, isValid, format as formatFns } from 'date-fns'

/** Matches your Offer letter format (company block). */
export const OFFER_LETTER_ORG = {
  companyName: 'A G Fashion',
  /** Office line embedded in paragraph 2 (matches sample PDF wording). */
  officeLine: 'Plot No. 257, 2nd Floor, Udyog Vihar Phase-4, Gurgaon Haryana',
  /** Default signing / reporting manager from sample PDF. */
  reportingTo: 'Mr. Ayush Gupta',
  workSchedule: 'Full-time 8 Hours',
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseYmd(raw) {
  const s = String(raw ?? '').trim().slice(0, 10)
  if (!s) return null
  const d = parseISO(s)
  return isValid(d) ? d : null
}

export function honorificFromGender(gender) {
  const g = String(gender ?? '').toLowerCase().trim()
  if (g === 'female') return 'Ms.'
  return 'Mr.'
}

/** First token for salutation (“Dear Rahul”). */
export function dearNameFromFull(fullName) {
  const t = String(fullName ?? '').trim().split(/\s+/)[0]
  return t || 'Candidate'
}

/** Prefer whichever field has text: local first, then permanent (both trimmed). */
export function combineEmployeeAddress(e) {
  const norm = (v) => String(v ?? '').replace(/\u00a0/g, ' ').trim()
  const l = norm(e.local_address)
  const p = norm(e.permanent_address)
  return l || p || ''
}

/** Prefer last_interview_date, then DOI, then created_date, else today. */
export function effectiveStartDate(e) {
  return (
    parseYmd(e.last_interview_date) ||
    parseYmd(e.date_of_interview) ||
    parseYmd(e.created_date) ||
    new Date()
  )
}

export function letterIssueDate(now = new Date()) {
  return now
}

/** e.g. 29-04-2026 */
export function formatDdMmYyyy(d) {
  return formatFns(d, 'dd-MM-yyyy')
}

function ordinal(day) {
  const j = day % 10
  const k = day % 100
  if (k >= 11 && k <= 13) return `${day}th`
  if (j === 1) return `${day}st`
  if (j === 2) return `${day}nd`
  if (j === 3) return `${day}rd`
  return `${day}th`
}

/** e.g. 4th May, 2026 */
export function formatEffectiveLong(d) {
  const mon = formatFns(d, 'MMMM')
  const y = formatFns(d, 'yyyy')
  return `${ordinal(d.getDate())} ${mon}, ${y}`
}

export function salaryRsDisplay(e) {
  const n = Number(e.salary ?? 0)
  if (!Number.isFinite(n) || n < 0) return '0.00'
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Builds a standalone HTML document (preview + print).
 * @param {Record<string, unknown>} employee Partial or full employee object
 */
export function buildOfferLetterHtml(employee, options = {}) {
  const issueDate = parseYmd(options.issueDateIso) || letterIssueDate()
  const start = parseYmd(options.effectiveDateIso) || effectiveStartDate(employee)
  const title = OFFER_LETTER_ORG.companyName
  const honor = honorificFromGender(employee.gender)
  const full = String(options.fullName ?? employee.full_name ?? '').trim() || '—'
  const designation = String(employee.designation ?? '').trim() || 'the offered position'
  const address = combineEmployeeAddress(employee)
  const dear = escapeHtml(dearNameFromFull(full))
  const effLong = escapeHtml(formatEffectiveLong(start))
  const issueDdMmYyyy = escapeHtml(formatDdMmYyyy(issueDate))
  const office = escapeHtml(OFFER_LETTER_ORG.officeLine)
  const designationEsc = escapeHtml(designation)
  const salaryLine = escapeHtml(
    Number.isFinite(Number(options.salary))
      ? Number(options.salary).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : salaryRsDisplay(employee),
  )
  const reportingEsc = escapeHtml(String(options.reportingTo ?? OFFER_LETTER_ORG.reportingTo))
  const scheduleEsc = escapeHtml(String(options.workSchedule ?? OFFER_LETTER_ORG.workSchedule))
  const acceptName = escapeHtml(full)
  const acceptDate = escapeHtml(formatDdMmYyyy(new Date()))

  const css = `
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.55; margin: 0; padding: 24px 32px 48px; max-width: 720px; }
    h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 16px; text-transform: uppercase; text-align: center; letter-spacing: 0.04em; }
    .muted { white-space: pre-wrap; margin: 12px 0; }
    p { margin: 12px 0; text-align: justify; }
    .block { margin: 16px 0; white-space: pre-line; line-height: 1.65; }
    .sign { margin-top: 48px; }
    .muted-small { margin-top: 32px; font-size: 0.95rem; }
    .accept-border { margin-top: 48px; border-top: 1px solid #333; padding-top: 16px; }
    @media print {
      body { padding: 0; max-width: none; }
    }
  `.replace(/\s+/g, ' ')

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Offer Letter — ${escapeHtml(full)}</title><style>${css}</style></head><body>
<h1>OFFER LETTER</h1>
<div class="muted">${issueDdMmYyyy}</div>
<div class="muted">${honor === 'Ms.' ? 'Ms.' : 'Mr.'} ${escapeHtml(full)}${address ? `\nAddress: ${escapeHtml(address)}` : ''}</div>
<p>Dear ${dear},</p>
<p>Congratulation! We have selected you for the ${designationEsc} at ${escapeHtml(title)} ${office} will be effective from ${effLong} and decided to provide you an Appointment letter regarding this.</p>
<p>We are pleased to offer you the position of ${designationEsc}. We believe your skills and experience will be a valuable addition to our team.</p>
<div class="block">Position Details: \t${designationEsc}<br/>
Start Date: ${effLong}<br/>
Work Schedule: ${scheduleEsc}<br/>
Total CTC (Salary Per Month) Rs. ${salaryLine}<br/>
Reporting to: ${reportingEsc}</div>
<p>We look forward to welcoming you to ${escapeHtml(title)}. If you have any questions, feel free to reach out.</p>
<p>Sincerely,<br/><br/>${escapeHtml(title)}<br/>Authorized Signatory</p>
<div class="accept-border">
<p style="margin:0;"><strong>Acceptance</strong></p>
<p>I, ${acceptName} accept the terms of this offer.</p>
<p style="margin:24px 0 8px;"><strong>Signature</strong></p>
<p>${acceptDate}</p>
</div>
</body></html>`

  return html
}
