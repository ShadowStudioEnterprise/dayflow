import type { Task } from '../../shared/types/domain'
export const priorities: { value: Task['priority']; label: string }[] = [
  { value: 'none', label: 'Sin prioridad' },
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]
export const statuses: { value: Task['status']; label: string }[] = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
]
