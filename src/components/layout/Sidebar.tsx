import { NavLink } from 'react-router-dom'
import {
  ShoppingCart,
  Receipt,
  Users,
  Package,
  BarChart,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

const navItems = [
  { to: '/sales',     label: 'Sales',     icon: ShoppingCart },
  { to: '/expenses',  label: 'Expenses',  icon: Receipt },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/reports',   label: 'Reports',   icon: BarChart },
  { to: '/settings',  label: 'Settings',  icon: Settings },
]

/* Deep teal derived from primary hue — clearly themed, not pitch-black */
const SIDEBAR_BG  = 'bg-[hsl(191,72%,14%)]'
const BORDER      = 'border-white/10'

export function Sidebar() {
  const station  = useAuthStore((s) => s.station)
  const user     = useAuthStore((s) => s.user)
  const userName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? ''

  return (
    <aside className={cn('hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 z-40', SIDEBAR_BG, 'border-r', BORDER)}>
      {/* Logo + wordmark */}
      <div className={cn('flex h-16 items-center gap-2.5 px-5 border-b shrink-0', BORDER)}>
        <img src="/logo.png" alt="Hydra" className="h-9 w-9 rounded-full object-cover shrink-0" />
        <span className="text-base font-bold text-white tracking-tight">Hydra</span>
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

      {/* User info + sign out */}
      <div className={cn('px-3 py-3 border-t shrink-0 space-y-2', BORDER)}>
        {station && (
          <div className="px-1 space-y-0.5">
            {userName && (
              <p className="text-xs font-medium text-white/80 truncate">{userName}</p>
            )}
            <p className="text-xs text-white/40 truncate">{station.name}</p>
            <p className="text-xs text-white/40 capitalize">{station.plan} plan</p>
          </div>
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
