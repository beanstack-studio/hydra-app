import { useState } from 'react'
import { Plus, Pencil, Trash2, Wrench, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/shared/Modal'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { MaintenanceModal } from './MaintenanceModal'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useMaintenance } from '../hooks/useMaintenance'
import { useAuthStore } from '@/stores/authStore'
import type { MaintenanceLog } from '../types'

type MaintenanceSortKey = 'equipment' | 'date' | 'cost'
type SortDir = 'asc' | 'desc'

export function MaintenanceTable() {
  const { toast } = useToast()
  const isOwner = useAuthStore((s) => s.role) === 'owner'
  const { data, isLoading, error, addLog, updateLog, deleteLog } = useMaintenance()

  const [editingLog, setEditingLog] = useState<MaintenanceLog | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deletingLog, setDeletingLog] = useState<MaintenanceLog | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [sortKey, setSortKey] = useState<MaintenanceSortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: MaintenanceSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...data].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'equipment') cmp = a.item_filter.localeCompare(b.item_filter)
    if (sortKey === 'date') {
      const da = a.service_date ?? a.maintenance_date
      const db = b.service_date ?? b.maintenance_date
      cmp = da.localeCompare(db)
    }
    if (sortKey === 'cost') {
      if (a.cost === null && b.cost === null) cmp = 0
      else if (a.cost === null) return 1
      else if (b.cost === null) return -1
      else cmp = a.cost - b.cost
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const sortIcon = (key: MaintenanceSortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  const thCls = (key: MaintenanceSortKey) => cn(
    'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors duration-150'
  )

  const handleDelete = async () => {
    if (!deletingLog) return
    setIsDeleting(true)
    try {
      await deleteLog(deletingLog.id)
      toast({ title: 'Log deleted' })
      setDeletingLog(null)
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) return <LoadingSkeleton rows={3} />

  return (
    <div className="w-full space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!!error}
          onClick={() => { setEditingLog(null); setIsFormOpen(true) }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Log Maintenance
        </Button>
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-8 w-8" />}
          title="No maintenance logs"
          description="Record equipment repairs and servicing here."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className={thCls('equipment')} onClick={() => handleSort('equipment')}>
                  <span className="inline-flex items-center gap-1">Equipment {sortIcon('equipment')}</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Issue / Work Done
                </th>
                <th className={thCls('date')} onClick={() => handleSort('date')}>
                  <span className="inline-flex items-center gap-1">Date {sortIcon('date')}</span>
                </th>
                <th className={thCls('cost')} onClick={() => handleSort('cost')}>
                  <span className="inline-flex items-center gap-1">Cost {sortIcon('cost')}</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Technician
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{log.item_filter}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-muted-foreground max-w-xs truncate">{log.remarks ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-muted-foreground">{formatDate(log.service_date ?? log.maintenance_date)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium">
                      {log.cost !== null ? formatCurrency(log.cost) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">{log.technician ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon" variant="ghost" className="h-8 w-8"
                        onClick={() => { setEditingLog(log); setIsFormOpen(true) }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isOwner && (
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingLog(log)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MaintenanceModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingLog(null) }}
        log={editingLog}
        onAdd={addLog}
        onUpdate={updateLog}
      />

      <Modal isOpen={!!deletingLog} onClose={() => setDeletingLog(null)} title="Delete Log" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Delete log for{' '}
            <span className="font-semibold text-foreground">{deletingLog?.item_filter}</span>?
            This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeletingLog(null)}>Cancel</Button>
            <Button type="button" variant="destructive" className="flex-1" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
