import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/module0/dashboard/pages/Dashboard'
import { Employees } from '@/module1/employees/pages/Employees'
import { Attendance } from '@/module2/attendance/pages/Attendance'
import { ShopsPage } from '@/module3/shops/pages/ShopsPage'
import { LiveMonitoringPage } from '@/module4/monitoring/pages/LiveMonitoringPage'
import { RealtimeAlertsPage } from '@/module4/alerts/pages/RealtimeAlertsPage'
import { LoginPage } from '@/module0/auth/pages/LoginPage'
import { ProtectedRoute } from '@/core/auth/ProtectedRoute.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="shops" element={<ShopsPage />} />
          <Route path="live-monitoring" element={<LiveMonitoringPage />} />
          <Route path="alerts" element={<RealtimeAlertsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
