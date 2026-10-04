import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import SearchPanel from './SearchPanel'
export default function SearchPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  return user ? (
    <div className="page search-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TODO A MANO</span>
          <h1>
            Buscar<span className="accent">.</span>
          </h1>
          <p className="muted">
            Encuentra lo que guardaste, también sin conexión.
          </p>
        </div>
      </div>
      <SearchPanel
        key={`${user.id}:${params.get('tag') ?? ''}`}
        userId={user.id}
        initialTag={params.get('tag') ?? ''}
      />
    </div>
  ) : (
    <Navigate to="/auth/login" replace />
  )
}
