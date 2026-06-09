import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Building2, Package, Wrench, Users, CreditCard, User,
  ChevronRight, LogOut, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/hooks/usePlan'
import { BusinessSettings } from '@/features/settings/components/BusinessSettings'
import { ProductsTab } from '@/features/settings/components/ProductsTab'
import { TeamSettings } from '@/features/settings/components/TeamSettings'
import { MaintenanceTable } from '@/features/maintenance/components/MaintenanceTable'
import { PlanSettings } from '@/features/settings/components/PlanSettings'
import { AccountSettings } from '@/features/settings/components/AccountSettings'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Section = 'business' | 'products' | 'maintenance' | 'team' | 'plan' | 'account'

interface SectionDef {
  id: Section
  label: string
  description: string
  icon: React.ElementType
  ownerOnly?: boolean
}

const STORE_SECTIONS: SectionDef[] = [
  { id: 'business',    label: 'Business Info',     description: 'Name, address, hours, contacts', icon: Building2 },
  { id: 'products',    label: 'Products & Pricing', description: 'Water, ice, add-ons, container', icon: Package },
  { id: 'maintenance', label: 'Maintenance Log',    description: 'Track equipment upkeep',         icon: Wrench },
]

const ACCOUNT_SECTIONS: SectionDef[] = [
  { id: 'account', label: 'My Account',   description: 'Email, password, display name', icon: User },
  { id: 'team',    label: 'Team Members',  description: 'Staff roster and pay rates',    icon: Users,      ownerOnly: true },
  { id: 'plan',    label: 'Plan & Billing', description: 'Your subscription and limits',  icon: CreditCard, ownerOnly: true },
]

const SECTION_LABELS: Record<Section, string> = {
  business:    'Business Info',
  products:    'Products & Pricing',
  maintenance: 'Maintenance Log',
  team:        'Team Members',
  plan:        'Plan & Billing',
  account:     'My Account',
}

const PLAN_LABELS: Record<string, string> = {
  free:  'Free',
  basic: 'Basic',
  pro:   'Pro',
}

