import { useLocation, useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  Receipt,
  Users,
  Package,
  BarChart,
  Settings,
  LogOut,
  Building2,
  Wrench,
  CreditCard,
  User,
  X,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/hooks/usePlan'
import { supabase } from '@/lib/supabase'

const ALL_NAV_ITEMS = [
  { to: '/sales',     label: 'Sales',     icon: ShoppingCart },
  { to: '/expenses',  label: 'Expenses',  icon: Receipt },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/reports',   label: 'Reports',   icon: BarChart },
]

const STAFF_NAV_ITEMS = [
  { to: '/sales',     label: 'Sales',     icon: ShoppingCart },
  { to: '/expenses',  label: 'Expenses',  icon: Receipt },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/inventory', label: 'Inventory', icon: Package },
]

const STORE_MENU = [
  { id: 'business',    label: 'Business Info',      icon: Building2,  freeLocked: false },
  { id: 'products',    label: 'Products & Pricing',  icon: Package,    freeLocked: false },
  { id: 'maintenance', label: 'Maintenance Log',     icon: Wrench,     freeLocked: true  },
]

// Visible to all roles
const USER_MENU = [
  { id: 'account', label: 'My Account', icon: User, freeLocked: false },
]

// Owner-only
const ACCOUNT_MENU = [
  { id: 'team', label: 'Team Members',   icon: Users,       freeLocked: true  },
  { id: 'plan', label: 'Plan & Billing', icon: CreditCard,  freeLocked: false },
]

const FREE_LOCKED_ROUTES = new Set(['/customers', '/inventory', '/reports'])

const SIDEBAR_BG = 'bg-[hsl(191,72%,14%)]'
const BORDER     = 'border-white/10'

export function Sidebar() {
  const navigate        = useNavigate()
  const location        = useLocation()
  const station         = useAuthStore((s) => s.station)
  const user            = useAuthStore((s) => s.user)
  const role            = useAuthStore((s) => s.role)
  const plan            = usePlan()
  const userName        = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? ''
  const navItems        = (role === 'owner' || role === 'super_admin') ? ALL_NAV_ITEMS : STAFF_NAV_ITEMS
  const isOwner         = role === 'owner' || role === 'super_admin'
  const isFree          = plan === 'free'
  const stationPhotoUrl = station?.photo_url ?? null
  const stationName     = station?.name ?? 'My Station'
  const planLabel       = station?.plan === 'free' ? 'Free' : 'Pro'

  const onSettingsPage = location.pathname.startsWith('/settings')
  const activeSection  = onSettingsPage
    ? new URLSearchParams(location.search).get('section')
    : null

  // Full-width highlight for main nav items
  function mainNavClass(isActive: boolean) {
    return cn(
      'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-150',
      isActive
        ? 'bg-white/15 text-white'
        : 'text-white/55 hover:bg-white/8 hover:text-white/90'
    )
  }

  // Settings sub-menu items — slightly subtler than main nav
  function subNavClass(isActive: boolean) {
    return cn(
      'w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-all duration-150',
      isActive
        ? 'bg-white/10 text-white/95'
        : 'text-white/50 hover:bg-white/6 hover:text-white/85'
    )
  }

  return (
    <aside className={cn('hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 z-40', SIDEBAR_BG, 'border-r', BORDER)}>

      {/* Station header */}
      <div className={cn('flex h-16 items-center gap-2.5 px-4 border-b shrink-0', BORDER)}>
        {stationPhotoUrl ? (
          <img src={stationPhotoUrl} alt={stationName} className="h-8 w-8 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-white/70" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate leading-tight">{stationName}</p>
          <p className="text-[10px] text-white/45 mt-0.5">{planLabel} Plan</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(onSettingsPage ? '/sales' : '/settings?section=business')}
          className="h-7 w-7 rounded-md flex items-center justify-center text-white/40 hover:bg-white/12 hover:text-white/80 transition-colors duration-150 shrink-0"
          title={onSettingsPage ? 'Back to main menu' : 'Settings'}
        >
          {onSettingsPage
            ? <X className="h-3.5 w-3.5" />
            : <Settings className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5">
        {onSettingsPage ? (
          <>
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
              Store
            </p>
            {STORE_MENU.map(({ id, label, icon: Icon, freeLocked }) => {
              const locked = isFree && freeLocked
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(`/settings?section=${id}`)}
                  className={subNavClass(activeSection === id)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  {locked && (
                    <span className="ml-auto flex items-center gap-0.5 text-[9px] font-bold rounded px-1 py-0.5 bg-amber-500/25 text-amber-300">
                      <Lock className="h-2.5 w-2.5" />PRO
                    </span>
                  )}
                </button>
              )
            })}

            <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-white/35">
              Account
            </p>
            {USER_MENU.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => navigate(`/settings?section=${id}`)}
                className={subNavClass(activeSection === id)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
            {isOwner && ACCOUNT_MENU.map(({ id, label, icon: Icon, freeLocked }) => {
              const locked = isFree && freeLocked
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(`/settings?section=${id}`)}
                  className={subNavClass(activeSection === id)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  {locked && (
                    <span className="ml-auto flex items-center gap-0.5 text-[9px] font-bold rounded px-1 py-0.5 bg-amber-500/25 text-amber-300">
                      <Lock className="h-2.5 w-2.5" />PRO
                    </span>
                  )}
                </button>
              )
            })}
          </>
        ) : (
          navItems.map(({ to, label, icon: Icon }) => {
            const isLocked = isFree && FREE_LOCKED_ROUTES.has(to)
            return (
              <button
                key={to}
                type="button"
                onClick={() => navigate(to)}
                className={mainNavClass(location.pathname.startsWith(to))}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
                {isLocked && (
                  <span className="ml-auto flex items-center gap-0.5 text-[9px] font-bold rounded px-1 py-0.5 bg-amber-500/25 text-amber-300">
                    <Lock className="h-2.5 w-2.5" />PRO
                  </span>
                )}
              </button>
            )
          })
        )}
      </nav>

      {/* User + sign out */}
      <div className={cn('px-3 py-3 border-t shrink-0 space-y-1', BORDER)}>
        {userName && (
          <p className="px-1 text-xs text-white/35 truncate">{userName}</p>
        )}
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white/90 transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
