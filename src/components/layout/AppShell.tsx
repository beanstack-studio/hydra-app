import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ReminderModal } from '@/components/shared/ReminderModal'
import { BackwashAlertModal } from '@/components/shared/BackwashAlertModal'
import { FilterReplacementAlertModal } from '@/components/shared/FilterReplacementAlertModal'
import { startReminderPolling, stopReminderPolling } from '@/lib/reminders'
import { useBackwashTracker } from '@/features/maintenance/hooks/useBackwashTracker'
import { useFilterReplacement } from '@/features/maintenance/hooks/useFilterReplacement'
import { useBackwashStore } from '@/stores/backwashStore'
import { useFilterReplacementStore } from '@/stores/filterReplacementStore'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/hooks/usePlan'
import { cn } from '@/lib/utils'
import type { Reminder } from '@/lib/reminders'

const SUPER_ADMIN_EMAIL = 'hello@beanstack.studio'

// ── Data loaders — call hooks for their side effect (populate global stores) ──
function BackwashDataLoader() {
  useBackwashTracker()
  return null
}

function FilterReplacementDataLoader() {
  useFilterReplacement()
  return null
}

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
  const viewPlan    = useAuthStore((s) => s.viewPlan)
  const setViewRole = useAuthStore((s) => s.setViewRole)
  const setViewPlan = useAuthStore((s) => s.setViewPlan)
  if (!role || email !== SUPER_ADMIN_EMAIL) return null

  type ActiveView = 'owner' | 'staff' | 'free'
  const activeView: ActiveView =
    viewPlan === 'free' ? 'free' :
    role === 'owner' || role === 'super_admin' ? 'owner' : 'staff'

  const btnClass = (v: ActiveView) => cn(
    'px-2.5 py-1 transition-colors duration-150',
    activeView === v ? 'bg-amber-500 text-white' : 'text-amber-700 hover:bg-amber-100'
  )

  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs shrink-0">
      <span className="text-amber-700 font-medium shrink-0">View as:</span>
      <div className="flex rounded-md border border-amber-300 overflow-hidden text-xs font-medium">
        <button type="button" onClick={() => { setViewRole('owner'); setViewPlan(null) }} className={btnClass('owner')}>
          Owner
        </button>
        <button type="button" onClick={() => { setViewRole('staff'); setViewPlan(null) }} className={btnClass('staff')}>
          Staff
        </button>
        <button type="button" onClick={() => { setViewRole('owner'); setViewPlan('free') }} className={btnClass('free')}>
          Free
        </button>
      </div>
      <span className="text-amber-600 italic">testing only — resets on refresh</span>
    </div>
  )
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export function AppShell() {
  const [pendingReminders,        setPendingReminders]        = useState<Reminder[]>([])
  const [hasUpdate,               setHasUpdate]               = useState(false)
  const [backwashAlertDismissed,  setBackwashAlertDismissed]  = useState(false)
  const [filterAlertDismissed,    setFilterAlertDismissed]    = useState(false)
  const [sidebarCollapsed,        setSidebarCollapsed]        = useState<boolean>(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  )

  const plan   = usePlan()
  const isFree = plan === 'free'

  // Backwash alert — fires when configured, loaded, zone red, alert enabled, not dismissed
  const backwashLoaded        = useBackwashStore((s) => s.isLoaded)
  const backwashConfigured    = useBackwashStore((s) => s.isConfigured)
  const backwashZone          = useBackwashStore((s) => s.zone)
  const backwashAlertEnabled  = useBackwashStore((s) => s.alertEnabled)
  const backwashCombined      = useBackwashStore((s) => s.combinedCount)
  const backwashSlim          = useBackwashStore((s) => s.slimCount)
  const backwashRound         = useBackwashStore((s) => s.roundCount)
  const showBackwashAlert     = backwashLoaded && backwashConfigured && backwashZone === 'red' && backwashAlertEnabled && !backwashAlertDismissed

  // Filter replacement alert — same gates; shown after backwash alert is dismissed
  const filterLoaded          = useFilterReplacementStore((s) => s.isLoaded)
  const filterConfigured      = useFilterReplacementStore((s) => s.isConfigured)
  const filterZone            = useFilterReplacementStore((s) => s.zone)
  const filterAlertEnabled    = useFilterReplacementStore((s) => s.alertEnabled)
  const showFilterAlert       = !showBackwashAlert && filterLoaded && filterConfigured && filterZone === 'red' && filterAlertEnabled && !filterAlertDismissed

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  const contentClass = cn(
    'flex flex-1 flex-col min-w-0 transition-[margin-left] duration-300 ease-in-out',
    sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'
  )

  useEffect(() => {
    if (isFree) {
      stopReminderPolling()
      setPendingReminders([])
      return
    }
    startReminderPolling((reminders) => {
      setPendingReminders((prev) => {
        const existingIds = new Set(prev.map((r) => r.id))
        const newOnes = reminders.filter((r) => !existingIds.has(r.id))
        return newOnes.length > 0 ? [...prev, ...newOnes] : prev
      })
    })
    return () => stopReminderPolling()
  }, [isFree])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (!navigator.serviceWorker.controller) return
    const handleControllerChange = () => setHasUpdate(true)
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
  }, [])

  const handleDismissReminder = (id: string) => {
    setPendingReminders((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Loads maintenance data into global stores on app mount */}
      <BackwashDataLoader />
      <FilterReplacementDataLoader />

      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div className={contentClass}>
        <DevBanner />
        <RoleViewToggle />
        {hasUpdate && (
          <div className="flex items-center justify-between bg-primary/10 border-b border-primary/20 px-4 py-2 text-sm shrink-0">
            <span className="font-medium text-primary">New version available</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm font-semibold text-primary underline underline-offset-2"
            >
              Reload
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 pt-[0.75dvh] pb-nav lg:p-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      <BottomNav />
      <ReminderModal reminders={pendingReminders} onDismiss={handleDismissReminder} />
      {showBackwashAlert && (
        <BackwashAlertModal
          combinedCount={backwashCombined}
          slimCount={backwashSlim}
          roundCount={backwashRound}
          onDismiss={() => setBackwashAlertDismissed(true)}
        />
      )}
      {showFilterAlert && (
        <FilterReplacementAlertModal
          onDismiss={() => setFilterAlertDismissed(true)}
        />
      )}
    </div>
  )
}
