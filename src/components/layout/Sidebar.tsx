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
  const station = useAuthStore((s) => s.station)
  const user    = useAuthStore((s) => s.user)
  const userName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? ''

  return (
    <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-card border-r border-border z-40">
      <div className="flex h-16 items-center px-6 border-b border-border shrink-0">
        <span className="text-2xl font-bold text-primary tracking-tight">
          Hydra
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-border shrink-0 space-y-2">
        {station && (
          <div className="px-1 space-y-0.5">
            {userName && (
              <p className="text-xs font-medium text-foreground truncate">{userName}</p>
            )}
            <p className="text-xs text-muted-foreground truncate">{station.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{station.plan} plan</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
