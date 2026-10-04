import { Search, SlidersHorizontal } from 'lucide-react'
import type { TaskFilters } from '../services/task-filters'
import { priorities, statuses } from '../task-options'

const views: { value: TaskFilters['view']; label: string }[] = [
  { value: 'active', label: 'Pendientes' },
  { value: 'today', label: 'Hoy' },
  { value: 'overdue', label: 'Vencidas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'all', label: 'Todas' },
]
export function TaskToolbar({
  filters,
  onChange,
}: {
  filters: TaskFilters
  onChange: (next: TaskFilters) => void
}) {
  return (
    <div className="task-toolbar">
      <div className="task-tabs" role="group" aria-label="Vista de tareas">
        {views.map((view) => (
          <button
            key={view.value}
            aria-pressed={filters.view === view.value}
            onClick={() => onChange({ ...filters, view: view.value })}
          >
            {view.label}
          </button>
        ))}
      </div>
      <div className="task-filter-row">
        <label className="task-search">
          <Search size={16} />
          <input
            aria-label="Buscar tareas"
            placeholder="Buscar en tus tareas"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </label>
        <details className="task-filter-details">
          <summary>
            <SlidersHorizontal size={15} />
            Filtros y orden
          </summary>
          <div className="task-filter-options">
            <label>
              Prioridad
              <select
                value={filters.priority}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    priority: e.target.value as TaskFilters['priority'],
                  })
                }
              >
                <option value="all">Todas las prioridades</option>
                {priorities.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select
                value={filters.status}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    status: e.target.value as TaskFilters['status'],
                  })
                }
              >
                <option value="all">Todos los estados</option>
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ordenar por
              <select
                value={filters.sort}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    sort: e.target.value as TaskFilters['sort'],
                  })
                }
              >
                <option value="due">Fecha límite</option>
                <option value="priority">Prioridad</option>
                <option value="created">Más recientes</option>
              </select>
            </label>
          </div>
        </details>
      </div>
    </div>
  )
}
