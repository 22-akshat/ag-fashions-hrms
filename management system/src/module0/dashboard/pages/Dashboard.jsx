import { useEffect, useMemo, useState } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Users } from 'lucide-react'
import { useEmployees } from '@/module1/employees/context/EmployeesContext'
import { isSupabaseConfigured } from '@/module1/employees/lib/supabase/client'
import { StatsCards } from '@/components/StatsCards'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const CHART_COLORS = ['#4ba9c8', '#5e8ed6', '#78b0b3', '#f2b55d', '#9f8be6', '#67b784']

export function Dashboard() {
  const { employees, loading: employeesLoading, loadError, refresh, remote } = useEmployees()
  const [introDelay, setIntroDelay] = useState(() => !isSupabaseConfigured())

  useEffect(() => {
    if (remote) return undefined
    const t = window.setTimeout(() => setIntroDelay(false), 550)
    return () => window.clearTimeout(t)
  }, [remote])

  const loading = employeesLoading || introDelay

  const stats = useMemo(() => {
    const total = employees.length
    const active = employees.filter((e) => e.status === 'Active').length
    const inactive = employees.filter((e) => e.status === 'Inactive').length
    const departments = new Set(employees.map((e) => e.department).filter(Boolean)).size
    return { total, active, inactive, departments }
  }, [employees])

  const departmentData = useMemo(() => {
    const map = employees.reduce((acc, e) => {
      const d = e.department?.trim() || 'Unassigned'
      acc[d] = (acc[d] ?? 0) + 1
      return acc
    }, /** @type {Record<string, number>} */ ({}))
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [employees])

  const recentHires = useMemo(() => {
    return [...employees]
      .sort((a, b) => {
        const da = parseISO(a.date_of_interview ?? '')
        const db = parseISO(b.date_of_interview ?? '')
        const ta = isValid(da) ? da.getTime() : 0
        const tb = isValid(db) ? db.getTime() : 0
        return tb - ta
      })
      .slice(0, 5)
  }, [employees])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7">
      {remote ? (
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Data source: Supabase</p>
      ) : null}

      {loadError ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/35 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
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
        <h1 className="text-2xl font-semibold tracking-tight text-[#193250] md:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-[#657f97]">
          Overview of your workforce, departments, and recent joiners.
        </p>
      </div>

      <StatsCards loading={loading} stats={stats} />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="rounded-3xl border-[#d2e3ea] bg-white/95 shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-[#1b3553]">Department distribution</CardTitle>
            <CardDescription className="text-[#6d879f]">Headcount share by department</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Skeleton className="h-56 w-56 rounded-full" />
              </div>
            ) : departmentData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees to chart yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {departmentData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-[#d2e3ea] bg-white/95 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1b3553]">
              <Users className="h-5 w-5 text-[#f58f34]" />
              Recent hires
            </CardTitle>
            <CardDescription className="text-[#6d879f]">Latest five records by interview date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-[75%]" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              recentHires.map((e) => {
                const joined = parseISO(e.date_of_interview ?? '')
                return (
                  <div
                    key={e.id}
                    className="flex items-start gap-3 rounded-2xl border border-[#deebf0] bg-[#f8fcfe] p-3"
                  >
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={e.personel_image} alt="" />
                      <AvatarFallback>{e.full_name?.slice(0, 2)?.toUpperCase() ?? '—'}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{e.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{e.department}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Interviewed {isValid(joined) ? format(joined, 'MMM d, yyyy') : '—'}
                        </span>
                        <Badge variant={e.status === 'Active' ? 'success' : 'warning'} className="text-[10px]">
                          {e.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
