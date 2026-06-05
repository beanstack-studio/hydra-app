import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, MapPin, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Modal } from '@/components/shared/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import type { DeliveryZone, DeliveryZoneInput, StationSettings, StationSettingsInput } from '../types'

// ── Zone form schema ───────────────────────────────────────────────────────

const zoneSchema = z.object({
  name: z.string().min(1, 'Zone name is required'),
  price: z.number({ error: 'Enter a valid price' }).min(0),
  is_active: z.boolean(),
})

type ZoneSchema = z.infer<typeof zoneSchema>

// ── Container fee schema ───────────────────────────────────────────────────

const containerSchema = z.object({
  container_name: z.string().min(1, 'Container name is required'),
  container_fee_price: z.number({ error: 'Enter a valid price' }).min(0),
  container_fee_enabled: z.boolean(),
})

type ContainerSchema = z.infer<typeof containerSchema>

// ── Props ──────────────────────────────────────────────────────────────────

interface AddonSettingsProps {
  deliveryZones: DeliveryZone[]
  stationSettings: StationSettings | null
  isLoading: boolean
  onAddZone: (input: DeliveryZoneInput) => Promise<void>
  onUpdateZone: (id: string, input: Partial<DeliveryZoneInput>) => Promise<void>
  onDeleteZone: (id: string) => Promise<void>
  onUpdateStationSettings: (input: Partial<StationSettingsInput>) => Promise<void>
}

export function AddonSettings({
  deliveryZones,
  stationSettings,
  isLoading,
  onAddZone,
  onUpdateZone,
  onDeleteZone,
  onUpdateStationSettings,
}: AddonSettingsProps) {
  const { toast } = useToast()

  // ── Zone form state ──────────────────────────────────────────────────────

  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null)
  const [isZoneFormOpen, setIsZoneFormOpen] = useState(false)
  const [deletingZone, setDeletingZone] = useState<DeliveryZone | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ZoneSchema>({
    resolver: zodResolver(zoneSchema),
    defaultValues: { name: '', price: 0, is_active: true },
  })

  const openAddZone = () => {
    setEditingZone(null)
    reset({ name: '', price: 0, is_active: true })
    setIsZoneFormOpen(true)
  }

  const openEditZone = (zone: DeliveryZone) => {
    setEditingZone(zone)
    reset({ name: zone.name, price: zone.price, is_active: zone.is_active })
    setIsZoneFormOpen(true)
  }

  const closeZoneForm = () => {
    setIsZoneFormOpen(false)
    setEditingZone(null)
  }

  const onZoneSubmit = handleSubmit(async (values) => {
    try {
      if (editingZone) {
        await onUpdateZone(editingZone.id, values)
        toast({ title: 'Delivery zone updated' })
      } else {
        await onAddZone(values)
        toast({ title: 'Delivery zone added' })
      }
      closeZoneForm()
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  })

  const handleDeleteZone = async () => {
    if (!deletingZone) return
    setIsDeleting(true)
    try {
      await onDeleteZone(deletingZone.id)
      toast({ title: 'Delivery zone deleted' })
      setDeletingZone(null)
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Container fee form ───────────────────────────────────────────────────

  const {
    register: cRegister,
    handleSubmit: cHandleSubmit,
    control: cControl,
    reset: cReset,
    formState: { errors: cErrors, isSubmitting: cSubmitting },
  } = useForm<ContainerSchema>({
    resolver: zodResolver(containerSchema),
    defaultValues: {
      container_name: '',
      container_fee_price: 0,
      container_fee_enabled: false,
    },
  })

  useEffect(() => {
    cReset({
      container_name: stationSettings?.container_name ?? '',
      container_fee_price: stationSettings?.container_fee_price ?? 0,
      container_fee_enabled: stationSettings?.container_fee_enabled ?? false,
    })
  }, [stationSettings, cReset])

  const onContainerSubmit = cHandleSubmit(async (values) => {
    try {
      await onUpdateStationSettings({
        container_name: values.container_name,
        container_fee_price: values.container_fee_price,
        container_fee_enabled: values.container_fee_enabled,
      })
      toast({ title: 'Container fee saved' })
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  })

  if (isLoading) return <LoadingSkeleton rows={4} />

  return (
    <div className="space-y-8">

      {/* Delivery Zones */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Delivery Zones
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              One zone per sale — shown as radio chips in the sale form.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={openAddZone}>
            <Plus className="h-4 w-4 mr-1" />
            Add Zone
          </Button>
        </div>

        {deliveryZones.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-8 w-8" />}
            title="No delivery zones yet"
            description="Add zones like Barangay 1 or Zone A with their delivery fee."
          />
        ) : (
          <div className="space-y-2">
            {deliveryZones.map((zone) => (
              <div
                key={zone.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{zone.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(zone.price)} delivery fee
                      {!zone.is_active && ' · inactive'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEditZone(zone)}
                    aria-label={`Edit ${zone.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeletingZone(zone)}
                    aria-label={`Delete ${zone.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Container Fee */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Container Fee
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Shown as a checkbox + qty stepper in the sale form when active.
        </p>

        <form onSubmit={onContainerSubmit} className="space-y-4 max-w-sm">
          <div className="space-y-1.5">
            <Label htmlFor="container-name">Container Type</Label>
            <Input
              id="container-name"
              placeholder="e.g. Slim Bottle, Round Container"
              {...cRegister('container_name')}
            />
            {cErrors.container_name && (
              <p className="text-xs text-destructive">{cErrors.container_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="container-price">Price per container</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
              <Input
                id="container-price"
                type="number"
                step="0.01"
                min="0"
                className="pl-7"
                {...cRegister('container_fee_price', { valueAsNumber: true })}
              />
            </div>
            {cErrors.container_fee_price && (
              <p className="text-xs text-destructive">{cErrors.container_fee_price.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">Show in the sale form</p>
            </div>
            <Controller
              name="container_fee_enabled"
              control={cControl}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <Button type="submit" size="sm" disabled={cSubmitting}>
            <Package className="h-4 w-4 mr-1" />
            {cSubmitting ? 'Saving…' : 'Save Container Fee'}
          </Button>
        </form>
      </section>

      {/* Zone form modal */}
      <Modal
        isOpen={isZoneFormOpen}
        onClose={closeZoneForm}
        title={editingZone ? 'Edit Delivery Zone' : 'Add Delivery Zone'}
        size="sm"
      >
        <form onSubmit={onZoneSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="zone-name">Zone Name</Label>
            <Input
              id="zone-name"
              placeholder="e.g. Barangay 5"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="zone-price">Delivery Fee</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
              <Input
                id="zone-price"
                type="number"
                step="0.01"
                min="0"
                className="pl-7"
                {...register('price', { valueAsNumber: true })}
              />
            </div>
            {errors.price && (
              <p className="text-xs text-destructive">{errors.price.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <Label htmlFor="zone-active" className="cursor-pointer">Active</Label>
            <Controller
              name="is_active"
              control={control}
              render={({ field }) => (
                <Switch
                  id="zone-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={closeZoneForm}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : editingZone ? 'Save Changes' : 'Add Zone'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete zone confirm */}
      <Modal
        isOpen={!!deletingZone}
        onClose={() => setDeletingZone(null)}
        title="Delete Delivery Zone"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-semibold text-foreground">{deletingZone?.name}</span>?
            This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeletingZone(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              disabled={isDeleting}
              onClick={handleDeleteZone}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
