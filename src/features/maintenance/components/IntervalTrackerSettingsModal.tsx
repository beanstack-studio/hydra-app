import { useEffect, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { CadenceSettings } from './CadenceSettings'
import type { CadenceConfig } from '../lib/cadenceUtils'

interface IntervalTrackerSettingsModalProps {
  isOpen:        boolean
  onClose:       () => void
  title:         string
  cadenceConfig: CadenceConfig
  alertEnabled:  boolean
  onSave:        (cadenceConfig: CadenceConfig, alertEnabled: boolean) => Promise<void>
}

export function IntervalTrackerSettingsModal({
  isOpen,
  onClose,
  title,
  cadenceConfig,
  alertEnabled,
  onSave,
}: IntervalTrackerSettingsModalProps) {
  const { toast } = useToast()

  const [localCadence,      setLocalCadence]      = useState<CadenceConfig>(cadenceConfig)
  const [localAlertEnabled, setLocalAlertEnabled] = useState(alertEnabled)
  const [isSaving,          setIsSaving]          = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLocalCadence(cadenceConfig)
    setLocalAlertEnabled(alertEnabled)
  }, [isOpen, cadenceConfig, alertEnabled])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(localCadence, localAlertEnabled)
      toast({ title: `${title} settings saved` })
      onClose()
    } catch (e) {
      toast({
        title:       'Failed to save settings',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant:     'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${title} Settings`} size="sm">
      <div className="space-y-5">

        {/* Cadence configuration */}
        <CadenceSettings value={localCadence} onChange={setLocalCadence} />

        {/* Login alert toggle */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="it-alert-enabled">Show login reminder when overdue</Label>
            <Switch
              id="it-alert-enabled"
              checked={localAlertEnabled}
              onCheckedChange={setLocalAlertEnabled}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Badge will still show even if reminders are muted.
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={isSaving} onClick={() => void handleSave()}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
