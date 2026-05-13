import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/core/auth/useAuth'

export function ProtectedRoute() {
  const { loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f4fbfd] text-sm font-medium text-[#325875]">
        Checking session…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
