import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, ShieldCheck, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import * as authApi from '@/core/auth/authApi'
import { useAuth } from '@/core/auth/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const rawFrom = location.state?.from?.pathname
  const from = rawFrom && rawFrom !== '/login' ? rawFrom : '/'

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [authLoading, isAuthenticated, from, navigate])

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)

    try {
      await authApi.signIn(username, password)

      toast({
        title: 'Welcome back',
        description: 'Signed in successfully.',
      })
      navigate(from, { replace: true })
    } catch (error) {
      toast({
        title: 'Unable to sign in',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#c8e4e8] via-[#d8e8ee] to-[#f0e1d8] text-sm font-medium text-[#325875]">
        Checking session…
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#c8e4e8] via-[#d8e8ee] to-[#f0e1d8] p-4 md:p-6">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-hidden rounded-[34px] border border-[#c7dbe2] bg-white/90 shadow-[0_28px_65px_rgba(25,58,82,0.18)] backdrop-blur md:grid-cols-[280px_1fr] md:min-h-[680px]">
        <aside className="flex flex-col justify-between border-b border-[#d9e9ee] bg-[#f3f9fc] p-6 md:border-b-0 md:border-r">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#f58f34]">AG Fashions</p>
            <div className="mt-8 text-center">
              <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#d9edf4] to-[#c7e0e9] text-[#234864] shadow-sm">
                <UserCircle2 className="h-10 w-10" />
              </div>
              <p className="mt-4 text-base font-semibold text-[#183550]">HR Admin</p>
              <p className="text-xs uppercase tracking-[0.16em] text-[#6d869d]">Secure Access</p>
            </div>
            <div className="mt-8 space-y-2 rounded-3xl bg-white p-3 shadow-sm">
              <Feature icon={ClipboardCheck} title="Attendance Ready" />
              <Feature icon={CheckCircle2} title="Employee Workflows" />
              <Feature icon={ShieldCheck} title="Role-based Security" />
            </div>
          </div>
          <p className="text-xs text-[#6d869d]">Use your Supabase username/password to continue.</p>
        </aside>

        <main className="flex flex-col justify-between bg-[#f8fcfe] p-6 md:p-10">
          <section>
            <h1 className="text-3xl font-black tracking-tight text-[#1a3553] md:text-4xl">Manage your HR system</h1>
            <p className="mt-2 max-w-xl text-sm text-[#627f97]">
              Sign in to access employee records, attendance tools, and management dashboards.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <StatCard value="15" label="Teams in HR flow" tint="bg-[#dff0f6]" />
              <StatCard value="97" label="Completed tasks" tint="bg-[#ffe8cf]" />
            </div>
          </section>

          <section className="mt-8 rounded-[28px] border border-[#d2e4eb] bg-white p-6 shadow-sm md:p-7">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-[0.13em] text-[#67839a]">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                  className="h-11 rounded-xl border-[#d5e6ed] bg-[#f9fdff]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.13em] text-[#67839a]">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="h-11 rounded-xl border-[#d5e6ed] bg-[#f9fdff]"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="mt-2 h-11 w-full rounded-xl bg-gradient-to-r from-[#2e7ca0] to-[#5faecf] text-sm font-semibold text-white hover:opacity-95"
              >
                {submitting ? 'Signing in...' : 'Sign In to HRMS'}
              </Button>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}

function Feature({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[#f5fbfe] px-3 py-2">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#e3f1f6] text-[#37789e]">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-xs font-semibold text-[#325875]">{title}</span>
    </div>
  )
}

function StatCard({ value, label, tint }) {
  return (
    <div className={`rounded-3xl ${tint} p-4 text-[#1f3f5d]`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6e8ba2]">{label}</p>
      <p className="mt-1 text-4xl font-black">{value}</p>
    </div>
  )
}
