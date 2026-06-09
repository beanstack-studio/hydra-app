import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/stores/authStore'

interface PageHeaderProps {
  title: string
  children?: ReactNode
}

export function PageHeader({ title, children }: PageHeaderProps) {
  const role           = useAuthStore((s) => s.role)
  const station        = useAuthStore((s) => s.station)
  const isOwner        = role === 'owner' || role === 'super_admin'
  const stationPhotoUrl = (station as { photo_url?: string | null } | null)?.photo_url ?? null
  const stationName    = station?.name ?? ''

  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <div className="flex items-center gap-3">
        {children && <div className="flex items-center gap-2">{children}</div>}
        {isOwner && (
          <Link
            to="/settings"
            className="lg:hidden h-10 w-10 rounded-full overflow-hidden border border-border shadow-sm shrink-0"
            title="Settings"
          >
            {stationPhotoUrl ? (
              <img key={stationPhotoUrl} src={stationPhotoUrl} alt={stationName} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-primary/15 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            )}
          </Link>
        )}
      </div>
    </div>
  )
}
