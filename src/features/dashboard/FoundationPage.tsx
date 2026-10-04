import { Link, useOutletContext } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  CheckCheck,
  Database,
  FileText,
  Leaf,
  LockKeyhole,
  MonitorSmartphone,
  Sun,
} from 'lucide-react'
import { usePreferences } from '../../app/store/preferences'
import { backendConfigured } from '../../services/supabase/client'

export default function FoundationPage() {
  const { preview } = useOutletContext<{ preview: boolean }>()
  const timezone = usePreferences((s) => s.timezone)
  const date = new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  }).format(new Date())
  const base = preview ? '/setup' : ''
  return (
    <div className="page dashboard-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow date-line">
            <Sun size={16} />
            {date}
          </div>
          <h1>
            Hoy, con un poco más de calma<span className="accent">.</span>
          </h1>
          <p className="muted">
            Un espacio para tus ideas y para lo que viene después.
          </p>
        </div>
        <span className="version-badge">
          FASE 09 <span>/ 09</span>
        </span>
      </div>
      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="eyebrow">TU ESPACIO EMPIEZA AQUÍ</span>
          <h2>
            Menos cosas en la cabeza.
            <br />
            Más claridad en tu día.
          </h2>
          <p>
            Tus notas, tareas y calendario comparten un mismo espacio.
            <br /> Organiza tus tareas y guarda tus ideas en notas con formato,
            listas y autoguardado.
          </p>
          <Link
            to={
              backendConfigured
                ? preview
                  ? '/auth/register'
                  : '/tasks'
                : '/setup/settings'
            }
            className="button primary"
          >
            {backendConfigured && preview
              ? 'Empezar con mi cuenta'
              : preview
                ? 'Preparar mi espacio'
                : 'Abrir mis tareas'}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="welcome-illustration" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="illustration-note">
            <div className="mini-heading">
              <span className="mini-sun">
                <Sun size={17} />
              </span>
              Un nuevo día
            </div>
            <div className="mini-line">
              <span className="mini-check">
                <Check size={12} />
              </span>
              <span className="fake-line long" />
            </div>
            <div className="mini-line">
              <span className="mini-check">
                <Check size={12} />
              </span>
              <span className="fake-line" />
            </div>
            <div className="mini-line">
              <span className="mini-circle" />
              <span className="fake-line long" />
            </div>
            <div className="note-bottom">
              <span />
              paso a paso
            </div>
          </div>
          <div className="leaf-stamp">
            <Leaf size={28} strokeWidth={1.4} />
          </div>
        </div>
      </section>
      <section className="foundation-section">
        <div className="section-heading">
          <h2>Una base para lo que importa</h2>
          <span className="subtle-label">PRIMERA ETAPA</span>
        </div>
        <div className="foundation-grid">
          {[
            {
              icon: Database,
              title: 'Tus datos, cerca de ti',
              text: 'Persistencia local con IndexedDB y repositorios preparados para trabajar sin conexión.',
            },
            {
              icon: LockKeyhole,
              title: 'Un espacio personal',
              text: 'Acceso con email y contraseña. Aislamiento por usuario y políticas de seguridad en la base de datos.',
            },
            {
              icon: MonitorSmartphone,
              title: 'A tu ritmo, en cada pantalla',
              text: 'Navegación adaptable, accesible y con tema claro, oscuro o según tu dispositivo.',
            },
          ].map(({ icon: Icon, title, text }) => (
            <article className="foundation-item" key={title}>
              <div className="feature-icon">
                <Icon size={20} strokeWidth={1.6} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="dashboard-bottom">
        <section className="next-section">
          <div className="section-heading">
            <h2>Tu espacio, paso a paso</h2>
            <span className="subtle-label">EN DESARROLLO</span>
          </div>
          <Link className="next-row" to={`${base}/tasks`}>
            <div className="module-icon violet">
              <CheckCheck size={21} />
            </div>
            <div>
              <strong>Tareas, sin complicaciones</strong>
              <p>Prioridades, fechas y pequeños pasos.</p>
            </div>
            <span className="phase-pill">Disponible</span>
            <ArrowRight size={17} />
          </Link>
          <Link className="next-row" to={`${base}/notes`}>
            <div className="module-icon amber">
              <FileText size={21} />
            </div>
            <div>
              <strong>Un lugar para tus ideas</strong>
              <p>Notas conectadas con lo que estás haciendo.</p>
            </div>
            <span className="phase-pill">Disponible</span>
            <ArrowRight size={17} />
          </Link>
        </section>
        <aside className="status-panel">
          <span className="eyebrow">ESTADO DEL ESPACIO</span>
          <div className="status-title">
            <span className="small-dot" />
            Tareas, notas, calendario y recordatorios disponibles
          </div>
          <p>
            {backendConfigured
              ? 'Supabase está configurado. Puedes crear una cuenta o iniciar sesión.'
              : 'Configura Supabase para activar el registro y el acceso a tu cuenta.'}
          </p>
          <Link to={`${base}/settings`}>
            Ver configuración
            <ArrowRight size={15} />
          </Link>
          <div className="status-footnote">
            El estado de sincronización y las copias de conflictos están en
            Configuración.
          </div>
        </aside>
      </div>
    </div>
  )
}
