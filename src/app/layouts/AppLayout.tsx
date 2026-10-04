import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  CheckCheck,
  CircleHelp,
  FileText,
  Inbox,
  Menu,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  Sun,
  Tag,
  WifiOff,
} from 'lucide-react'
import { Brand } from '../../shared/components/Brand'
import { Modal } from '../../shared/components/Modal'
import { QuickCreateMenu } from '../../shared/components/QuickCreateMenu'
import { usePreferences } from '../store/preferences'
import { useOnline } from '../../shared/hooks/use-online'
import { useAuth } from '../../features/auth/auth-context'
import { SyncIndicator } from '../../features/sync/SyncIndicator'
import { WorkspaceMenu } from './WorkspaceMenu'

const SearchPanel = lazy(() => import('../../features/search/SearchPanel'))

const navigation = [
  { path: '', label: 'Hoy', icon: Sun },
  { path: 'inbox', label: 'Inbox', icon: Inbox },
  { path: 'calendar', label: 'Calendario', icon: CalendarDays },
  { path: 'tasks', label: 'Tareas', icon: CheckCheck },
  { path: 'notes', label: 'Notas', icon: FileText },
  { path: 'reminders', label: 'Recordatorios', icon: Bell },
]
export default function AppLayout({ preview = false }: { preview?: boolean }) {
  const { user } = useAuth()
  const online = useOnline()
  const collapsed = usePreferences((s) => s.collapsed)
  const toggleSidebar = usePreferences((s) => s.toggleSidebar)
  const [modal, setModal] = useState<'create' | 'search' | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const location = useLocation()
  const base = preview ? '/setup' : ''
  const url = (path: string) => (path ? `${base}/${path}` : base || '/')
  const title =
    navigation.find(
      (item) =>
        location.pathname === url(item.path) ||
        (!item.path && location.pathname === base),
    )?.label ??
    (location.pathname.endsWith('settings')
      ? 'Configuración'
      : location.pathname.endsWith('search')
        ? 'Buscar'
        : location.pathname.endsWith('profile')
          ? 'Perfil'
          : 'Etiquetas')
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenu(false)
      if (document.querySelector('dialog[open]')) return
      const editing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
      if (editing) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setModal('search')
      }
      // Preserve the browser's Ctrl/Cmd+N shortcut.
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'n'
      )
        setModal('create')
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
  return (
    <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      {mobileMenu && (
        <button
          className="menu-scrim"
          aria-label="Cerrar navegación"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside
        id="sidebar"
        className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}
      >
        <Link to={url('')} className="brand-link" aria-label="Dayflow, inicio">
          <Brand compact={collapsed && !mobileMenu} />
        </Link>
        <WorkspaceMenu
          key={`${location.key}-${mobileMenu}-${collapsed}`}
          initial={user?.email?.charAt(0).toUpperCase() ?? 'D'}
          base={base}
          onNavigate={() => setMobileMenu(false)}
        />
        <div className="sidebar-body">
          <button
            className="search-trigger"
            onClick={() => setModal('search')}
            aria-label="Buscar en Dayflow"
          >
            <Search size={17} />
            <span className="sidebar-text">Buscar</span>
            <kbd className="sidebar-text">⌘ K</kbd>
          </button>
          <nav aria-label="Navegación principal">
            {navigation.map(({ path, label, icon: Icon }, index) => (
              <NavLink
                key={path}
                to={url(path)}
                end
                title={collapsed ? label : undefined}
                className={index === 2 ? 'nav-section-start' : undefined}
                onClick={() => setMobileMenu(false)}
              >
                <Icon size={19} />
                <span className="sidebar-text">{label}</span>
                {!path && <span className="today-indicator sidebar-text" />}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-divider" />
          <NavLink
            to={url('tags')}
            aria-label="Etiquetas"
            className="tag-link"
            onClick={() => setMobileMenu(false)}
          >
            <Tag size={18} />
            <span className="sidebar-text">Etiquetas</span>
          </NavLink>
          <div className="sidebar-bottom">
            <div className="workspace-note sidebar-text">
              <span className="small-dot" /> Un poco de orden.
              <br />
              <span>Más espacio para ti.</span>
            </div>
            <NavLink
              to={url('settings')}
              aria-label="Configuración"
              onClick={() => setMobileMenu(false)}
            >
              <Settings2 size={19} />
              <span className="sidebar-text">Configuración</span>
            </NavLink>
            <button
              className="collapse-button"
              onClick={toggleSidebar}
              aria-label={
                collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'
              }
            >
              <PanelLeftClose size={18} />
              <span className="sidebar-text">Contraer menú</span>
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu-button"
              aria-label="Abrir navegación"
              aria-controls="sidebar"
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={20} />
            </button>
            <span>Mi espacio</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            {!preview && user ? (
              <SyncIndicator userId={user.id} />
            ) : (
              <span className="connection" role="status">
                {online ? (
                  <span className="small-dot" />
                ) : (
                  <WifiOff size={14} />
                )}
                {!online
                  ? 'Sin conexión'
                  : preview
                    ? 'Vista de preparación'
                    : 'Sincronización pendiente'}
              </span>
            )}
            <button
              className="avatar-button"
              aria-label="Ayuda sobre esta versión"
              onClick={() => setModal('create')}
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <Outlet context={{ preview }} />
        </main>
        <footer className="workspace-footer">
          <span>Un día a la vez.</span>
          <span>DAYFLOW · SYNC</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        <NavLink end to={url('')}>
          <Sun size={20} />
          Hoy
        </NavLink>
        <NavLink to={url('tasks')}>
          <CheckCheck size={20} />
          Tareas
        </NavLink>
        <button
          className="mobile-create"
          aria-label="Creación rápida"
          onClick={() => setModal('create')}
        >
          <Plus size={25} />
        </button>
        <NavLink to={url('calendar')}>
          <CalendarDays size={20} />
          Calendario
        </NavLink>
        <button
          aria-controls="sidebar"
          aria-expanded={mobileMenu}
          onClick={() => setMobileMenu(!mobileMenu)}
        >
          <Menu size={20} />
          Más
        </button>
      </nav>
      {modal && (
        <Modal
          title={modal === 'search' ? 'Todo a mano' : '¿Qué quieres organizar?'}
          onClose={() => setModal(null)}
          className={modal === 'search' ? 'search-dialog' : undefined}
        >
          {modal === 'search' ? (
            !preview && user ? (
              <Suspense fallback={<p role="status">Abriendo búsqueda…</p>}>
                <SearchPanel
                  key={user.id}
                  userId={user.id}
                  onOpen={() => {
                    setModal(null)
                    setMobileMenu(false)
                  }}
                />
              </Suspense>
            ) : (
              <p className="muted small">
                Inicia sesión para buscar en tu espacio personal.{' '}
                <Link to="/auth/login" onClick={() => setModal(null)}>
                  Ir al acceso
                </Link>
              </p>
            )
          ) : (
            <QuickCreateMenu preview={preview} onClose={() => setModal(null)} />
          )}
        </Modal>
      )}
    </div>
  )
}
