import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  Receipt,
  Users,
  Package,
  BarChart,
  Settings,
  LogOut,
  Building2,
  ChevronDown,
  Wrench,
  CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

const ALL_NAV_ITEMS = [
  { to: '/sales',     label: 'Sales',     icon: ShoppingCart },
  { to: '/expenses',  label: 'Expenses',  icon: Receipt },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/reports',   label: 'Reports',   icon: BarChart },
  { to: '/settings',  label: 'Settings',  icon: Settings },
]

const STAFF_NAV_ITEMS = [
  { to: '/sales',     label: 'Sales',     icon: ShoppingCart },
  { to: '/expenses',  label: 'Expenses',  icon: Receipt },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/inventory', label: 'Inventory', icon: Package },
]

const STORE_MENU = [
  { id: 'business',    label: 'Business Info',      icon: Building2 },
  { id: 'products',    label: 'Products & Pricing',  icon: Package },
  { id: 'maintenance', label: 'Maintenance Log',     icon: Wrench },
]

const ACCOUNT_MENU = [
  { id: 'team', label: 'Team Members',  icon: Users },
  { id: 'plan', label: 'Plan & Billing', icon: CreditCard },
]

/* Deep teal derived from primary hue — clearly themed, not pitch-black */
const SIDEBAR_BG  = 'bg-[hsl(191,72%,14%)]'
const BORDER      = 'border-white/10'

export function Sidebar() {
  const navigate       = useNavigate()
  const station        = useAuthStore((s) => s.station)
  const user           = useAuthStore((s) => s.user)
  const role           = useAuthStore((s) => s.role)
  const userName       = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? ''
  const navItems       = (role === 'owner' || role === 'super_admin') ? ALL_NAV_ITEMS : STAFF_NAV_ITEMS
  const isOwner        = role === 'owner' || role === 'super_admin'
  const stationPhotoUrl = (station as { photo_url?: string | null } | null)?.photo_url ?? null
  const stationName    = station?.name ?? 'My Station'
  const planLabel      = station?.plan ? station.plan.charAt(0).toUpperCase() + station.plan.slice(1) : 'Free'

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  function goToSection(sectionId: string) {
    navigate(`/settings?section=${sectionId}`)
    setMenuOpen(false)
  }

  return (
    <aside className={cn('hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 z-40', SIDEBAR_BG, 'border-r', BORDER)}>

      {/* Station profile header — toggles section dropdown */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            'flex h-16 w-full items-center gap-2.5 px-4 border-b transition-colors duration-150 group',
            BORDER,
            menuOpen ? 'bg-white/10' : 'hover:bg-white/8'
          )}
        >
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
          <div className="min-w-0 flex-1 text-left">
            <p className="text-sm font-bold text-white truncate leading-tight">{stationName}</p>
            <p className="text-[10px] text-white/45 mt-0.5">{planLabel} Plan</p>
          </div>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-white/40 shrink-0 transition-transform duration-200',
              menuOpen && 'rotate-180'
            )}
          />
        </button>

        {/* Section dropdown */}
        {menuOpen && (
          <div className={cn('absolute top-full left-0 right-0 z-50 py-2 shadow-xl', SIDEBAR_BG, 'border-b', BORDER)}>
            <p className="px-4 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
              Store
            </p>
            {STORE_MENU.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => goToSection(id)}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-white/65 hover:bg-white/8 hover:text-white transition-colors duration-150"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}

            {isOwner && (
              <>
                <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                  Account
                </p>
                {ACCOUNT_MENU.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => goToSection(id)}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-white/65 hover:bg-white/8 hover:text-white transition-colors duration-150"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/55 hover:bg-white/8 hover:text-white/90'
              )
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {label}
          </NavLink>
        ))}
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
