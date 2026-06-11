import { NavLink } from 'react-router-dom'
import { ShoppingCart, Receipt, Users, Package, BarChart, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/hooks/usePlan'

const OWNER_NAV = [
  { to: '/sales',     label: 'Sales',     icon: ShoppingCart },
  { to: '/expenses',  label: 'Expenses',  icon: Receipt },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/reports',   label: 'Reports',   icon: BarChart },
]

const STAFF_NAV = [
  { to: '/sales',     label: 'Sales',     icon: ShoppingCart },
  { to: '/expenses',  label: 'Expenses',  icon: Receipt },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/settings',  label: 'Settings',  icon: Settings },
]

const FREE_LOCKED = new Set(['/customers', '/inventory', '/reports'])

export function BottomNav() {
  const role     = useAuthStore((s) => s.role)
  const plan     = usePlan()
  const navItems = role === 'owner' || role === 'super_admin' ? OWNER_NAV : STAFF_NAV
  const isFree   = plan === 'free'

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isLocked = isFree && FREE_LOCKED.has(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 relative transition-all duration-150',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                  )}
                  <div className="relative">
                    <Icon className={cn('h-5 w-5 shrink-0', isActive && 'scale-110')} />
                    {isLocked && (
                      <span className="absolute -top-1.5 -right-2 text-[7px] font-bold bg-amber-500 text-white rounded px-0.5 leading-tight">
                        PRO
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium leading-tight">{label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
