import { Layers2 } from 'lucide-react'
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Layers2 size={22} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span>
          dayflow<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  )
}
