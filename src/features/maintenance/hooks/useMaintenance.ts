import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { MaintenanceLog, MaintenanceLogInput } from '../types'

interface UseMaintenanceReturn {
  data: MaintenanceLog[]
  isLoading: boolean
  error: string | null
  addLog: (input: MaintenanceLogInput, photos?: File[]) => Promise<void>
  updateLog: (id: string, input: Partial<MaintenanceLogInput>, photos?: File[]) => Promise<void>
  deleteLog: (id: string) => Promise<void>
}

export function useMaintenance(): UseMaintenanceReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<MaintenanceLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const { data: rows, error: e } = await supabase
        .from('maintenance_logs')
        .select('*')
        .eq('station_id', stationId)
        .order('created_at', { ascending: false })
      if (e) {
        if (e.message.includes('does not exist') || e.message.includes('column')) {
          setError('Table schema needs updating — run the Hydra setup SQL in your Supabase project.')
        } else {
          throw new Error(e.message)
        }
        setData([])
        return
      }
      setData((rows ?? []) as MaintenanceLog[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load maintenance logs')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => { void fetchData() }, [fetchData])

  const uploadPhoto = useCallback(async (file: File): Promise<string> => {
    if (!stationId) throw new Error('No station')
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${stationId}/maintenance/${Date.now()}-${sanitized}`
    const { error: e } = await supabase.storage.from('receipts').upload(path, file)
    if (e) throw new Error(e.message)
    return path
  }, [stationId])

  const addLog = useCallback(async (input: MaintenanceLogInput, photos?: File[]) => {
    if (!stationId) return

    // Upload photos if provided
    let photoPathsString: string | null = null
    if (photos && photos.length > 0) {
      try {
        const paths = await Promise.all(photos.map((f) => uploadPhoto(f)))
        photoPathsString = paths.join(',')
      } catch {
        // silently continue if photo upload fails
      }
    }

    const { data: inserted, error: e } = await supabase
      .from('maintenance_logs')
      .insert({
        station_id: stationId,
        item_filter: input.equipment,
        qty: 1,
        total_price: input.cost ?? 0,
        maintenance_date: input.service_date,
        service_date: input.service_date,
        cost: input.cost,
        technician: input.technician,
        remarks: input.issue,
      })
      .select('id')
      .single()

    if (e) {
      if (e.message.includes('does not exist') || e.code === 'PGRST200' || e.code === 'PGRST201') {
        throw new Error('Maintenance table is not set up yet. Run the SQL migration in your Supabase project.')
      }
      throw new Error(e.message)
    }

    // Try to save photo paths (silent if column doesn't exist yet)
    if (photoPathsString && inserted?.id) {
      await supabase
        .from('maintenance_logs')
        .update({ photos_urls: photoPathsString })
        .eq('id', inserted.id)
      // no error check - column may not exist
    }

    // Create unpaid expense if cost > 0 (payment_method=null = unpaid)
    if (input.cost && input.cost > 0 && inserted?.id) {
      try {
        await supabase.from('expenses').insert({
          station_id: stationId,
          category: 'maintenance',
          item: input.equipment,
          price: input.cost,
          amount: input.cost,
          frequency: 'one_off',
          expense_date: input.service_date,
          payment_method: null,
          supplier: input.technician ?? null,
          remarks: input.issue,
        })
      } catch {
        // best-effort, don't throw
      }
    }

    await fetchData()
  }, [stationId, fetchData, uploadPhoto])

  const updateLog = useCallback(async (id: string, input: Partial<MaintenanceLogInput>, photos?: File[]) => {
    let photoPathsString: string | null | undefined = undefined

    if (photos && photos.length > 0) {
      try {
        const paths = await Promise.all(photos.map((f) => uploadPhoto(f)))
        photoPathsString = paths.join(',')
      } catch {
        // silently continue
      }
    }

    // Fetch old log before updating so we can find the linked expense
    const { data: oldLog } = await supabase
      .from('maintenance_logs')
      .select('item_filter, service_date, maintenance_date, cost')
      .eq('id', id)
      .single()

    const updateData: Record<string, unknown> = {
      item_filter: input.equipment,
      total_price: input.cost ?? 0,
      maintenance_date: input.service_date,
      service_date: input.service_date,
      cost: input.cost,
      technician: input.technician,
      remarks: input.issue,
    }
    if (photoPathsString !== undefined) updateData.photos_urls = photoPathsString

    const { error: e } = await supabase.from('maintenance_logs').update(updateData).eq('id', id)
    if (e) throw new Error(e.message)

    // Sync linked expense row
    if (oldLog && stationId) {
      const oldEquipment = oldLog.item_filter as string
      const oldDate = (oldLog.service_date ?? oldLog.maintenance_date) as string

      // Match on old item name — handle both legacy 'Maintenance: X' and current 'X' formats
      const { data: matchedExpense } = await supabase
        .from('expenses')
        .select('id')
        .eq('station_id', stationId)
        .eq('category', 'maintenance')
        .eq('expense_date', oldDate)
        .in('item', [oldEquipment, `Maintenance: ${oldEquipment}`])
        .limit(1)
        .maybeSingle()

      if (matchedExpense) {
        await supabase.from('expenses').update({
          item:         input.equipment   ?? oldEquipment,
          amount:       input.cost        ?? (oldLog.cost as number | null) ?? 0,
          price:        input.cost        ?? (oldLog.cost as number | null) ?? 0,
          expense_date: input.service_date ?? oldDate,
          supplier:     input.technician  ?? null,
          remarks:      input.issue       ?? null,
        }).eq('id', (matchedExpense as { id: string }).id)
      } else if (input.cost && input.cost > 0) {
        // No linked expense found — create one now
        await supabase.from('expenses').insert({
          station_id:     stationId,
          category:       'maintenance',
          item:           input.equipment ?? oldEquipment,
          price:          input.cost,
          amount:         input.cost,
          frequency:      'one_off',
          expense_date:   input.service_date ?? oldDate,
          payment_method: null,
          supplier:       input.technician ?? null,
          remarks:        input.issue      ?? null,
        })
      }
    }

    await fetchData()
  }, [fetchData, uploadPhoto, stationId])

  const deleteLog = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('maintenance_logs').delete().eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  return { data, isLoading, error, addLog, updateLog, deleteLog }
}
