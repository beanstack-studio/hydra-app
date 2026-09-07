import { useState } from 'react'
import { TestTube2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { usePhysicalChemicalTest } from '../hooks/usePhysicalChemicalTest'
import { usePhysicalChemicalTestHistory } from '../hooks/usePhysicalChemicalTestHistory'
import { IntervalTrackerCard } from './IntervalTrackerCard'
import { IntervalTrackerSettingsModal } from './IntervalTrackerSettingsModal'
import { IntervalTrackerHistoryModal } from './IntervalTrackerHistoryModal'

export function PhysicalChemicalTestCard() {
  const role    = useAuthStore((s) => s.role)
  const isOwner = role === 'owner' || role === 'super_admin'

  const {
    lastTestedAt,
    daysRemaining,
    cycleDays,
    intervalDays,
    alertEnabled,
    isConfigured,
    eventsTotal,
    zone,
    isLoading,
    error,
    markAsCompleted,
    updateSettings,
  } = usePhysicalChemicalTest()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen,  setHistoryOpen]  = useState(false)

  const { data: historyData, isLoading: historyLoading, error: historyError } =
    usePhysicalChemicalTestHistory(historyOpen)

  return (
    <>
      <IntervalTrackerCard
        title="Physical & Chemical Test"
        icon={TestTube2}
        actionLabel="Mark as Tested"
        countNoun="test"
        lastEventLabel="Last tested"
        successToastTitle="Physical & chemical test logged"
        lastEventAt={lastTestedAt}
        daysRemaining={daysRemaining}
        cycleDays={cycleDays}
        isConfigured={isConfigured}
        eventsTotal={eventsTotal}
        zone={zone}
        isLoading={isLoading}
        error={error}
        onMarkCompleted={markAsCompleted}
        onSettingsOpen={() => setSettingsOpen(true)}
        onHistoryOpen={() => setHistoryOpen(true)}
        isOwner={isOwner}
      />

      {isOwner && (
        <IntervalTrackerSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          title="Physical & Chemical Test"
          intervalDays={intervalDays}
          alertEnabled={alertEnabled}
          onSave={updateSettings}
        />
      )}

      <IntervalTrackerHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Physical & Chemical Test History"
        icon={TestTube2}
        data={historyData}
        isLoading={historyLoading}
        error={historyError}
        emptyTitle="No tests yet"
        emptyDescription="History will appear here after the first physical & chemical test is logged."
      />
    </>
  )
}
