import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Laptop, Moon, Sun } from 'lucide-react'
import { usePreferences } from '../../app/store/preferences'
import { useAuth } from '../auth/auth-context'
import { authService } from '../../services/supabase/auth-service'
import { backendConfigured } from '../../services/supabase/client'
import { NotificationSettings } from '../reminders/components/NotificationSettings'
import { SyncSettings } from '../sync/SyncSettings'
import { InstallationSettings } from './InstallationSettings'
import '../reminders/reminders.css'

export default function SettingsPage() {
  const preferences = usePreferences()
  const { user } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const timezones = Intl.supportedValuesOf('timeZone')
  const logout = async () => {
    setBusy(true)
    setError('')
    try {
      await authService.signOut()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo cerrar sesión.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A TU MANERA</span>
          <h1>Configuración</h1>
          <p className="muted">Un espacio que se adapta a ti.</p>
        </div>
      </div>
      <section className="settings-section">
        <h2>Cuenta</h2>
        {user ? (
          <>
            <p>
              <strong>
                {typeof user.user_metadata.name === 'string'
                  ? user.user_metadata.name
                  : 'Mi cuenta'}
              </strong>
            </p>
            <p className="muted">{user.email}</p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void logout()}
            >
              {busy ? 'Cerrando…' : 'Cerrar sesión'}
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              {backendConfigured
                ? 'Inicia sesión para acceder a tus datos personales.'
                : 'El acceso necesita una conexión con tu proyecto de Supabase.'}
            </p>
            <Link to="/auth/login" className="button secondary">
              Ir a inicio de sesión
            </Link>
          </>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </section>
      <InstallationSettings />
      <section className="settings-section">
        <h2>Apariencia</h2>
        <p className="muted">Elige cómo quieres ver Dayflow.</p>
        <div className="theme-options">
          {[
            { value: 'light', label: 'Claro', icon: Sun },
            { value: 'dark', label: 'Oscuro', icon: Moon },
            { value: 'system', label: 'Sistema', icon: Laptop },
          ].map(({ value, label, icon: Icon }) => (
            <button
              className={preferences.theme === value ? 'selected' : ''}
              aria-pressed={preferences.theme === value}
              key={value}
              onClick={() =>
                preferences.setTheme(value as 'light' | 'dark' | 'system')
              }
            >
              <Icon size={22} />
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <h2>Preferencias</h2>
        <div className="preferences-grid">
          <label>
            Primer día de la semana
            <select
              value={preferences.weekStartsOn}
              onChange={(e) =>
                preferences.setWeekStartsOn(
                  e.target.value as 'monday' | 'sunday',
                )
              }
            >
              <option value="monday">Lunes</option>
              <option value="sunday">Domingo</option>
            </select>
          </label>
          <label>
            Formato horario
            <select
              value={preferences.hourFormat}
              onChange={(e) =>
                preferences.setHourFormat(e.target.value as '24' | '12')
              }
            >
              <option value="24">24 horas</option>
              <option value="12">12 horas</option>
            </select>
          </label>
          <label>
            Zona horaria
            <select
              aria-label="Zona horaria"
              value={preferences.timezone}
              onChange={(e) => preferences.setTimezone(e.target.value)}
            >
              {[...new Set([preferences.timezone, 'UTC', ...timezones])].map(
                (zone) => (
                  <option key={zone}>{zone}</option>
                ),
              )}
            </select>
          </label>
        </div>
        <p className="muted small">
          Estas preferencias se guardan en este dispositivo.
        </p>
      </section>
      <section className="settings-section">
        <h2>Conexión con Supabase</h2>
        <span className="phase-pill">
          {backendConfigured
            ? 'Variables configuradas'
            : 'Pendiente de configurar'}
        </span>
        <p className="muted">
          {backendConfigured
            ? 'El registro, el acceso y el motor de sincronización están disponibles. Aplica las migraciones pendientes en Supabase para activar el protocolo remoto.'
            : 'Copia .env.example a .env.local, completa la URL y la clave pública de tu proyecto, aplica la migración SQL y reinicia el servidor.'}
        </p>
      </section>
      {user && <SyncSettings userId={user.id} />}
      {user ? (
        <NotificationSettings userId={user.id} />
      ) : (
        <section className="settings-section">
          <h2>Notificaciones</h2>
          <p className="muted">
            Inicia sesión para gestionar los permisos y tus recordatorios. La
            versión web guarda recordatorios sin enviar alarmas programadas.
          </p>
        </section>
      )}
    </div>
  )
}
