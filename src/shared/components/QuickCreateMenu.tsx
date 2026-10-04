import {
  Bell,
  CalendarDays,
  CheckCheck,
  FileText,
  ArrowRight,
  Inbox,
} from 'lucide-react'
import { Link } from 'react-router-dom'
export function QuickCreateMenu({
  preview,
  onClose,
}: {
  preview: boolean
  onClose: () => void
}) {
  return (
    <>
      <p className="muted small">
        {preview
          ? 'Inicia sesión para crear tareas, notas y eventos en tu espacio personal.'
          : 'Captura lo que tienes en mente. Puedes organizarlo ahora o dejarlo en Inbox.'}
      </p>
      <div className="phase-list">
        <Link
          className="quick-create-task"
          to={preview ? '/auth/login' : '/inbox'}
          onClick={onClose}
        >
          <Inbox size={19} />
          <span>Captura en Inbox</span>
          <ArrowRight size={16} />
        </Link>
        <Link
          className="quick-create-task"
          to={preview ? '/auth/login' : '/tasks?create=1'}
          onClick={onClose}
        >
          <CheckCheck size={19} />
          <span>Tarea</span>
          <ArrowRight size={16} />
        </Link>
        <Link
          className="quick-create-task"
          to={preview ? '/auth/login' : '/notes?create=1'}
          onClick={onClose}
        >
          <FileText size={19} />
          <span>Nota</span>
          <ArrowRight size={16} />
        </Link>
        <Link
          className="quick-create-task"
          to={preview ? '/auth/login' : '/calendar?create=1'}
          onClick={onClose}
        >
          <CalendarDays size={19} />
          <span>Evento</span>
          <ArrowRight size={16} />
        </Link>
        <Link
          className="quick-create-task"
          to={preview ? '/auth/login' : '/reminders?create=1'}
          onClick={onClose}
        >
          <Bell size={19} />
          <span>Recordatorio</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    </>
  )
}
