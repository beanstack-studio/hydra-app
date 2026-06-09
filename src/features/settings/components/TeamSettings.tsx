import { useState } from 'react'
import { Pencil, Trash2, UserPlus, Users, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/shared/Modal'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { StaffProfileModal } from './StaffProfileModal'
import { useTeamSettings } from '../hooks/useTeamSettings'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/hooks/use-toast'
import { usePlan } from '@/hooks/usePlan'
import { UpgradeWall } from '@/components/shared/UpgradeWall'
import { formatCurrency, cn } from '@/lib/utils'
import type { StaffMember, MemberInput } from '../hooks/useTeamSettings'

type SortKey = 'name' | 'pay_rate'
type SortDir = 'asc' | 'desc'

export function TeamSettings() {
  const plan = usePlan()
  const { toast } = useToast()
  const currentRole = useAuthStore((s) => s.role)
  const isOwner = currentRole === 'owner'

  const { staff, isLoading, addMember, editMember, removeMember, sendInvite } = useTeamSettings()

  const [profileOpen,   setProfileOpen]   = useState(false)
  const [editingStaff,  setEditingStaff]  = useState<StaffMember | null>(null)
  const [removingStaff, setRemovingStaff] = useState<StaffMember | null>(null)
  const [isRemoving,    setIsRemoving]    = useState(false)
  const [sortKey,       setSortKey]       = useState<SortKey>('name')
  const [sortDir,       setSortDir]       = useState<SortDir>('asc')

  if (plan === 'free') return <UpgradeWall title="Team Members" feature="Team Members" showTitle={false} />

  const openAdd  = () => { setEditingStaff(null); setProfileOpen(true) }
  const openEdit = (s: StaffMember) => { setEditingStaff(s); setProfileOpen(true) }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...staff].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'name') cmp = a.full_name.localeCompare(b.full_name)
    if (sortKey === 'pay_rate') cmp = (a.pay_rate ?? 0) - (b.pay_rate ?? 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  const thCls = (key: SortKey) => cn(
    'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap select-none transition-colors duration-150',
    'cursor-pointer hover:text-foreground'
  )

  const handleSave = async (input: MemberInput) => {
    if (editingStaff) {
      await editMember(editingStaff.id, input)
    } else {
      await addMember(input)
    }
  }

  const handleRemove = async () => {
    if (!removingStaff) return
    setIsRemoving(true)
    try {
      await removeMember(removingStaff.id)
      toast({ title: 'Member removed' })
      setRemovingStaff(null)
    } catch (e) {
      toast({
        title: 'Remove failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setIsRemoving(false)
    }
  }

  if (isLoading) return <LoadingSkeleton rows={4} />

  return (
    <div className="w-full space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end">
        {isOwner && (
          <Button size="sm" onClick={openAdd}>
            <UserPlus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {staff.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No team members yet"
          description="Add your employees to start tracking payroll."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className={thCls('name')} onClick={() => handleSort('name')}>
                  <span className="inline-flex items-center gap-1">Name {sortIcon('name')}</span>
                </th>
                <th className={thCls('pay_rate')} onClick={() => handleSort('pay_rate')}>
                  <span className="inline-flex items-center gap-1">Pay Rate {sortIcon('pay_rate')}</span>
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{s.full_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {s.pay_rate != null ? `${formatCurrency(s.pay_rate)} / day` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isOwner && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => openEdit(s)}
                          aria-label={`Edit ${s.full_name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setRemovingStaff(s)}
                          aria-label={`Remove ${s.full_name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <StaffProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        staff={editingStaff}
        onSave={handleSave}
        onSendInvite={sendInvite}
      />

      <Modal isOpen={!!removingStaff} onClose={() => setRemovingStaff(null)} title="Remove Team Member" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Remove{' '}
            <span className="font-semibold text-foreground">{removingStaff?.full_name}</span>{' '}
            from the roster? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setRemovingStaff(null)}>
              Cancel
            </Button>
            <Button
              type="button" variant="destructive" className="flex-1"
              disabled={isRemoving}
              onClick={() => void handleRemove()}
            >
              {isRemoving ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
