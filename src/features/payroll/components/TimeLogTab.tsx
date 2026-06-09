import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Clock } from 'lucide-react'
import { formatInTimeZone } from 'date-fns-tz'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/hooks/use-toast'
import { TimeLogModal } from './TimeLogModal'
import { formatDate, PH_TZ } from '@/lib/utils'
import type { StaffMember } from '@/features/settings/hooks/useTeamSettings'
import type { TimeLog, TimeLogInput } from '../types'

interface TimeLogTabProps {
  staff: StaffMember[]
  timeLogs: TimeLog[]
  onAdd: (input: TimeLogInput) => Promise<void>
  onUpdate: (id: string, input: Partial<TimeLogInput>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function TimeLogTab({ staff, timeLogs, onAdd, onUpdate, onDelete }: TimeLogTabProps) {
  const { toast } = useToast()
  const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')

  const [isModalOpen,   setIsModalOpen]   = useState(false)
  const [editingLog,    setEditingLog]    = useState<TimeLog | null>(null)
  const [deletingLog,   setDeletingLog]   = useState<TimeLog | null>(null)
  const [isDeleting,    setIsDeleting]    = useState(false)
  const [filterStaff,   setFilterStaff]   = useState<string>('all')
  const [filterFrom,    setFilterFrom]    = useState(todayPH.slice(0, 8) + '01') // first of current month
  const [filterTo,      setFilterTo]      = useState(todayPH)
  const [sortKey,       setSortKey]       = useState<'date' | 'staff' | 'hours'>('date')
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: string) => {
    const k = key as 'date' | 'staff' | 'hours'
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const staffById = useMemo(
    () => Object.fromEntries(staff.map((s) => [s.id, s.full_name])),
    [staff]
  )

  const filtered = useMemo(() => {
    const f = timeLogs.filter((l) => {
      if (filterStaff !== 'all' && l.staff_id !== filterStaff) return false
      if (l.log_date < filterFrom || l.log_date > filterTo) return false
      return true
    })
    return [...f].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') cmp = a.log_date.localeCompare(b.log_date)
      if (sortKey === 'staff') cmp = (staffById[a.staff_id] ?? '').localeCompare(staffById[b.staff_id] ?? '')
      if (sortKey === 'hours') cmp = (a.hours_worked ?? 0) - (b.hours_worked ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [timeLogs, filterStaff, filterFrom, filterTo, sortKey, sortDir, staffById])

  const openAdd = () => { setEditingLog(null); setIsModalOpen(true) }
  const openEdit = (log: TimeLog) => { setEditingLog(log); setIsModalOpen(true) }

  const handleDelete = async () => {
    if (!deletingLog) return
    setIsDeleting(true)
    try {
      await onDelete(deletingLog.id)
      toast({ title: 'Log deleted' })
      setDeletingLog(null)
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const selectCls = 'rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus-visible:outline-none'

  const columns = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (l: TimeLog) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(l.log_date + 'T00:00:00')}</span>
      ),
    },
    {
      key: 'staff',
      header: 'Staff',
      sortable: true,
      render: (l: TimeLog) => (
        <span className="text-sm font-medium">{staffById[l.staff_id] ?? '—'}</span>
      ),
    },
    {
      key: 'times',
      header: 'Clock In / Out',
      render: (l: TimeLog) => (
        <span className="text-sm text-muted-foreground">
          {l.clock_in} → {l.clock_out ?? '—'}
        </span>
      ),
    },
    {
      key: 'hours',
      header: 'Hours',
      sortable: true,
      render: (l: TimeLog) => (
        <span className="text-sm font-semibold">
          {l.hours_worked !== null ? `${l.hours_worked.toFixed(2)} hrs` : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (l: TimeLog) => (
        <div className="flex items-center gap-1 justify-end">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(ev) => { ev.stopPropagation(); openEdit(l) }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(ev) => { ev.stopPropagation(); setDeletingLog(l) }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="space-y-4">
        {/* Filters + Add */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className={selectCls}>
            <option value="all">All staff</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
            className={selectCls} />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
            className={selectCls} />
          <Button size="sm" onClick={openAdd} className="ml-auto">
            <Plus className="h-4 w-4 mr-1" />
            Add Log
          </Button>
        </div>

        <DataTable
          tableId="timelog"
          columns={columns}
          data={filtered}
          rowKey={(l) => l.id}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          emptyState={
            <EmptyState
              icon={<Clock className="h-8 w-8" />}
              title="No time logs"
              description="Add a log entry to track staff attendance."
            />
          }
        />
      </div>

      <TimeLogModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingLog(null) }}
        log={editingLog}
        staff={staff}
        onAdd={onAdd}
        onUpdate={onUpdate}
      />

      <Modal isOpen={!!deletingLog} onClose={() => setDeletingLog(null)} title="Delete Log" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Delete this time log entry? This cannot be undone.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeletingLog(null)}>Cancel</Button>
            <Button type="button" variant="destructive" className="flex-1" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
