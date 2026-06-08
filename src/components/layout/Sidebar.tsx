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
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/reports', label: 'Reports', icon: BarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const station  = useAuthStore((s) => s.station)
  const user     = useAuthStore((s) => s.user)
  const userName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? ''

  return (
    <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-900 border-r border-slate-700/30 z-40">
      {/* Logo + wordmark */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-slate-700/30 shrink-0">
        <img src="/logo.png" alt="Hydra" className="h-8 w-auto" />
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
                  ? 'bg-primary/15 text-primary'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
              )
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + sign out */}
      <div className="px-3 py-3 border-t border-slate-700/30 shrink-0 space-y-2">
        {station && (
          <div className="px-1 space-y-0.5">
            {userName && (
              <p className="text-xs font-medium text-slate-200 truncate">{userName}</p>
            )}
            <p className="text-xs text-slate-500 truncate">{station.name}</p>
            <p className="text-xs text-slate-500 capitalize">{station.plan} plan</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-100 transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
