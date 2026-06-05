import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useAuthStore } from '@/stores/authStore'
import { BusinessSettings } from '@/features/settings/components/BusinessSettings'
import { ProductsTab } from '@/features/settings/components/ProductsTab'
import { TeamSettings } from '@/features/settings/components/TeamSettings'
import { MaintenanceTable } from '@/features/maintenance/components/MaintenanceTable'
import { PlanSettings } from '@/features/settings/components/PlanSettings'
import { cn } from '@/lib/utils'

type Tab = 'business' | 'products' | 'maintenance' | 'team' | 'plan'

const ALL_TABS: { id: Tab; label: string; ownerOnly?: boolean }[] = [
  { id: 'business',    label: 'Business' },
  { id: 'products',    label: 'Products' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'team',        label: 'Team',  ownerOnly: true },
  { id: 'plan',        label: 'Plan' },
]

export default function SettingsPage() {
  const role    = useAuthStore((s) => s.role)
  const isOwner = role === 'owner'
  const TABS    = ALL_TABS.filter((t) => !t.ownerOnly || isOwner)

  const [activeTab, setActiveTab] = useState<Tab>('business')

  const {
    data,
    isLoading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    addDeliveryZone,
    updateDeliveryZone,
    deleteDeliveryZone,
    updateStationSettings,
    updateStationName,
    uploadStationPhoto,
    addContact,
    updateContact,
    deleteContact,
  } = useSettings()

  const stationName     = useAuthStore((s) => s.station?.name ?? '')
  const stationPhotoUrl = useAuthStore((s) => s.station?.photo_url ?? null)

  return (
    <div>
      <PageHeader title="Settings" />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex border-b border-border mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-none px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all duration-150 whitespace-nowrap',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'business' && (
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
      )}

      {activeTab === 'products' && (
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
      )}

      {activeTab === 'maintenance' && <MaintenanceTable />}

      {activeTab === 'team' && <TeamSettings />}

      {activeTab === 'plan' && <PlanSettings />}

      {/* Sign out — visible on mobile/tablet only (sidebar has it on lg:) */}
      <div className="mt-8 pt-6 border-t border-border lg:hidden">
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
  )
}
