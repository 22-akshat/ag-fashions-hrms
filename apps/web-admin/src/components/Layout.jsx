import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { format } from 'date-fns'
import { Bell, CalendarCheck2, LayoutDashboard, LogOut, MapPin, Menu, Search, ShieldAlert, Store, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { isSupabaseConfigured } from '@/module1/employees/lib/supabase/client'
import { useAuth } from '@/core/auth/useAuth'

const nav = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/employees', label: 'Employees', Icon: Users },
  { to: '/attendance', label: 'Attendance', Icon: CalendarCheck2 },
  { to: '/shops', label: 'Shops', Icon: Store },
  { to: '/live-monitoring', label: 'Live', Icon: MapPin },
  { to: '/alerts', label: 'Alerts', Icon: ShieldAlert },
]

export function Layout() {
  const { authUser, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const today = format(new Date(), 'EEEE, MMMM d, yyyy')
  const displayName = authUser?.full_name?.trim() || authUser?.username?.trim() || 'HR Admin'
  const displayRole = authUser?.role?.trim() || 'Company admin'

  async function handleSignOut() {
    try {
      await signOut()
    } catch (err) {
      toast({
        title: 'Sign out failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    }
    setSidebarOpen(false)
  }

  return (
    <div className="flex min-h-dvh bg-gradient-to-br from-[#c8e4e8] via-[#d8e8ee] to-[#f1e4de] p-2 md:p-3">
      <div
        className={cn(
          'fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[1px] transition-opacity md:hidden',
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col rounded-3xl bg-[#ecf4f7]/95 text-[#21324f] shadow-xl transition-transform duration-200 ease-out md:sticky md:top-3 md:h-[calc(100dvh-24px)] md:translate-x-0 md:shadow-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="border-b border-[#cce0e7] px-4 py-4">
          <div className="flex items-center gap-2 rounded-2xl bg-white p-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#f58f34] text-xs font-bold text-white">
              HR
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight text-[#112844]">AG Fashions</p>
              <p className="text-[10px] uppercase tracking-wide text-[#658399]">Management Suite</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {nav.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-[#f58f34] text-white' : 'text-[#27445d] hover:bg-white hover:text-[#0f2748]',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[#cce0e7] p-3">
          <div className="mb-2 rounded-xl bg-white px-3 py-2">
            <p className="text-xs font-semibold text-[#143356]">{displayName}</p>
            <p className="text-[10px] uppercase tracking-wide text-[#6a879f]">{displayRole}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full border-[#c4dae2] bg-transparent text-[#213f61] hover:bg-white hover:text-[#0f2748]"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[30px] border border-[#c9dce4] bg-[#f9fcfd]/95">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#d3e3ea] bg-[#f9fcfd]/95 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-sm font-semibold text-[#193250]">Management System</p>
              <p className="text-xs text-[#67819a]">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#cbdde5] bg-white text-[#5f7991]"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#cbdde5] bg-white text-[#5f7991]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
            <Badge
              variant={isSupabaseConfigured() ? 'success' : 'secondary'}
              className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-wide sm:inline-flex"
            >
              {isSupabaseConfigured() ? 'Supabase live' : 'Demo mode'}
            </Badge>
          </div>
        </header>

        <main className="flex-1 bg-gradient-to-b from-[#f4fbfd] to-[#ecf5f8] px-4 py-5 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
