import { Link } from 'react-router-dom'
import { HardDrive, CloudOff, RefreshCw, CircleAlert } from 'lucide-react'
import { useSyncStatus } from './use-sync-status'
import './sync.css'
export function SyncIndicator({ userId }: { userId: string }) {
  const { label, localLabel, pendingLabel, online, checkpoint, error } =
    useSyncStatus(userId)
  return (
    <Link
      to="/settings"
      className="connection sync-indicator"
      title={`${pendingLabel}. Ver guardado local y última confirmación remota`}
    >
      <span role="status">
        {error || checkpoint?.state === 'error' ? (
          <CircleAlert size={14} aria-hidden="true" />
        ) : !online || checkpoint?.state === 'offline' ? (
          <CloudOff size={14} aria-hidden="true" />
        ) : checkpoint?.state === 'syncing' ? (
          <RefreshCw size={14} aria-hidden="true" />
        ) : (
          <HardDrive size={14} aria-hidden="true" />
        )}
        {localLabel} · {label}
      </span>
    </Link>
  )
}
