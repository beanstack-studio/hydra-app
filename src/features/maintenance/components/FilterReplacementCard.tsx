import { useState } from 'react'
import { Filter } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useFilterReplacement } from '../hooks/useFilterReplacement'
import { IntervalTrackerCard } from './IntervalTrackerCard'
import { FilterReplacementSettingsModal } from './FilterReplacementSettingsModal'
import { FilterReplacementHistoryModal } from './FilterReplacementHistoryModal'

export function FilterReplacementCard() {
  const role    = useAuthStore((s) => s.role)
  const isOwner = role === 'owner' || role === 'super_admin'

  const {
    lastReplacedAt,
    daysRemaining,
    cycleDays,
    intervalDays,
    alertEnabled,
    isConfigured,
    replacementsYtd,
    supplies,
    linkedSupplies,
    zone,
    isLoading,
    error,
    markAsReplaced,
    updateSettings,
  } = useFilterReplacement()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen,  setHistoryOpen]  = useState(false)

  return (
    <>
      <IntervalTrackerCard
        title="Filter Replacement"
        icon={Filter}
        actionLabel="Mark as Replaced"
        countNoun="replacement"
        lastEventLabel="Last replaced"
        successToastTitle="Filter replacement logged"
        successToastDescription="Counter reset."
        lastEventAt={lastReplacedAt}
        daysRemaining={daysRemaining}
        cycleDays={cycleDays}
        isConfigured={isConfigured}
        eventsTotal={replacementsYtd}
        zone={zone}
        isLoading={isLoading}
        error={error}
        onMarkCompleted={markAsReplaced}
        onSettingsOpen={() => setSettingsOpen(true)}
        onHistoryOpen={() => setHistoryOpen(true)}
        isOwner={isOwner}
      />

      {isOwner && (
        <FilterReplacementSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          intervalDays={intervalDays}
          alertEnabled={alertEnabled}
          linkedSupplies={linkedSupplies}
          supplies={supplies}
          onSave={updateSettings}
        />
      )}

      <FilterReplacementHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  )
}
