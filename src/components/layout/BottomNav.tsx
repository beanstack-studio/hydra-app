import { NavLink } from 'react-router-dom'
import {
  ShoppingCart,
  Receipt,
  Users,
  Package,
  BarChart,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/reports', label: 'Reports', icon: BarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border lg:hidden">
      <div className="flex h-16">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-all duration-150',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
