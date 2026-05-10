import { Building2, CalendarDays, CircleCheck, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const items = [
  {
    key: 'total',
    label: 'Total employees',
    Icon: Users,
    accent: 'bg-[#dff4f7] text-[#2b6f88]',
    valueKey: 'total',
  },
  {
    key: 'active',
    label: 'Active',
    Icon: CircleCheck,
    accent: 'bg-[#dff5e8] text-[#2a8b58]',
    valueKey: 'active',
  },
  {
    key: 'inactive',
    label: 'Inactive',
    Icon: CalendarDays,
    accent: 'bg-[#fff0d8] text-[#c78221]',
    valueKey: 'inactive',
  },
  {
    key: 'departments',
    label: 'Departments',
    Icon: Building2,
    accent: 'bg-[#e7e5ff] text-[#6659d8]',
    valueKey: 'departments',
  },
]

function StatsCardsLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ key }) => (
        <Card key={key}>
          <CardContent className="flex flex-col gap-3 p-6">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-9 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function StatsCards({ loading, stats }) {
  if (loading || !stats) {
    return <StatsCardsLoading />
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ key, label, Icon, accent, valueKey }) => (
        <Card key={key} className="rounded-3xl border-[#d2e3ea] bg-white/95 shadow-sm">
          <CardContent className="flex flex-row items-center justify-between gap-3 p-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7088a1]">{label}</p>
              <p className="text-3xl font-semibold tracking-tight text-[#1b3452]">
                {stats[valueKey]}
              </p>
            </div>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accent}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
