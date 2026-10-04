import { Suspense } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../features/auth/auth-context'
import { backendConfigured } from '../../services/supabase/client'

export function Loading() {
  return (
    <div className="loading-state" role="status">
      <div className="skeleton" />
      <div className="skeleton short" />
      <p>Preparando tu espacio…</p>
    </div>
  )
}
export function LazyBoundary() {
  return (
    <Suspense fallback={<Loading />}>
      <Outlet />
    </Suspense>
  )
}
export function RequireAuth() {
  const { user, loading, error, recovery } = useAuth()
  if (!backendConfigured) return <Navigate to="/setup" replace />
  if (loading) return <Loading />
  if (error)
    return (
      <main className="fatal">
        <h1>No se pudo restaurar tu sesión</h1>
        <p role="alert">{error}</p>
        <button
          className="button secondary"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </button>
      </main>
    )
  if (recovery) return <Navigate to="/auth/update-password" replace />
  return user ? <Outlet /> : <Navigate to="/auth/login" replace />
}
