import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { AlertTriangle, Building2 } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ReminderModal } from '@/components/shared/ReminderModal'
import { startReminderPolling, stopReminderPolling } from '@/lib/reminders'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { Reminder } from '@/lib/reminders'

const SUPER_ADMIN_EMAIL = 'hello@beanstack.studio'

function DevBanner() {
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const isDevMode = userId.startsWith('dev-')
  if (!isDevMode) return null
  return (
    <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 shrink-0">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        <strong>Demo mode</strong> — changes won't save. Sign in with your Supabase account to use the real app.
      </span>
    </div>
  )
}

function RoleViewToggle() {
  const role        = useAuthStore((s) => s.role)
  const email       = useAuthStore((s) => s.user?.email ?? '')
  const setViewRole = useAuthStore((s) => s.setViewRole)
  if (!role || email !== SUPER_ADMIN_EMAIL) return null
  const isOwner = role === 'owner'
  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs shrink-0">
      <span className="text-amber-700 font-medium shrink-0">View as:</span>
      <div className="flex rounded-md border border-amber-300 overflow-hidden text-xs font-medium">
        <button
          type="button"
          onClick={() => setViewRole('owner')}
          className={cn(
            'px-2.5 py-1 transition-colors duration-150',
            isOwner
              ? 'bg-amber-500 text-white'
              : 'text-amber-700 hover:bg-amber-100'
          )}
        >
          Owner
        </button>
        <button
          type="button"
          onClick={() => setViewRole('staff')}
          className={cn(
            'px-2.5 py-1 transition-colors duration-150',
            !isOwner
              ? 'bg-amber-500 text-white'
              : 'text-amber-700 hover:bg-amber-100'
          )}
        >
          Staff
        </button>
      </div>
      <span className="text-amber-600 italic">testing only — resets on refresh</span>
    </div>
  )
}

export function AppShell() {
  const [pendingReminders, setPendingReminders] = useState<Reminder[]>([])
  const role           = useAuthStore((s) => s.role)
  const station        = useAuthStore((s) => s.station)
  const location       = useLocation()
  const isOwner        = role === 'owner' || role === 'super_admin'
  const onSettingsPage = location.pathname.startsWith('/settings')
  const stationPhotoUrl = (station as { photo_url?: string | null } | null)?.photo_url ?? null
  const stationName    = station?.name ?? ''

  useEffect(() => {
    startReminderPolling((reminders) => {
      setPendingReminders((prev) => {
        const existingIds = new Set(prev.map((r) => r.id))
        const newOnes = reminders.filter((r) => !existingIds.has(r.id))
        return newOnes.length > 0 ? [...prev, ...newOnes] : prev
      })
    })
    return () => stopReminderPolling()
  }, [])

  const handleDismiss = (id: string) => {
    setPendingReminders((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col lg:ml-60 min-w-0">
        <DevBanner />
        <RoleViewToggle />

        {/* Mobile station header — owner only, hidden on settings page */}
        {isOwner && !onSettingsPage && (
          <div className="lg:hidden flex items-center justify-end px-4 h-12 border-b border-border shrink-0">
            <Link
              to="/settings"
              className="flex items-center gap-2 rounded-full pl-2.5 pr-1 py-1 border border-border hover:bg-accent transition-colors duration-150"
              title="Settings"
            >
              <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                {stationName || 'My Station'}
              </span>
              <div className="h-7 w-7 rounded-full overflow-hidden shrink-0 border border-border">
                {stationPhotoUrl ? (
                  <img src={stationPhotoUrl} alt={stationName} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-primary/15 flex items-center justify-center">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
              </div>
            </Link>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      <BottomNav />
      <ReminderModal reminders={pendingReminders} onDismiss={handleDismiss} />
    </div>
  )
}
