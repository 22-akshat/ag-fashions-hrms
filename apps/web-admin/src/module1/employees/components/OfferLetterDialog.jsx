import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildOfferLetterHtml } from '@/module1/employees/lib/offerLetter'

export function OfferLetterDialog({ employee, open, onOpenChange }) {
  function handleOpenChange(nextOpen) {
    if (!nextOpen) setGenerated(null)
    onOpenChange?.(nextOpen)
  }

  const [generated, setGenerated] = useState(null)

  const defaults = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (!employee) {
      return {
        issueDate: today,
        fullName: '',
        workSchedule: 'Full-time 8 Hours',
        joiningDate: today,
        reportingTo: 'Mr. Ayush Gupta',
        salary: '0',
      }
    }
    return {
      issueDate: today,
      fullName: String(employee.full_name ?? ''),
      workSchedule: 'Full-time 8 Hours',
      joiningDate: String(employee.last_interview_date || employee.date_of_interview || employee.created_date || today).slice(0, 10),
      reportingTo: 'Mr. Ayush Gupta',
      salary: String(employee.salary ?? '0'),
    }
  }, [employee])

  const docHtml = useMemo(() => {
    if (!employee || !generated) return ''
    return buildOfferLetterHtml(employee, {
      issueDateIso: generated.issueDate,
      fullName: generated.fullName,
      workSchedule: generated.workSchedule,
      effectiveDateIso: generated.joiningDate,
      reportingTo: generated.reportingTo,
      salary: generated.salary,
    })
  }, [employee, generated])

  function handleGenerate(ev) {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    const next = {
      issueDate: String(fd.get('issueDate') ?? ''),
      fullName: String(fd.get('fullName') ?? ''),
      workSchedule: String(fd.get('workSchedule') ?? ''),
      joiningDate: String(fd.get('joiningDate') ?? ''),
      reportingTo: String(fd.get('reportingTo') ?? ''),
      salary: String(fd.get('salary') ?? ''),
    }
    if (!next.issueDate || !next.fullName.trim() || !next.workSchedule.trim() || !next.joiningDate || !next.reportingTo.trim()) return
    setGenerated(next)
  }

  function handlePrint() {
    if (!docHtml) return
    const w = window.open('', '_blank', 'width=840,height=1000')
    if (!w) return
    w.document.write(docHtml)
    w.document.close()
    w.focus()
    setTimeout(() => {
      w.print()
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,900px)] max-w-3xl flex-col gap-3 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Offer letter</DialogTitle>
          <DialogDescription>
            Fill these details first, then generate and print.
          </DialogDescription>
        </DialogHeader>
        <form
          key={`${employee?.id ?? 'none'}-${open ? 'open' : 'closed'}`}
          className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 md:grid-cols-2"
          onSubmit={handleGenerate}
        >
          <div className="space-y-1.5">
            <Label htmlFor="offer-issue-date">Date</Label>
            <Input id="offer-issue-date" name="issueDate" type="date" defaultValue={defaults.issueDate} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-full-name">Name</Label>
            <Input id="offer-full-name" name="fullName" defaultValue={defaults.fullName} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-work-hours">Working hours</Label>
            <Input id="offer-work-hours" name="workSchedule" defaultValue={defaults.workSchedule} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-joining-date">Joining date</Label>
            <Input id="offer-joining-date" name="joiningDate" type="date" defaultValue={defaults.joiningDate} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-reporting-to">Reporting to</Label>
            <Input id="offer-reporting-to" name="reportingTo" defaultValue={defaults.reportingTo} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-salary">Salary CTC</Label>
            <Input id="offer-salary" name="salary" type="number" min="0" step="0.01" defaultValue={defaults.salary} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" variant="secondary" disabled={!employee}>
              Generate offer letter
            </Button>
          </div>
        </form>
        {employee ? (
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-muted/20">
            <iframe
              title="Offer letter preview"
              className="h-[min(65vh,560px)] w-full border-0 bg-white"
              srcDoc={docHtml || '<!doctype html><html><body style="font-family: sans-serif; padding: 24px;">Click "Generate offer letter" to preview.</body></html>'}
            />
          </div>
        ) : null}
        <DialogFooter className="shrink-0 gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button type="button" disabled={!employee || !generated} onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" aria-hidden />
            Print offer letter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
