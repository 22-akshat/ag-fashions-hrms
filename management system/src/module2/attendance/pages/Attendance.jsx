import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Navigation, Radio } from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parse,
  startOfMonth,
} from 'date-fns'
import { useEmployees } from '@/module1/employees/context/EmployeesContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { isSupabaseConfigured, supabase } from '@/module1/employees/lib/supabase/client'
import {
  findShopById,
  findLatestAccessRequestByIdentity,
  listAccessRequests,
  updateAccessRequestStatus,
} from '@/module2/attendance/lib/accessRequestsApi'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const ATTENDANCE_KEY = 'attendance:v1'
const STATUS_COLORS = {
  Present: 'bg-[#dcf5e6] text-[#2d8a58] ring-1 ring-[#9fd6b4]',
  Absent: 'bg-[#ffe2df] text-[#bf4d47] ring-1 ring-[#f0a6a2]',
  Leave: 'bg-[#e0efff] text-[#3967b4] ring-1 ring-[#aac5ef]',
  'Half Day': 'bg-[#fff2d9] text-[#b07621] ring-1 ring-[#eac98c]',
}
const WEEK_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STORE_NAME = import.meta.env.VITE_STORE_NAME || 'AG Fashions Store'
const LIVE_DISTANCE_LIMIT_METERS = 25

function todayMonth() {
  return format(new Date(), 'yyyy-MM')
}

