import { NavLink } from 'react-router-dom'
import { ShoppingCart, Receipt, Users, Package, BarChart, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/hooks/usePlan'
import { useBillsBadgeStore } from '@/stores/billsBadgeStore'

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

const FREE_LOCKED = new Set(['/inventory', '/reports'])

export function BottomNav() {
  const role           = useAuthStore((s) => s.role)
  const plan           = usePlan()
  const navItems       = role === 'owner' || role === 'super_admin' ? OWNER_NAV : STAFF_NAV
  const isFree         = plan === 'free'
  const billsBadgeZone = useBillsBadgeStore((s) => s.zone)

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border lg:hidden">
      <div className="flex pb-safe">
        {navItems.map(({ to, icon: Icon }) => {
          const isLocked    = isFree && FREE_LOCKED.has(to)
          const showDot     = to === '/expenses' && billsBadgeZone !== 'green'
          const dotClass    = billsBadgeZone === 'red' ? 'bg-red-500' : 'bg-yellow-400'
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center relative py-[14px] transition-all duration-150',
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
                    <Icon className={cn('h-7 w-7 shrink-0', isActive && 'scale-110')} />
                    {isLocked && (
                      <span className="absolute -top-1.5 -right-2 text-[7px] font-bold bg-amber-500 text-white rounded px-0.5 leading-tight">
                        PRO
                      </span>
                    )}
                    {!isLocked && showDot && (
                      <span className={cn(
                        'absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                        dotClass,
                      )} />
                    )}
                  </div>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