export default function SettingsPage() {
  const navigate      = useNavigate()
  const [searchParams] = useSearchParams()
  const role    = useAuthStore((s) => s.role)
  const station = useAuthStore((s) => s.station)
  const plan    = usePlan()
  const isOwner = role === 'owner' || role === 'super_admin'
  const isFree  = plan === 'free'

  const [active, setActive] = useState<Section | null>(null)

  // On desktop, default to Business Info via URL if no section param present
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches && !searchParams.get('section')) {
      navigate('/settings?section=business', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to a specific section via ?section= URL param (e.g. from sidebar dropdown)
  useEffect(() => {
    const param = searchParams.get('section') as Section | null
    const VALID: Section[] = ['business', 'products', 'maintenance', 'team', 'plan', 'account']
    if (param && VALID.includes(param)) {
      setActive(param)
    }
  }, [searchParams])

  const {
    data, isLoading, error,
    addProduct, updateProduct, deleteProduct,
    addDeliveryZone, updateDeliveryZone, deleteDeliveryZone,
    updateStationSettings, updateStationName, uploadStationPhoto,
    addContact, updateContact, deleteContact,
  } = useSettings()

  const stationName     = station?.name ?? ''
  const stationPhotoUrl = (station as { photo_url?: string | null } | null)?.photo_url ?? null
  const planLabel       = PLAN_LABELS[station?.plan ?? 'free'] ?? 'Free'

  const visibleStore   = isFree
    ? STORE_SECTIONS.filter((s) => s.id !== 'maintenance')
    : STORE_SECTIONS
  const visibleAccount = ACCOUNT_SECTIONS.filter((s) => !s.ownerOnly || isOwner)

  function renderDetail() {
    if (!active) return null
    switch (active) {
      case 'business':
        return (
          <BusinessSettings
            stationName={stationName}
            stationPhotoUrl={stationPhotoUrl}
            stationSettings={data?.stationSettings ?? null}
            contacts={data?.contacts ?? []}
            isLoading={isLoading}
            onUpdateName={updateStationName}
            onUpdateSettings={updateStationSettings}
            onUploadPhoto={uploadStationPhoto}
            onAddContact={addContact}
            onUpdateContact={updateContact}
            onDeleteContact={deleteContact}
          />
        )
      case 'products':
        return (
          <ProductsTab
            products={data?.products ?? []}
            deliveryZones={data?.deliveryZones ?? []}
            stationSettings={data?.stationSettings ?? null}
            isLoading={isLoading}
            onAddProduct={addProduct}
            onUpdateProduct={updateProduct}
            onDeleteProduct={deleteProduct}
            onAddZone={addDeliveryZone}
            onUpdateZone={updateDeliveryZone}
            onDeleteZone={deleteDeliveryZone}
            onUpdateStationSettings={updateStationSettings}
          />
        )
      case 'maintenance':
        return <MaintenanceTable />
      case 'team':
        return <TeamSettings />
      case 'plan':
        return <PlanSettings />
      case 'account':
        return <AccountSettings />
    }
  }

  // ── Profile card — reused in both hub and desktop sidebar ──────────────────
  function ProfileCard({ compact = false, noMargin = false }: { compact?: boolean; noMargin?: boolean }) {
    return (
      <div className={cn('flex items-center gap-3', compact ? 'p-4' : (!noMargin && 'mb-8'))}>
        {stationPhotoUrl ? (
          <img
            src={stationPhotoUrl}
            alt={stationName}
            className={cn('rounded-full object-cover shrink-0', compact ? 'h-10 w-10' : 'h-14 w-14')}
          />
        ) : (
          <div className={cn('rounded-full bg-primary/15 flex items-center justify-center shrink-0', compact ? 'h-10 w-10' : 'h-14 w-14')}>
            <Building2 className={cn('text-primary', compact ? 'h-5 w-5' : 'h-7 w-7')} />
          </div>
        )}
        <div className="min-w-0">
          <p className={cn('font-bold text-foreground truncate', compact ? 'text-sm' : 'text-lg')}>{stationName || 'My Station'}</p>
          <Badge variant="outline" className="mt-0.5 text-[10px] font-medium">{planLabel} Plan</Badge>
        </div>
      </div>
    )
  }

  // ── Section card (used in mobile hub) ─────────────────────────────────────
  function SectionCard({ section }: { section: SectionDef }) {
    const Icon = section.icon
    return (
      <button
        type="button"
        onClick={() => setActive(section.id)}
        className="flex items-center gap-3 w-full rounded-xl border border-border bg-card px-4 py-3.5 hover:bg-accent/50 active:bg-accent transition-colors duration-150 text-left"
      >
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-[18px] w-[18px] text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{section.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
    )
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Desktop: full-width content (nav lives in Sidebar) ───────────── */}
      <div className="hidden lg:block">
        {active && (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-6">{SECTION_LABELS[active]}</h1>
            {renderDetail()}
          </>
        )}
      </div>

      {/* ── Mobile: hub → detail ──────────────────────────────────────────── */}
      <div className="lg:hidden">
        {active === null ? (
          /* Hub */
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
              <ProfileCard noMargin />
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="self-start flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150 shrink-0"
                aria-label="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
                Store
              </p>
              <div className="space-y-2">
                {visibleStore.map((s) => <SectionCard key={s.id} section={s} />)}
              </div>
            </div>

            {visibleAccount.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
                  Account
                </p>
                <div className="space-y-2">
                  {visibleAccount.map((s) => <SectionCard key={s.id} section={s} />)}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => void supabase.auth.signOut()}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors duration-150"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* Detail */
          <div>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 mb-5 -ml-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Settings
            </button>
            <h1 className="text-2xl font-bold text-foreground mb-6">{SECTION_LABELS[active]}</h1>
            {renderDetail()}
          </div>
        )}
      </div>
    </>
  )
}
