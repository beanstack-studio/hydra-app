import { useEffect, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

interface IntervalTrackerSettingsModalProps {
  isOpen:        boolean
  onClose:       () => void
  title:         string
  intervalDays:  number
  alertEnabled:  boolean
  onSave:        (intervalDays: number, alertEnabled: boolean) => Promise<void>
}

export function IntervalTrackerSettingsModal({
  isOpen,
  onClose,
  title,
  intervalDays,
  alertEnabled,
  onSave,
}: IntervalTrackerSettingsModalProps) {
  const { toast } = useToast()

  const [selectedInterval,  setSelectedInterval]  = useState(intervalDays)
  const [localAlertEnabled, setLocalAlertEnabled] = useState(alertEnabled)
  const [isSaving,          setIsSaving]          = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setSelectedInterval(intervalDays)
    setLocalAlertEnabled(alertEnabled)
  }, [isOpen, intervalDays, alertEnabled])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(selectedInterval, localAlertEnabled)
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

        {/* Interval */}
        <div className="space-y-1.5">
          <Label htmlFor="it-interval">Test schedule</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Run test every</span>
            <Input
              id="it-interval"
              type="number"
              min={1}
              step={1}
              value={selectedInterval}
              onChange={(e) =>
                setSelectedInterval(Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </div>

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