function loadAttendanceStore() {
  try {
    const raw = window.localStorage.getItem(ATTENDANCE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function monthDate(monthValue) {
  return parse(`${monthValue}-01`, 'yyyy-MM-dd', new Date())
}

function isoFromDate(d) {
  return format(d, 'yyyy-MM-dd')
}

function statusClass(status) {
  return STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'
}

function employeeStatusOnDate(store, employeeId, dateIso) {
  return store[dateIso]?.[employeeId]?.status ?? ''
}

function isValidCoordinate(value) {
  return Number.isFinite(value) && Math.abs(value) <= 180
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (n) => (n * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

export function Attendance() {
  const { employees, loading, loadError, refresh, remote } = useEmployees()
  const [store] = useState(() => loadAttendanceStore())
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [activeMonth, setActiveMonth] = useState(todayMonth)
  const [requests, setRequests] = useState([])
  const [requestLoading, setRequestLoading] = useState(isSupabaseConfigured())
  const [requestError, setRequestError] = useState('')
  const [busyRequestId, setBusyRequestId] = useState('')
  const [attendanceLogs, setAttendanceLogs] = useState([])
  const [employeeLocations, setEmployeeLocations] = useState({})
  const [calendarLogs, setCalendarLogs] = useState({})
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [liveDialogOpen, setLiveDialogOpen] = useState(false)
  const [liveQuery, setLiveQuery] = useState('')
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveResult, setLiveResult] = useState(null)
  const [liveShop, setLiveShop] = useState(null)
  const [liveError, setLiveError] = useState('')

  const fetchAccessRequests = useCallback(async () => {
    setRequestLoading(true)
    setRequestError('')
    try {
      const rows = await listAccessRequests()
      setRequests(rows)
    } catch (error) {
      setRequestError(String(error?.message ?? error))
    } finally {
      setRequestLoading(false)
    }
  }, [])

  const fetchAttendanceLogs = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('id, employee_id, timestamp, face_verified, status, employees(full_name)')
      .order('timestamp', { ascending: false })
      .limit(200)
    if (error) {
      console.error(error)
      return
    }
    setAttendanceLogs((data ?? []).map(normalizeAttendanceLogRow))
  }, [])

  const fetchEmployeeLocations = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('employee_locations')
      .select('employee_id, lat, lng, accuracy, recorded_at, employees(full_name)')

    if (error) {
      console.error(error)
      return
    }

    const map = {}
    ;(data ?? []).forEach((row) => {
      map[row.employee_id] = row
    })
    setEmployeeLocations(map)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return
    const t = window.setTimeout(() => {
      void fetchAccessRequests()
      void fetchAttendanceLogs()
      void fetchEmployeeLocations()
    }, 0)

    const requestChannel = supabase
      .channel('access-requests-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_access_requests' },
        () => {
          void fetchAccessRequests()
        },
      )
      .subscribe()

    const attendanceChannel = supabase
      .channel('attendance-logs-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        () => {
          void fetchAttendanceLogs()
        },
      )
      .subscribe()

    const locationChannel = supabase
      .channel('employee-locations-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employee_locations' },
        () => {
          void fetchEmployeeLocations()
        },
      )
      .subscribe()

    return () => {
      window.clearTimeout(t)
      void supabase.removeChannel(requestChannel)
      void supabase.removeChannel(attendanceChannel)
      void supabase.removeChannel(locationChannel)
    }
  }, [fetchAccessRequests, fetchAttendanceLogs, fetchEmployeeLocations])

  async function handleRequestStatus(requestId, status) {
    setBusyRequestId(requestId)
    try {
      await updateAccessRequestStatus(requestId, status)
      if (status !== 'pending') {
        setRequests((prev) => prev.filter((item) => item.id !== requestId))
      }
      toast({
        title: `Request ${status}`,
        description: 'Attendance app user can proceed based on this decision.',
      })
    } catch (error) {
      toast({
        title: 'Failed to update request',
        description: String(error?.message ?? error),
        variant: 'destructive',
      })
    } finally {
      setBusyRequestId('')
    }
  }

  async function handleLiveSearch(event) {
    event.preventDefault()
    if (!liveQuery.trim()) return

    setLiveLoading(true)
    setLiveError('')
    setLiveResult(null)
    setLiveShop(null)
    try {
      const row = await findLatestAccessRequestByIdentity(liveQuery)
      if (!row) {
        setLiveError('No live GPS request found for this card no or name.')
        return
      }
      setLiveResult(row)
      if (row.requested_shop_id) {
        try {
          const shop = await findShopById(row.requested_shop_id)
          setLiveShop(shop)
        } catch (shopError) {
          setLiveError(String(shopError?.message ?? shopError))
        }
      }
    } catch (error) {
      setLiveError(String(error?.message ?? error))
    } finally {
      setLiveLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedEmployee?.id || !supabase) {
      const t = window.setTimeout(() => {
        setCalendarLogs({})
        setCalendarLoading(false)
      }, 0)
      return () => window.clearTimeout(t)
    }

    let active = true
    async function loadCalendarLogs() {
      setCalendarLoading(true)
      try {
        const monthStart = startOfMonth(monthDate(activeMonth))
        const monthEndExclusive = addMonths(monthStart, 1)
        const { data, error } = await supabase
          .from('attendance_logs')
          .select('timestamp,status')
          .eq('employee_id', selectedEmployee.id)
          .gte('timestamp', monthStart.toISOString())
          .lt('timestamp', monthEndExclusive.toISOString())
          .order('timestamp', { ascending: false })
        if (!active) return
        if (error) throw error

        const mapped = {}
        for (const row of data ?? []) {
          const dateIso = String(row.timestamp || '').slice(0, 10)
          if (!dateIso) continue
          mapped[dateIso] = normalizeAttendanceStatus(row.status)
        }
        setCalendarLogs(mapped)
      } catch {
        if (active) setCalendarLogs({})
      } finally {
        if (active) setCalendarLoading(false)
      }
    }

    void loadCalendarLogs()
    return () => {
      active = false
    }
  }, [activeMonth, selectedEmployee?.id])

  const monthStart = useMemo(() => startOfMonth(monthDate(activeMonth)), [activeMonth])
  const monthEnd = useMemo(() => endOfMonth(monthStart), [monthStart])
  const monthDays = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthStart, monthEnd],
  )
  const startOffset = getDay(monthStart)

  const memberCards = useMemo(() => {
    return employees.map((e) => {
      let present = 0
      let absent = 0
      let leave = 0
      let half = 0
      monthDays.forEach((d) => {
        const st = employeeStatusOnDate(store, e.id, isoFromDate(d))
        if (st === 'Present') present += 1
        if (st === 'Absent') absent += 1
        if (st === 'Leave') leave += 1
        if (st === 'Half Day') half += 1
      })
      return { employee: e, present, absent, leave, half }
    })
  }, [employees, monthDays, store])

  const todayAttendance = useMemo(() => {
    const todayText = new Date().toDateString()
    return attendanceLogs.filter((log) => new Date(log.created_at).toDateString() === todayText)
  }, [attendanceLogs])

  const pendingRequests = requests

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {remote ? <p className="text-xs font-medium uppercase tracking-wide text-accent">Data source: Supabase employees</p> : null}

      {loadError ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-semibold text-destructive">Could not load employees</p>
            <p className="text-muted-foreground">{loadError}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} className="shrink-0">
            Retry
          </Button>
        </div>
      ) : null}

      <div className="rounded-3xl border border-[#d2e4eb] bg-white/95 px-5 py-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-[#193250] md:text-3xl">Attendance</h1>
        <p className="mt-1 text-sm text-[#667f97]">
          Select any member card to open their monthly attendance calendar.
        </p>
      </div>

      <div className="rounded-3xl border border-[#d2e4eb] bg-white/95 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Attendance App Access Requests</h2>
            <p className="text-xs text-muted-foreground">
              Allow-list requests sent from Attendance app registration screen.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-full bg-[#3ba66b] px-3 text-xs font-semibold text-white hover:bg-[#328f5c]"
              onClick={() => setLiveDialogOpen(true)}
            >
              <Radio className="mr-1 h-3.5 w-3.5" />
              Live Attendance
            </Button>
            <Badge variant={pendingRequests.length ? 'destructive' : 'success'} className="uppercase">
              Pending: {pendingRequests.length}
            </Badge>
          </div>
        </div>
        {requestLoading ? (
          <p className="rounded border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
            Loading requests...
          </p>
        ) : requestError ? (
          <p className="rounded border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            {requestError}
          </p>
        ) : pendingRequests.length === 0 ? (
          <p className="rounded border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
            No requests received from attendance app.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingRequests.slice(0, 10).map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {request.requester_name || 'Unknown'} - Card {request.card_no || '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {request.requested_shop_id ? `Store: ${request.requested_shop_id}` : 'Store not selected'} -{' '}
                    {new Date(request.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="uppercase">
                    pending
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyRequestId === request.id}
                    onClick={() => void handleRequestStatus(request.id, 'rejected')}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={busyRequestId === request.id}
                    onClick={() => void handleRequestStatus(request.id, 'approved')}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 rounded-3xl border border-[#d2e4eb] bg-white/95 p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Live attendance today</h2>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
            Updating in real time
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Employee</th>
                <th className="px-4 py-3 text-left font-medium">Clock-in time</th>
                <th className="px-4 py-3 text-left font-medium">Face verified</th>
                <th className="px-4 py-3 text-left font-medium">Last known location</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
                <th className="px-4 py-3 text-left font-medium">Open map</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {todayAttendance.map((log) => {
                const loc = employeeLocations[log.employee_id]
                const employeeName = log.employees?.full_name ?? '—'
                return (
                  <tr key={log.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{employeeName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      {log.face_verified ? (
                        <span className="font-medium text-green-600">Yes</span>
                      ) : (
                        <span className="text-red-500">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {loc ? `${Number(loc.lat).toFixed(5)}, ${Number(loc.lng).toFixed(5)}` : 'No location yet'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {loc?.recorded_at
                        ? new Date(loc.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {loc ? (
                        <a
                          href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View on map
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
              {todayAttendance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No attendance marked today yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-[#d2e4eb] bg-white/95 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[220px,1fr] md:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Month</p>
            <Input
              id="attendance-month"
              type="month"
              value={activeMonth}
              onChange={(ev) => setActiveMonth(ev.target.value || todayMonth())}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={`rounded px-2 py-1 ${statusClass('Present')}`}>Present</span>
            <span className={`rounded px-2 py-1 ${statusClass('Absent')}`}>Absent</span>
            <span className={`rounded px-2 py-1 ${statusClass('Leave')}`}>Leave</span>
            <span className={`rounded px-2 py-1 ${statusClass('Half Day')}`}>Half Day</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="col-span-full rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
            Loading members...
          </p>
        ) : memberCards.length === 0 ? (
          <p className="col-span-full rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
            No employees found.
          </p>
        ) : (
          memberCards.map(({ employee, present, absent, leave, half }) => (
            <button
              key={employee.id}
              type="button"
              onClick={() => setSelectedEmployee(employee)}
              className="rounded-3xl border border-[#d2e4eb] bg-white/95 p-4 text-left shadow-sm transition hover:border-[#8ab8c7] hover:shadow-md"
            >
              <p className="text-sm text-muted-foreground">Card: {employee.card_no || '—'}</p>
              <p className="mt-1 truncate text-base font-semibold text-foreground">{employee.full_name || 'Unnamed employee'}</p>
              <p className="truncate text-sm text-muted-foreground">{employee.department || '—'}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`rounded px-2 py-1 ${statusClass('Present')}`}>P {present}</span>
                <span className={`rounded px-2 py-1 ${statusClass('Absent')}`}>A {absent}</span>
                <span className={`rounded px-2 py-1 ${statusClass('Leave')}`}>L {leave}</span>
                <span className={`rounded px-2 py-1 ${statusClass('Half Day')}`}>H {half}</span>
              </div>
            </button>
          ))
        )}
      </div>

      <Dialog open={Boolean(selectedEmployee)} onOpenChange={(o) => !o && setSelectedEmployee(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-3xl border-[#d2e4eb] bg-[#fbfeff]">
          <DialogHeader>
            <DialogTitle>{selectedEmployee?.full_name || 'Member'} attendance calendar</DialogTitle>
            <DialogDescription>
              {selectedEmployee?.card_no ? `Card ${selectedEmployee.card_no}` : 'Monthly attendance'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" size="icon" onClick={() => setActiveMonth(format(addMonths(monthStart, -1), 'yyyy-MM'))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              value={activeMonth}
              onChange={(ev) => setActiveMonth(ev.target.value || todayMonth())}
              className="max-w-[180px]"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setActiveMonth(format(addMonths(monthStart, 1), 'yyyy-MM'))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {WEEK_HEADERS.map((w) => (
              <div key={w} className="rounded bg-[#edf6fb] py-1 text-center text-xs font-medium text-[#607b94]">
                {w}
              </div>
            ))}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {monthDays.map((d) => {
              const iso = isoFromDate(d)
              const localSt = selectedEmployee ? employeeStatusOnDate(store, selectedEmployee.id, iso) : ''
              const st = calendarLogs[iso] || localSt || ''
              return (
                <div key={iso} className={`min-h-16 rounded-md p-2 text-xs ${statusClass(st)}`}>
                  <p className="font-semibold">{format(d, 'd')}</p>
                  <p className="mt-1">{st || '—'}</p>
                </div>
              )
            })}
          </div>
          {calendarLoading ? (
            <p className="text-center text-xs text-muted-foreground">Syncing attendance logs...</p>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={liveDialogOpen}
        onOpenChange={(open) => {
          setLiveDialogOpen(open)
          if (!open) {
            setLiveLoading(false)
            setLiveError('')
            setLiveResult(null)
            setLiveShop(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl rounded-3xl border-[#d2e4eb] bg-[#fbfeff]">
          <DialogHeader>
            <DialogTitle>Live Attendance Tracker</DialogTitle>
            <DialogDescription>
              Enter card no or employee name to view latest GPS position and distance from store.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLiveSearch} className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={liveQuery}
                onChange={(event) => setLiveQuery(event.target.value)}
                placeholder="Enter card no or name"
                className="rounded-xl border-[#d3e5ec] bg-white"
              />
              <Button type="submit" disabled={liveLoading || !liveQuery.trim()} className="rounded-xl">
                {liveLoading ? 'Searching...' : 'Track'}
              </Button>
            </div>
          </form>

          {liveError ? (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {liveError}
            </p>
          ) : null}

          {liveResult ? (
            <LiveGpsResultCard result={liveResult} liveShop={liveShop} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function normalizeAttendanceStatus(rawStatus) {
  const s = String(rawStatus ?? '').trim().toLowerCase()
  if (s === 'present' || s === 'p') return 'Present'
  if (s === 'absent' || s === 'a') return 'Absent'
  if (s === 'leave' || s === 'l') return 'Leave'
  if (s === 'half day' || s === 'half_day' || s === 'h') return 'Half Day'
  return ''
}

function normalizeAttendanceLogRow(row) {
  const createdAt = row?.created_at || row?.timestamp || new Date().toISOString()
  return {
    ...row,
    created_at: createdAt,
  }
}

function LiveGpsResultCard({ result, liveShop }) {
  const liveLat = Number(result.request_lat)
  const liveLng = Number(result.request_lng)
  const hasLiveCoords = isValidCoordinate(liveLat) && isValidCoordinate(liveLng)
  const shopLat = Number(liveShop?.lat)
  const shopLng = Number(liveShop?.lng)
  const hasStoreCoords = isValidCoordinate(shopLat) && isValidCoordinate(shopLng)
  const distanceMeters =
    hasLiveCoords && hasStoreCoords ? haversineKm(liveLat, liveLng, shopLat, shopLng) * 1000 : Number.NaN
  const isOutOfRange = Number.isFinite(distanceMeters) && distanceMeters > LIVE_DISTANCE_LIMIT_METERS
  const mapsUrl = hasLiveCoords ? `https://maps.google.com/?q=${liveLat},${liveLng}` : ''
  const statusLabel = String(result.status || '').toUpperCase()

  return (
    <div className="space-y-3 rounded-2xl border border-[#d2e4eb] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1c3554]">{result.requester_name || 'Unknown employee'}</p>
          <p className="text-xs text-[#667f97]">Card No: {result.card_no || '-'}</p>
        </div>
        <Badge variant="secondary" className="uppercase">
          {statusLabel || 'PENDING'}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[#f4fbff] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#67839a]">Employee live GPS</p>
          <p className="mt-1 text-sm text-[#1f3c5d]">
            {hasLiveCoords ? `${liveLat.toFixed(6)}, ${liveLng.toFixed(6)}` : 'Not available'}
          </p>
          <p className="text-xs text-[#6c849b]">Accuracy: {result.request_accuracy_m ?? '-'} m</p>
        </div>
        <div className="rounded-xl bg-[#f4fbff] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#67839a]">Store location</p>
          <p className="mt-1 text-sm text-[#1f3c5d]">
            {hasStoreCoords
              ? `${liveShop?.name || STORE_NAME} (${shopLat.toFixed(6)}, ${shopLng.toFixed(6)})`
              : 'Not configured'}
          </p>
          <p className="text-xs text-[#6c849b]">Store comes from `shops` table via requested shop id.</p>
        </div>
      </div>

      {statusLabel === 'REJECTED' ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Latest request is rejected. Employee can send request again; once new pending request arrives it will auto-refresh here.
        </p>
      ) : null}

      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2 ${
          isOutOfRange ? 'bg-red-100' : 'bg-[#ecf7ef]'
        }`}
      >
        <p className={`text-sm font-semibold ${isOutOfRange ? 'text-red-700' : 'text-[#2c7f53]'}`}>
          Distance from store:{' '}
          {Number.isFinite(distanceMeters)
            ? `${distanceMeters.toFixed(1)} m ${isOutOfRange ? '(OUT OF RANGE)' : '(WITHIN RANGE)'}`
            : 'Unavailable (store or live GPS missing)'}
        </p>
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2e7ca0] underline-offset-2 hover:underline"
          >
            <Navigation className="h-3.5 w-3.5" />
            Open in Google Maps
          </a>
        ) : null}
      </div>

      <p className="text-xs text-[#6c849b]">Last GPS update: {new Date(result.created_at).toLocaleString()}</p>
    </div>
  )
}
