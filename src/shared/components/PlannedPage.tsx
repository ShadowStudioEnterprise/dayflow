import { Link, useLocation, useOutletContext } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCheck,
  FileText,
  Inbox,
  Tag,
} from 'lucide-react'
import { backendConfigured } from '../../services/supabase/client'
const modules = {
  tasks: {
    title: 'Tareas',
    phase: 2,
    icon: CheckCheck,
    description: 'Convierte tus planes en pequeños pasos.',
    detail: 'Listado, prioridades, fechas, subtareas y filtros.',
  },
  notes: {
    title: 'Notas',
    phase: 3,
    icon: FileText,
    description: 'Dale un lugar a cada idea.',
    detail: 'Editor TipTap, autoguardado, notas fijadas y archivo.',
  },
  calendar: {
    title: 'Calendario',
    phase: 4,
    icon: CalendarDays,
    description: 'Haz espacio para lo que viene.',
    detail: 'Vista mensual, agenda y eventos conectados con tus tareas.',
  },
  reminders: {
    title: 'Recordatorios',
    phase: 5,
    icon: Bell,
    description: 'Lo importante, en el momento adecuado.',
    detail:
      'Recordatorios asociados y notificaciones compatibles con cada plataforma.',
  },
  inbox: {
    title: 'Inbox',
    phase: 8,
    icon: Inbox,
    description: 'Captura ahora. Organiza después.',
    detail:
      'Captura rápida y conversión a tareas, notas, eventos y recordatorios.',
  },
  tags: {
    title: 'Etiquetas',
    phase: 8,
    icon: Tag,
    description: 'Un hilo común entre tus ideas.',
    detail: 'Etiquetas compartidas y filtros entre notas, tareas y eventos.',
  },
}
export default function PlannedPage() {
  const key = useLocation().pathname.split('/').at(-1) as keyof typeof modules
  const module = modules[key]
  const { preview } = useOutletContext<{ preview: boolean }>()
  if (!module) return <p>Página no encontrada.</p>
  const Icon = module.icon
  if (key === 'tasks' || key === 'notes' || key === 'calendar')
    return (
      <div className="page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">UN PASO CADA VEZ</span>
            <h1>{module.title}</h1>
            <p className="muted">{module.description}</p>
          </div>
          <span className="version-badge">DISPONIBLE</span>
        </div>
        <section className="planned-panel">
          <div className="planned-icon">
            <Icon size={34} />
          </div>
          <h2>
            {key === 'tasks'
              ? 'Tus tareas empiezan aquí.'
              : key === 'notes'
                ? 'Tus ideas empiezan aquí.'
                : 'Tus planes empiezan aquí.'}
          </h2>
          <p>
            {key === 'tasks'
              ? 'Crea, organiza y completa tareas. Añade subtareas, fechas y repeticiones, también sin conexión una vez iniciada tu sesión.'
              : key === 'notes'
                ? 'Escribe con formato, fija tus ideas y archiva lo que quieras conservar. Autoguardado en este dispositivo, también sin conexión una vez cargado el editor.'
                : 'Organiza eventos con hora o de día completo, repeticiones y tareas con fecha. Explora el mes o abre tu agenda, también sin conexión una vez cargado el calendario.'}
          </p>
          <p className="muted">
            {backendConfigured
              ? 'Inicia sesión para abrir tu lista personal.'
              : 'Configura Supabase siguiendo el README para activar tu cuenta. Esta vista pública no contiene datos personales.'}
          </p>
          <Link
            className="button primary"
            to={backendConfigured ? '/auth/login' : '/setup/settings'}
          >
            {backendConfigured ? 'Iniciar sesión' : 'Preparar mi cuenta'}
          </Link>
        </section>
      </div>
    )
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MI ESPACIO</span>
          <h1>{module.title}</h1>
          <p className="muted">{module.description}</p>
        </div>
        <span className="version-badge">DISPONIBLE</span>
      </div>
      <section className="planned-panel">
        <div className="planned-icon">
          <Icon size={34} strokeWidth={1.4} />
        </div>
        <span className="eyebrow">TU ESPACIO PERSONAL</span>
        <h2>Todo tiene su lugar.</h2>
        <p>{module.detail}</p>
        <p className="muted">
          {backendConfigured
            ? 'Inicia sesión para trabajar con tus datos.'
            : 'Configura Supabase siguiendo el README para activar tu cuenta. Esta vista pública no contiene datos personales.'}
        </p>
        <Link
          className="button primary"
          to={
            backendConfigured
              ? preview
                ? '/auth/login'
                : `/${key}`
              : '/setup/settings'
          }
        >
          {backendConfigured ? 'Iniciar sesión' : 'Preparar mi cuenta'}
          <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  )
}
