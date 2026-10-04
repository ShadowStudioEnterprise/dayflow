import { Link } from 'react-router-dom'
import { CloudCheck, CloudOff, RefreshCw } from 'lucide-react'
import { useSyncStatus } from './use-sync-status'
import './sync.css'
export function SyncIndicator({ userId }: { userId: string }) {
  const { label, online, checkpoint } = useSyncStatus(userId)
  return (
    <Link
      to="/settings"
      className="connection sync-indicator"
      title="Ver sincronización y cambios pendientes"
    >
      <span role="status">
        {!online ? (
          <CloudOff size={14} />
        ) : checkpoint?.state === 'syncing' ? (
          <RefreshCw size={14} />
        ) : (
          <CloudCheck size={14} />
        )}
        {label}
      </span>
    </Link>
  )
}
