import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera, Pencil, Plus, Smartphone, Phone, MessageCircle, Mail, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { useToast } from '@/hooks/use-toast'
import { ContactDisplayRow } from './ContactDisplayRow'
import { ContactEditRow } from './ContactEditRow'
import { OpenHoursSettings } from './OpenHoursSettings'
import { formatPhone } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import type { StationSettings, StationSettingsInput, ContactDetail, ContactDetailInput, ContactType } from '../types'

const businessSchema = z.object({
  name: z.string().min(1, 'Station name is required'),
  business_address: z.string().optional(),
})

type BusinessSchema = z.infer<typeof businessSchema>

const CONTACT_ICONS: Record<ContactType, typeof Smartphone> = {
  mobile: Smartphone,
  landline: Phone,
  messenger: MessageCircle,
  email: Mail,
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024 // 2 MB

interface BusinessSettingsProps {
  stationName: string
  stationPhotoUrl: string | null
  stationSettings: StationSettings | null
  contacts: ContactDetail[]
  isLoading: boolean
  onUpdateName: (name: string) => Promise<void>
  onUpdateSettings: (input: Partial<StationSettingsInput>) => Promise<void>
  onUploadPhoto: (file: File) => Promise<void>
  onAddContact: (input: ContactDetailInput) => Promise<void>
  onUpdateContact: (id: string, input: Partial<ContactDetailInput>) => Promise<void>
  onDeleteContact: (id: string) => Promise<void>
}

export function BusinessSettings({
  stationName,
  stationPhotoUrl,
  stationSettings,
  contacts,
  isLoading,
  onUpdateName,
  onUpdateSettings,
  onUploadPhoto,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
}: BusinessSettingsProps) {
  const { toast } = useToast()
  const isOwner = useAuthStore((s) => s.role) === 'owner'
  const [isEditing, setIsEditing] = useState(false)
  const [isAddingContact, setIsAddingContact] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [deletingContact, setDeletingContact] = useState<ContactDetail | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BusinessSchema>({
    resolver: zodResolver(businessSchema),
    defaultValues: { name: stationName, business_address: '' },
  })

  useEffect(() => {
    reset({
      name: stationName,
      business_address: stationSettings?.business_address ?? '',
    })
  }, [stationName, stationSettings, reset])

  const handleCancel = () => {
    setIsEditing(false)
    setIsAddingContact(false)
    setEditingContactId(null)
    setPhotoFile(null)
    setPhotoPreview(null)
    reset({ name: stationName, business_address: stationSettings?.business_address ?? '' })
  }

  const onSaveInfo = handleSubmit(async (values) => {
    try {
      await onUpdateName(values.name)
      await onUpdateSettings({ business_address: values.business_address || null })
      if (photoFile) {
        await onUploadPhoto(photoFile)
        setPhotoFile(null)
        setPhotoPreview(null)
      }
      toast({ title: 'Business info saved' })
      setIsEditing(false)
      setIsAddingContact(false)
      setEditingContactId(null)
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  })

  const handleSaveContact = async (input: ContactDetailInput) => {
    await onAddContact(input)
    setIsAddingContact(false)
    toast({ title: 'Contact added' })
  }

  const handleUpdateContact = async (id: string, input: ContactDetailInput) => {
    await onUpdateContact(id, input)
    setEditingContactId(null)
    toast({ title: 'Contact updated' })
  }

  const handleDeleteContact = async () => {
    if (!deletingContact) return
    setIsDeleting(true)
    try {
      await onDeleteContact(deletingContact.id)
      toast({ title: 'Contact removed' })
      setDeletingContact(null)
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

  if (isLoading) return <LoadingSkeleton rows={5} />

  // ── View mode ──────────────────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left col: Station Info — header + edit button + card */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Station Info</h2>
              {isOwner && (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-4 space-y-3">
              <div className="flex items-start gap-3">
                {stationPhotoUrl && (
                  <img
                    src={stationPhotoUrl}
                    alt="Station"
                    className="h-14 w-14 rounded-md object-cover shrink-0 border border-border"
                  />
                )}
                <div>
                  <p className="text-base font-semibold text-foreground">{stationName || '—'}</p>
                  <p className="text-sm text-muted-foreground">{stationSettings?.business_address || 'No address set'}</p>
                </div>
              </div>

              {contacts.length > 0 && (
                <div className="border-t border-border pt-3 space-y-2">
                  {contacts.map((c) => {
                    const Icon = CONTACT_ICONS[c.type]
                    const isPhone = c.type === 'mobile' || c.type === 'landline'
                    const displayed = isPhone ? formatPhone(c.value) : c.value
                    return (
                      <div key={c.id} className="flex items-center gap-2 text-sm text-foreground">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>{displayed}</span>
                        {c.label && <span className="text-xs text-muted-foreground">· {c.label}</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {contacts.length === 0 && (
                <p className="text-xs text-muted-foreground border-t border-border pt-3">
                  No contact details — click Edit to add.
                </p>
              )}
            </div>
          </div>

          {/* Right col: Open Hours (self-contained with own header + edit button) */}
          <OpenHoursSettings
            stationSettings={stationSettings}
            onUpdateSettings={onUpdateSettings}
          />
        </div>

        <Modal isOpen={!!deletingContact} onClose={() => setDeletingContact(null)} title="Remove Contact" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Remove this contact detail? This cannot be undone.</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDeletingContact(null)}>Cancel</Button>
              <Button type="button" variant="destructive" className="flex-1" disabled={isDeleting} onClick={handleDeleteContact}>
                {isDeleting ? 'Removing…' : 'Remove'}
              </Button>
            </div>
          </div>
        </Modal>
      </>
    )
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left col: name, address, contacts, save */}
          <div className="space-y-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Station Info</h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="station-name">Station Name</Label>
                <Input id="station-name" placeholder="e.g. MD Cool Bliss" autoFocus {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-address">Address</Label>
                <Input id="biz-address" placeholder="Barangay, City" {...register('business_address')} />
              </div>
              {/* Station photo */}
              <div className="space-y-1.5">
                <Label>Station Photo <span className="font-normal text-muted-foreground">(2 MB max)</span></Label>
                {photoPreview ?? stationPhotoUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={photoPreview ?? stationPhotoUrl ?? ''}
                      alt="Station preview"
                      className="h-16 w-16 rounded-md object-cover border border-border shrink-0"
                    />
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => photoRef.current?.click()}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Change photo
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors duration-150"
                      >
                        <X className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    className="flex items-center gap-2 w-full rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors duration-150"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Upload station photo</span>
                  </button>
                )}
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > MAX_PHOTO_BYTES) {
                      toast({ title: 'File too large', description: 'Photo must be 2 MB or less.', variant: 'destructive' })
                      if (photoRef.current) photoRef.current.value = ''
                      return
                    }
                    setPhotoFile(file)
                    setPhotoPreview(URL.createObjectURL(file))
                  }}
                />
              </div>
            </div>

            {/* Contact Details (edit mode) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Details</h3>
                {!isAddingContact && (
                  <Button size="sm" variant="outline" onClick={() => { setEditingContactId(null); setIsAddingContact(true) }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Contact
                  </Button>
                )}
              </div>

              {contacts.map((contact) =>
                editingContactId === contact.id ? (
                  <ContactEditRow
                    key={contact.id}
                    defaultValues={{ type: contact.type, value: contact.value }}
                    onSave={(input) => handleUpdateContact(contact.id, input)}
                    onCancel={() => setEditingContactId(null)}
                  />
                ) : (
                  <ContactDisplayRow
                    key={contact.id}
                    contact={contact}
                    onEdit={() => { setIsAddingContact(false); setEditingContactId(contact.id) }}
                    onDelete={() => setDeletingContact(contact)}
                  />
                )
              )}

              {isAddingContact && (
                <ContactEditRow
                  onSave={handleSaveContact}
                  onCancel={() => setIsAddingContact(false)}
                />
              )}
            </section>

            <div className="flex gap-2 pt-1">
              <Button type="button" onClick={() => void onSaveInfo()} disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save Info'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
            </div>
          </div>

          {/* Right col: open hours (self-contained, has own header + edit button) */}
          <OpenHoursSettings
            stationSettings={stationSettings}
            onUpdateSettings={onUpdateSettings}
          />
        </div>

      <Modal isOpen={!!deletingContact} onClose={() => setDeletingContact(null)} title="Remove Contact" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Remove this contact detail? This cannot be undone.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeletingContact(null)}>Cancel</Button>
            <Button type="button" variant="destructive" className="flex-1" disabled={isDeleting} onClick={handleDeleteContact}>
              {isDeleting ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
