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
  PanelLeftClose,
  PanelLeftOpen,
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

const SIDEBAR_BG      = 'bg-[hsl(191,72%,14%)]'
const SIDEBAR_SUB_BG  = 'bg-[hsl(191,60%,10%)]'
const BORDER          = 'border-white/10'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
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
      'w-full flex items-center transition-all duration-150',
      collapsed ? 'justify-center py-2.5' : 'gap-3 px-4 py-2.5',
      isActive
        ? 'bg-white/15 text-white'
        : 'text-white/55 hover:bg-white/8 hover:text-white/90'
    )
  }

  // Settings sub-menu items
  function subNavClass(isActive: boolean) {
    return cn(
      'w-full flex items-center transition-all duration-150',
      collapsed ? 'justify-center py-2' : 'gap-3 px-4 py-2 text-[13px] font-medium',
      isActive
        ? 'bg-white/10 text-white/95'
        : 'text-white/50 hover:bg-white/6 hover:text-white/85'
    )
  }

  const asideClass = cn(
    'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 z-40 lg:transition-all lg:duration-300',
    collapsed ? 'lg:w-16' : 'lg:w-60',
    onSettingsPage ? SIDEBAR_SUB_BG : SIDEBAR_BG,
    'border-r', BORDER
  )

  const headerClass = cn(
    'flex h-16 items-center border-b shrink-0',
    BORDER,
    collapsed ? 'justify-center px-0 gap-0' : 'gap-2.5 px-4'
  )

  const footerInnerClass = cn(
    'flex items-center min-w-0',
    collapsed ? 'justify-center' : 'gap-2.5 px-1'
  )

  return (
    <aside className={asideClass}>

      {/* Station header */}
      <div className={headerClass}>
        {!collapsed && (
          <>
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
          </>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="h-7 w-7 rounded-md flex items-center justify-center text-white/40 hover:bg-white/12 hover:text-white/80 transition-colors duration-150 shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <PanelLeftOpen className="h-3.5 w-3.5" />
            : <PanelLeftClose className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5">
        {onSettingsPage ? (
          <div
            key="settings-nav"
            className="animate-in fade-in-0 zoom-in-95 duration-200 origin-top-right"
          >
            {!collapsed && (
              <div className={cn('flex items-center gap-2 px-4 py-2 mb-1 border-b', BORDER)}>
                <Settings className="h-3 w-3 text-white/40 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Settings</span>
              </div>
            )}
            {!collapsed && (
              <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                Store
              </p>
            )}
            {STORE_MENU.map(({ id, label, icon: Icon, freeLocked }) => {
              const locked = isFree && freeLocked
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(`/settings?section=${id}`)}
                  className={subNavClass(activeSection === id)}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && label}
                  {!collapsed && locked && (
                    <span className="ml-auto flex items-center gap-0.5 text-[9px] font-bold rounded px-1 py-0.5 bg-amber-500/25 text-amber-300">
                      <Lock className="h-2.5 w-2.5" />PRO
                    </span>
                  )}
                </button>
              )
            })}

            {!collapsed && (
              <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                Account
              </p>
            )}
            {USER_MENU.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => navigate(`/settings?section=${id}`)}
                className={subNavClass(activeSection === id)}
                title={collapsed ? label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && label}
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
                  title={collapsed ? label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && label}
                  {!collapsed && locked && (
                    <span className="ml-auto flex items-center gap-0.5 text-[9px] font-bold rounded px-1 py-0.5 bg-amber-500/25 text-amber-300">
                      <Lock className="h-2.5 w-2.5" />PRO
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          navItems.map(({ to, label, icon: Icon }) => {
            const isLocked = isFree && FREE_LOCKED_ROUTES.has(to)
            return (
              <button
                key={to}
                type="button"
                onClick={() => navigate(to)}
                className={mainNavClass(location.pathname.startsWith(to))}
                title={collapsed ? label : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && label}
                {!collapsed && isLocked && (
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
      <div className={cn('p-3 border-t shrink-0', BORDER)}>
        <div className={footerInnerClass}>
          {userName && (
            <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white leading-none">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white/85 truncate leading-tight">{userName}</p>
                <p className="text-[10px] text-white/45 capitalize leading-tight">{role ?? 'staff'}</p>
              </div>
              <button
                type="button"
                title="Sign Out"
                onClick={() => void supabase.auth.signOut()}
                className="h-7 w-7 flex items-center justify-center rounded-md text-white/40 hover:text-white/90 hover:bg-white/8 transition-all duration-150 shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
