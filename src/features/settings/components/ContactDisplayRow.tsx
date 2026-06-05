import { Smartphone, Phone, MessageCircle, Mail, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/utils'
import type { ContactDetail, ContactType } from '../types'

const ICONS: Record<ContactType, typeof Smartphone> = {
  mobile: Smartphone,
  landline: Phone,
  messenger: MessageCircle,
  email: Mail,
}

const TYPE_LABELS: Record<ContactType, string> = {
  mobile: 'Mobile',
  landline: 'Landline',
  messenger: 'Messenger',
  email: 'Email',
}

interface ContactDisplayRowProps {
  contact: ContactDetail
  onEdit: () => void
  onDelete: () => void
}

export function ContactDisplayRow({ contact, onEdit, onDelete }: ContactDisplayRowProps) {
  const Icon = ICONS[contact.type]
  const isPhone = contact.type === 'mobile' || contact.type === 'landline'
  const displayed = isPhone ? formatPhone(contact.value) : contact.value

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{displayed}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {contact.label ? `${contact.label} · ` : ''}{TYPE_LABELS[contact.type]}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-3">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onEdit}
          aria-label="Edit contact"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label="Delete contact"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
