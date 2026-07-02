import { useState, useEffect } from 'react'
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
  Lock,
  ChevronDown,
  ChevronRight,
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

const USER_MENU = [
  { id: 'account', label: 'My Account', icon: User, freeLocked: false },
]

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

  // Auto-expand settings submenu when user is on a settings page
  const [settingsOpen, setSettingsOpen] = useState(() => onSettingsPage)
  useEffect(() => {
    if (onSettingsPage) setSettingsOpen(true)
  }, [onSettingsPage])

  // Full-width highlight for main nav items
  function mainNavClass(isActive: boolean) {
    return cn(
      'w-full flex items-center text-sm font-medium transition-all duration-150',
      collapsed ? 'justify-center py-2.5' : 'gap-3 px-4 py-2.5',
      isActive
        ? 'bg-white/15 text-white'
        : 'text-white/55 hover:bg-white/8 hover:text-white/90'
    )
  }

  // Settings submenu items
  function subNavClass(isActive: boolean) {
    return cn(
      'w-full flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded transition-all duration-150',
      isActive
        ? 'bg-white/10 text-white/95'
        : 'text-white/50 hover:bg-white/6 hover:text-white/85'
    )
  }

  const asideClass = cn(
    'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 z-40',
    'overflow-hidden select-none',
    'transition-[width] duration-300 ease-in-out',
    collapsed ? 'lg:w-16' : 'lg:w-60',
    onSettingsPage ? SIDEBAR_SUB_BG : SIDEBAR_BG,
    'border-r', BORDER
  )

  const headerClass = cn(
    'flex h-16 items-center border-b shrink-0',
    BORDER,
    collapsed ? 'justify-center' : 'gap-2.5 px-4'
  )

  const footerInnerClass = cn(
    'flex items-center min-w-0',
    collapsed ? 'justify-center' : 'gap-2.5 px-1'
  )

  // When collapsed: clicking Settings navigates directly; when expanded: toggles submenu
  const handleSettingsClick = () => {
    if (collapsed) {
      navigate('/settings?section=business')
    } else {
      setSettingsOpen((v) => !v)
    }
  }

  return (
    <aside className={asideClass} onDoubleClick={onToggle}>

      {/* Station header — logo always visible, name only when expanded */}
      <div className={headerClass}>
        {stationPhotoUrl ? (
          <img
            src={stationPhotoUrl}
            alt={stationName}
            className="h-8 w-8 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-white/70" />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate leading-tight">{stationName}</p>
            <p className="text-[10px] text-white/45 mt-0.5">{planLabel} Plan</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5">

        {/* Main nav items */}
        {navItems.map(({ to, label, icon: Icon }) => {
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
        })}

        {/* Settings — collapsible parent */}
        <button
          type="button"
          onClick={handleSettingsClick}
          className={mainNavClass(onSettingsPage)}
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && 'Settings'}
          {!collapsed && (
            settingsOpen
              ? <ChevronDown className="h-3.5 w-3.5 ml-auto shrink-0 opacity-60" />
              : <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0 opacity-60" />
          )}
        </button>

        {/* Settings submenu — only when expanded and open */}
        {!collapsed && settingsOpen && (
          <div className="ml-4 border-l border-white/10 space-y-0.5 pb-1">
            <p className="pl-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
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
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                  {locked && (
                    <span className="ml-auto flex items-center gap-0.5 text-[9px] font-bold rounded px-1 py-0.5 bg-amber-500/25 text-amber-300">
                      <Lock className="h-2.5 w-2.5" />PRO
                    </span>
                  )}
                </button>
              )
            })}

            <p className="pl-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
              Account
            </p>
            {USER_MENU.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => navigate(`/settings?section=${id}`)}
                className={subNavClass(activeSection === id)}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
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
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                  {locked && (
                    <span className="ml-auto flex items-center gap-0.5 text-[9px] font-bold rounded px-1 py-0.5 bg-amber-500/25 text-amber-300">
                      <Lock className="h-2.5 w-2.5" />PRO
                    </span>
                  )}
                </button>
              )
            })}
          </div>
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
