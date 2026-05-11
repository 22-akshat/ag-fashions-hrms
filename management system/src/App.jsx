import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/module0/dashboard/pages/Dashboard'
import { Employees } from '@/module1/employees/pages/Employees'
import { Attendance } from '@/module2/attendance/pages/Attendance'
import { ShopsPage } from '@/module3/shops/pages/ShopsPage'
import { LiveMonitoringPage } from '@/module4/monitoring/pages/LiveMonitoringPage'
import { RealtimeAlertsPage } from '@/module4/alerts/pages/RealtimeAlertsPage'
import { LoginPage } from '@/module0/auth/pages/LoginPage'

const AUTH_STORAGE_KEY = 'hrms-authenticated'
const AUTH_USER_STORAGE_KEY = 'hrms-auth-user'

function App() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem(AUTH_STORAGE_KEY) === 'true')
  const [authUser, setAuthUser] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  function handleLoginSuccess(user) {
    localStorage.setItem(AUTH_STORAGE_KEY, 'true')
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user ?? null))
    setAuthUser(user ?? null)
    setAuthenticated(true)
  }

  function handleSignOut() {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(AUTH_USER_STORAGE_KEY)
    setAuthUser(null)
    setAuthenticated(false)
  }

  if (!authenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <Routes>
      <Route element={<Layout onSignOut={handleSignOut} authUser={authUser} />}>
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="shops" element={<ShopsPage />} />
        <Route path="live-monitoring" element={<LiveMonitoringPage />} />
        <Route path="alerts" element={<RealtimeAlertsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
