import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useBacteriologicalTest } from '../hooks/useBacteriologicalTest'
import { useBacteriologicalTestHistory } from '../hooks/useBacteriologicalTestHistory'
import { IntervalTrackerCard } from './IntervalTrackerCard'
import { IntervalTrackerSettingsModal } from './IntervalTrackerSettingsModal'
import { IntervalTrackerHistoryModal } from './IntervalTrackerHistoryModal'

export function BacteriologicalTestCard() {
  const role    = useAuthStore((s) => s.role)
  const isOwner = role === 'owner' || role === 'super_admin'

  const {
    lastTestedAt,
    daysRemaining,
    cycleDays,
    cadenceConfig,
    alertEnabled,
    isConfigured,
    eventsTotal,
    zone,
    isLoading,
    error,
    markAsCompleted,
    updateSettings,
  } = useBacteriologicalTest()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen,  setHistoryOpen]  = useState(false)

  const { data: historyData, isLoading: historyLoading, error: historyError } =
    useBacteriologicalTestHistory(historyOpen)

  return (
    <>
      <IntervalTrackerCard
        title="Bacteriological Test"
        icon={FlaskConical}
        actionLabel="Mark as Tested"
        countNoun="test"
        lastEventLabel="Last tested"
        successToastTitle="Bacteriological test logged"
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
          title="Bacteriological Test"
          cadenceConfig={cadenceConfig}
          alertEnabled={alertEnabled}
          onSave={updateSettings}
        />
      )}

      <IntervalTrackerHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Bacteriological Test History"
        icon={FlaskConical}
        data={historyData}
        isLoading={historyLoading}
        error={historyError}
        emptyTitle="No tests yet"
        emptyDescription="History will appear here after the first bacteriological test is logged."
      />
    </>
  )
}
