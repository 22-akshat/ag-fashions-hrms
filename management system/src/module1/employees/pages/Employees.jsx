import { useMemo, useState } from 'react'
import { FileDown, LayoutGrid, List, Loader2, Plus, Search, Upload } from 'lucide-react'
import { EmployeeCard } from '@/module1/employees/components/EmployeeCard'
import { EmployeeForm } from '@/module1/employees/components/EmployeeForm'
import { OfferLetterDialog } from '@/module1/employees/components/OfferLetterDialog'
import { useEmployees } from '@/module1/employees/context/EmployeesContext'
import {
  ALL_FIELD_KEYS,
  DEPARTMENT_OPTIONS,
  FIELD_LABELS,
  createEmptyEmployee,
  mergeDepartmentOptions,
  normalizeDepartmentName,
} from '@/module1/employees/lib/employeeFields'
import {
  importEmployeesFromCsv,
  PREVIEW_TABLE_COLUMNS,
} from '@/module1/employees/lib/csv/importEmployees'
import { formatSupabaseError } from '@/module1/employees/lib/supabase/errors'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

function matchesSearch(employee, q) {
  if (!q.trim()) return true
  const s = q.toLowerCase().trim()
  const pool = [
    employee.card_no,
    employee.full_name,
    employee.father_husband_name,
    employee.department,
    employee.designation,
    employee.job_location,
    employee.phone_no_1,
    employee.phone_no_2,
    employee.personal_email,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return pool.includes(s) || pool.split(/\s+/).some((word) => word.includes(s))
}

function compareByCardNo(a, b) {
  const ax = String(a.card_no ?? '').trim().toUpperCase()
  const bx = String(b.card_no ?? '').trim().toUpperCase()
  if (!ax && !bx) return 0
  if (!ax) return 1
  if (!bx) return -1
  return ax.localeCompare(bx, undefined, { numeric: true, sensitivity: 'base' })
}

function resetCsvImportState(setters) {
  const {
    setImportOpen,
    setCsvImportResult,
    setImporting,
    setCsvFileLabel,
    setCsvImportInputKey,
  } = setters
  setImportOpen(false)
  setCsvImportResult(null)
  setImporting(false)
  setCsvFileLabel('')
  setCsvImportInputKey((k) => k + 1)
}

export function Employees() {
  const {
    employees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    importEmployeesBulk,
    loading,
    loadError,
    refresh,
    remote,
  } = useEmployees()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deptFilter, setDeptFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [draftEmployee, setDraftEmployee] = useState(null)
  const [customDepartments, setCustomDepartments] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [csvImportResult, setCsvImportResult] = useState(null)
  const [csvFileLabel, setCsvFileLabel] = useState('')
  const [importing, setImporting] = useState(false)
  const [csvImportInputKey, setCsvImportInputKey] = useState(0)
  const [viewMode, setViewMode] = useState('card')
  const [detailTarget, setDetailTarget] = useState(null)
  const [offerLetterOpen, setOfferLetterOpen] = useState(false)
  const [offerLetterEmployee, setOfferLetterEmployee] = useState(null)

  const departments = useMemo(() => {
    return mergeDepartmentOptions([...DEPARTMENT_OPTIONS, ...customDepartments])
  }, [customDepartments])

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (!matchesSearch(e, search)) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (
        deptFilter !== 'all' &&
        normalizeDepartmentName(e.department).toLowerCase() !== normalizeDepartmentName(deptFilter).toLowerCase()
      ) {
        return false
      }
      return true
    }).sort(compareByCardNo)
  }, [employees, search, statusFilter, deptFilter])

  function genId() {
    return crypto.randomUUID?.() ?? `emp-${Date.now().toString(36)}`
  }
  function openCreate() {
    setFormMode('create')
    setDraftEmployee(createEmptyEmployee(genId()))
    setFormOpen(true)
  }
  function openImport() {
    setCsvImportResult(null)
    setCsvFileLabel('')
    setCsvImportInputKey((k) => k + 1)
    setImportOpen(true)
  }

  /** @type {React.ChangeEventHandler<HTMLInputElement>} */
  function handleCsvFile(ev) {
    const file = ev.target.files?.[0]
    if (!file) {
      setCsvImportResult(null)
      setCsvFileLabel('')
      return
    }
    setCsvFileLabel(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      setCsvImportResult(importEmployeesFromCsv(text))
    }
    reader.onerror = () => {
      toast({
        title: 'Could not read file',
        description: reader.error?.message ?? 'Unknown read error.',
        variant: 'destructive',
      })
      setCsvImportResult(null)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleCsvImportSubmit() {
    if (!csvImportResult?.valid.length) return
    setImporting(true)
    try {
      const n = await importEmployeesBulk(csvImportResult.valid)
      toast({ title: 'Import complete', description: `Imported ${n} employee${n === 1 ? '' : 's'}.` })
      resetCsvImportState({ setImportOpen, setCsvImportResult, setImporting, setCsvFileLabel, setCsvImportInputKey })
    } catch (err) {
      toast({ title: 'Import failed', description: formatSupabaseError(err), variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  function openEdit(employee) {
    setFormMode('edit')
    setDraftEmployee({ ...employee })
    setFormOpen(true)
  }
  async function handleFormSubmitted(data) {
    try {
      if (formMode === 'create') {
        await addEmployee(data)
        toast({ title: 'Employee added', description: `${data.full_name} is now on the roster.` })
      } else {
        await updateEmployee(data.id, data)
        toast({ title: 'Employee updated', description: 'Changes were saved successfully.' })
      }
      setFormOpen(false)
      setDraftEmployee(null)
    } catch (err) {
      toast({ title: 'Could not save', description: formatSupabaseError(err), variant: 'destructive' })
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const name = deleteTarget.full_name
    const id = deleteTarget.id
    try {
      await deleteEmployee(id)
      toast({ title: 'Employee deleted', description: `${name ?? 'Record'} removed from the directory.`, variant: 'destructive' })
      setDeleteTarget(null)
    } catch (err) {
      toast({ title: 'Delete failed', description: formatSupabaseError(err), variant: 'destructive' })
    }
  }

  const csvValidCount = csvImportResult?.valid?.length ?? 0
  const csvErrors = csvImportResult?.errors ?? []
  const csvPreview = csvImportResult?.previewRows ?? []

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7">
      {remote ? <p className="text-xs font-medium uppercase tracking-wide text-accent">Data source: Supabase</p> : null}
      {loadError ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-semibold text-destructive">Could not load employees</p>
            <p className="text-muted-foreground">{loadError}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} className="shrink-0">Retry</Button>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 rounded-3xl border border-[#d1e4eb] bg-white/95 px-5 py-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#193250] md:text-3xl">Employees</h1>
          <p className="mt-1 text-sm text-[#667f97]">Search and manage your workforce. Every record exposes all tracked HR fields.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <div className="flex items-center rounded-xl border border-[#d0e1e8] bg-[#f7fbfd] p-1">
            <Button
              type="button"
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              title="Card view"
              aria-label="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              title="List view"
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="sm:shrink-0"
            onClick={openImport}
            title="Import CSV"
            aria-label="Import CSV"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            className="sm:shrink-0"
            onClick={openCreate}
            title="Add employee"
            aria-label="Add employee"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-3xl border border-[#d2e4eb] bg-white/95 p-4 shadow-sm md:flex-row md:items-end">
        <div className="relative min-w-[200px] flex-1 md:max-w-md">
          <Label htmlFor="emp-search" className="sr-only">Search</Label>
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="emp-search" placeholder="Search name, card, email, phones…" value={search} onChange={(ev) => setSearch(ev.target.value)} className="rounded-xl border-[#d3e5ec] bg-[#f8fcfe] pl-9" />
        </div>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:w-auto md:min-w-[200px] md:grid-cols-1 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="emp-status-filter">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="emp-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-dept-filter">Department</Label>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger id="emp-dept-filter"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className={viewMode === 'card' ? 'grid grid-cols-1 gap-6 lg:grid-cols-2' : ''}>
        {loading && employees.length === 0 && !loadError ? (
          <p className="col-span-full rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">Loading employees from Supabase…</p>
        ) : filtered.length === 0 ? (
          <p className="col-span-full rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
            {employees.length === 0 ? 'No employees yet. Add your first record or run the seed SQL.' : 'No employees match your filters.'}
          </p>
        ) : viewMode === 'card' ? (
          filtered.map((e) => <EmployeeCard key={e.id} employee={e} onOpen={setDetailTarget} />)
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-[#d2e4eb] bg-white/95">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[#eff7fa]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Department</th>
                  <th className="px-3 py-2 text-left font-medium">Designation</th>
                  <th className="px-3 py-2 text-left font-medium">Location</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Phone</th>
                  <th className="px-3 py-2 text-right font-medium">Salary</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer border-t border-[#e1edf2] hover:bg-[#f3f9fc]"
                    onClick={() => setDetailTarget(e)}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{e.full_name}</p>
                      <p className="text-xs text-muted-foreground">{e.father_husband_name || '—'}</p>
                    </td>
                    <td className="px-3 py-2">{e.department || '—'}</td>
                    <td className="px-3 py-2">{e.designation || '—'}</td>
                    <td className="px-3 py-2">{e.job_location || '—'}</td>
                    <td className="px-3 py-2">{e.status || '—'}</td>
                    <td className="px-3 py-2">{e.phone_no_1 || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      ₹{Number(e.salary ?? 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); setDraftEmployee(null) } }}>
        <DialogContent className="max-h-[min(90vh,720px)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Add employee' : 'Edit employee'}</DialogTitle>
            <DialogDescription>Complete all sections. Required fields are validated before save.</DialogDescription>
          </DialogHeader>
          {draftEmployee ? (
            <EmployeeForm
              key={draftEmployee.id}
              employee={draftEmployee}
              submitLabel={formMode === 'create' ? 'Create employee' : 'Save changes'}
              onCancel={() => { setFormOpen(false); setDraftEmployee(null) }}
              onSubmitted={handleFormSubmitted}
              onOfferLetter={(data) => {
                setOfferLetterEmployee(data)
                setOfferLetterOpen(true)
              }}
              departmentOptions={departments}
              onAddDepartment={(name) => {
                const normalized = normalizeDepartmentName(name)
                if (!normalized) return
                setCustomDepartments((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]))
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) resetCsvImportState({ setImportOpen, setCsvImportResult, setImporting, setCsvFileLabel, setCsvImportInputKey }) }}>
        <DialogContent className="flex max-h-[min(92vh,800px)] max-w-4xl flex-col gap-4 overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Import employees from CSV</DialogTitle>
            <DialogDescription>
              Headers must match the sample (snake_case). Fix validation errors in your file before importing.
              {remote ? ' Valid rows upload to Supabase.' : ' In demo mode, valid rows merge into local data.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="csv-employees-upload" className="text-foreground">CSV file</Label>
              <a href="/sample-employees.csv" download="sample-employees.csv" className="inline-flex items-center gap-2 text-sm font-medium text-accent underline-offset-4 hover:underline">
                <FileDown className="h-4 w-4 shrink-0" />Download sample CSV
              </a>
            </div>
            <Input key={csvImportInputKey} id="csv-employees-upload" type="file" accept=".csv,text/csv" className="cursor-pointer" onChange={handleCsvFile} />
            {csvFileLabel ? <p className="text-xs text-muted-foreground">Selected: <span className="font-medium text-foreground">{csvFileLabel}</span></p> : null}
            {csvImportResult ? (
              <>
                <p className="text-sm font-medium"><span className="text-accent">{csvValidCount} valid</span><span className="text-muted-foreground"> · </span><span className="text-destructive">{csvErrors.length} errors</span></p>
                {csvErrors.length > 0 ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Issues</p>
                    <ul className="mt-2 max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-sm text-muted-foreground">
                      {csvErrors.map((e, idx) => <li key={`${e.rowNumber}-${idx}`}>{e.rowNumber > 0 ? <span className="font-medium">Row {e.rowNumber}: </span> : null}{e.message}</li>)}
                    </ul>
                  </div>
                ) : null}
                {csvPreview.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview (first 5 rows)</p>
                    <div className="overflow-x-auto rounded-md border border-border">
                      <table className="w-full min-w-[560px] text-left text-xs">
                        <thead className="bg-muted/80"><tr>{PREVIEW_TABLE_COLUMNS.map((col) => <th key={col} className="border-b border-border px-2 py-2 font-semibold capitalize">{col.replace(/_/g, ' ')}</th>)}</tr></thead>
                        <tbody>{csvPreview.map((row, ri) => <tr key={ri} className="even:bg-muted/20">{PREVIEW_TABLE_COLUMNS.map((col) => <td key={col} className="border-b border-border px-2 py-1.5"><span className="line-clamp-2">{row[col] ?? '—'}</span></td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </>
            ) : csvFileLabel ? (
              <p className="text-sm text-muted-foreground">Parsing CSV…</p>
            ) : (
              <p className="text-sm text-muted-foreground">Choose a .csv file to validate and preview.</p>
            )}
          </div>
          <DialogFooter className="shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => resetCsvImportState({ setImportOpen, setCsvImportResult, setImporting, setCsvFileLabel, setCsvImportInputKey })} disabled={importing}>Cancel</Button>
            <Button type="button" disabled={!csvImportResult || csvValidCount === 0 || importing} onClick={() => void handleCsvImportSubmit()}>
              {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />Importing…</> : `Import ${csvValidCount} employee${csvValidCount === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete employee?</DialogTitle>
            <DialogDescription>
              This removes <span className="font-medium text-foreground">{deleteTarget?.full_name}</span> from the directory. This action cannot be undone in this demo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OfferLetterDialog
        employee={offerLetterEmployee}
        open={offerLetterOpen}
        onOpenChange={(open) => {
          setOfferLetterOpen(open)
          if (!open) setOfferLetterEmployee(null)
        }}
      />

      <Dialog open={Boolean(detailTarget)} onOpenChange={(o) => !o && setDetailTarget(null)}>
        <DialogContent className="max-h-[min(90vh,760px)] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailTarget?.full_name || 'Employee details'}</DialogTitle>
            <DialogDescription>
              Full employee profile from all saved fields.
            </DialogDescription>
          </DialogHeader>
          {detailTarget ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ALL_FIELD_KEYS.map((key) => (
                <div key={key} className="rounded-md border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{FIELD_LABELS[key]}</p>
                  <p className="mt-1 break-words text-sm text-foreground">
                    {key === 'salary'
                      ? `₹${Number(detailTarget[key] ?? 0).toLocaleString('en-IN')}`
                      : detailTarget[key] || '—'}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDetailTarget(null)}>
              Close
            </Button>
            {detailTarget ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const e = detailTarget
                    setOfferLetterEmployee(e)
                    setOfferLetterOpen(true)
                    setDetailTarget(null)
                  }}
                >
                  Offer letter
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDeleteTarget(detailTarget)
                    setDetailTarget(null)
                  }}
                >
                  Delete employee
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    openEdit(detailTarget)
                    setDetailTarget(null)
                  }}
                >
                  Edit employee
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

