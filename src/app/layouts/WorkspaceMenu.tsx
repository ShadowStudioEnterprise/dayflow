import { useEffect, useId, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, LogOut, Settings2, UserRound } from 'lucide-react'
import { useAuth } from '../../features/auth/auth-context'
import { authService } from '../../services/supabase/auth-service'
import './workspace-menu.css'

export function WorkspaceMenu({
  initial,
  base,
  onNavigate,
}: {
  initial: string
  base: string
  onNavigate: () => void
}) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const logout = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await authService.signOut()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo cerrar sesión.',
      )
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return (
    <div
      className="workspace-menu"
      ref={root}
      onBlur={(event) => {
        if (
          !pending.current &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false)
      }}
    >
      <button
        ref={trigger}
        className="workspace workspace-trigger"
        type="button"
        aria-label="Mi espacio"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="workspace-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="sidebar-text">
          Mi espacio<span className="muted">Personal</span>
        </span>
        <ChevronDown
          size={14}
          className="sidebar-text workspace-chevron"
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id={id}
          className="workspace-dropdown"
          role="group"
          aria-label="Opciones de Mi espacio"
        >
          <NavLink
            to={`${base}/profile`}
            aria-label="Perfil"
            onClick={onNavigate}
          >
            <UserRound size={18} aria-hidden="true" />
            <span>
              <strong>Perfil</strong>
              <small>Tu actividad y estadísticas</small>
            </span>
          </NavLink>
          <NavLink
            to={`${base}/settings`}
            aria-label="Ajustes de mi espacio"
            onClick={onNavigate}
          >
            <Settings2 size={18} aria-hidden="true" />
            <span>
              <strong>Configuración</strong>
              <small>Preferencias de Dayflow</small>
            </span>
          </NavLink>
          {user && (
            <div className="workspace-account-actions">
              <button
                type="button"
                className="workspace-logout"
                disabled={busy}
                onClick={() => void logout()}
              >
                <LogOut size={18} aria-hidden="true" />
                <span>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
              </button>
              {error && (
                <p className="field-error workspace-logout-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
