import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Sale, SaleInsert, PaymentMode } from '../types'

async function restoreLinkedSupplies(stationId: string, productId: string, qtySold: number) {
  const { data: junctionLinks } = await supabase
    .from('supply_product_links')
    .select('supply_id, units_per_sale')
    .eq('station_id', stationId)
    .eq('product_id', productId)

  const handledIds = new Set((junctionLinks ?? []).map((l: { supply_id: string }) => l.supply_id))

  const { data: directLinked } = await supabase
    .from('supplies')
    .select('id, qty, units_per_sale')
    .eq('station_id', stationId)
    .eq('linked_product_id', productId)

  const toRestore: { supply_id: string; units_per_sale: number }[] = [
    ...(junctionLinks ?? []).map((l: { supply_id: string; units_per_sale: number }) => ({ supply_id: l.supply_id, units_per_sale: l.units_per_sale })),
    ...(directLinked ?? [])
      .filter((s: { id: string }) => !handledIds.has(s.id))
      .map((s: { id: string; units_per_sale: number }) => ({ supply_id: s.id, units_per_sale: s.units_per_sale })),
  ]

  if (toRestore.length === 0) return

  const supplyIds = toRestore.map((l) => l.supply_id)
  const { data: currentQtys } = await supabase
    .from('supplies')
    .select('id, qty')
    .in('id', supplyIds)

  const qtyMap = new Map((currentQtys ?? []).map((s: { id: string; qty: number }) => [s.id, s.qty]))

  await Promise.all(
    toRestore.map((l) => {
      const currentQty = qtyMap.get(l.supply_id) ?? 0
      const newQty = currentQty + qtySold * l.units_per_sale
      return supabase.from('supplies').update({ qty: newQty }).eq('id', l.supply_id)
    })
  )
}

async function deductLinkedSupplies(stationId: string, productId: string, qtySold: number) {
  // Check supply_product_links junction table first (multi-link, post-migration)
  const { data: junctionLinks } = await supabase
    .from('supply_product_links')
    .select('supply_id, units_per_sale')
    .eq('station_id', stationId)
    .eq('product_id', productId)

  const handledIds = new Set((junctionLinks ?? []).map((l: { supply_id: string }) => l.supply_id))

  // Also check direct linked_product_id (backward compat, skip already handled)
  const { data: directLinked } = await supabase
    .from('supplies')
    .select('id, qty, units_per_sale')
    .eq('station_id', stationId)
    .eq('linked_product_id', productId)

  const toDeduct: { supply_id: string; units_per_sale: number }[] = [
    ...(junctionLinks ?? []).map((l: { supply_id: string; units_per_sale: number }) => ({ supply_id: l.supply_id, units_per_sale: l.units_per_sale })),
    ...(directLinked ?? [])
      .filter((s: { id: string }) => !handledIds.has(s.id))
      .map((s: { id: string; units_per_sale: number }) => ({ supply_id: s.id, units_per_sale: s.units_per_sale })),
  ]

  if (toDeduct.length === 0) return

  const supplyIds = toDeduct.map((l) => l.supply_id)
  const { data: currentQtys } = await supabase
    .from('supplies')
    .select('id, qty')
    .in('id', supplyIds)

  const qtyMap = new Map((currentQtys ?? []).map((s: { id: string; qty: number }) => [s.id, s.qty]))

  await Promise.all(
    toDeduct.map((l) => {
      const currentQty = qtyMap.get(l.supply_id) ?? 0
      const newQty = Math.max(0, currentQty - qtySold * l.units_per_sale)
      return supabase.from('supplies').update({ qty: newQty }).eq('id', l.supply_id)
    })
  )
}

interface UseSalesOptions {
  search?: string
  filterValues?: Record<string, string>
}

interface UseSalesReturn {
  data: Sale[]
  isLoading: boolean
  error: string | null
  addSale: (input: SaleInsert) => Promise<Sale>
  deleteSale: (saleId: string) => Promise<void>
  recordPayment: (saleId: string, amount: number, paymentMode: PaymentMode, paidAt: string, remarks: string) => Promise<void>
  rescheduleOrder: (saleId: string, scheduledAt: string) => Promise<void>
  confirmFulfillment: (saleId: string) => Promise<void>
  refetch: () => Promise<void>
}

export function useSales(options?: UseSalesOptions): UseSalesReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<Sale[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Extract primitives so useCallback deps are stable across re-renders
  const search = options?.search ?? ''
  const filterStatus = options?.filterValues?.status ?? ''
  const filterOrderType = options?.filterValues?.order_type ?? ''

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      let query = supabase
        .from('sales')
        .select('*')
        .eq('station_id', stationId)
        .order('created_at', { ascending: false })

      // Server-side status and order_type filters
      if (filterStatus)    query = query.eq('status', filterStatus)
      if (filterOrderType) query = query.eq('order_type', filterOrderType)

      // Server-side search: queries ALL sales, not just the first 1000 loaded.
      // Strips leading # so "#ABC123" correctly matches UUID suffix "abc123".
      if (search.length >= 3) {
        const q = search.replace(/^#/, '').replace(/%/g, '')
        query = query.or(
          `customer_name.ilike.%${q}%,product_name.ilike.%${q}%,id.ilike.%${q}%`
        )
      }

      const { data: rows, error: e } = await query
      if (e) throw new Error(e.message)
      setData((rows ?? []) as Sale[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales')
    } finally {
      setIsLoading(false)
    }
  }, [stationId, search, filterStatus, filterOrderType])

  useEffect(() => {
    void fetchData()
    if (!stationId) return
    const channel = supabase
      .channel(`sales:${stationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `station_id=eq.${stationId}` }, () => { void fetchData() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchData, stationId])

  const addSale = useCallback(async (input: SaleInsert): Promise<Sale> => {
    const insertData = {
      ...input,
      // Stamp paid_at when the sale is recorded as fully settled at creation
      ...(input.status === 'paid' ? { paid_at: new Date().toISOString() } : {}),
    }
    const { data: row, error: e } = await supabase
      .from('sales')
      .insert(insertData)
      .select()
      .single()
    if (e) throw new Error(e.message)
    // Record initial payment in sale_payments so reports see it on the sale date
    if (stationId && input.amount_received > 0 && input.payment_mode !== 'utang') {
      await supabase.from('sale_payments').insert({
        station_id: stationId,
        sale_id: (row as Sale).id,
        amount: input.amount_received,
        payment_mode: input.payment_mode,
        paid_at: input.sale_date,
        remarks: null,
      })
    }
    if (stationId) {
      const itemsToDeduct = input.items && input.items.length > 0
        ? input.items
        : [{ product_id: input.product_id, qty: input.qty }]
      itemsToDeduct.forEach(({ product_id, qty }) => {
        if (product_id) void deductLinkedSupplies(stationId, product_id, qty)
      })
    }
    await fetchData()
    return row as Sale
  }, [fetchData, stationId])

  const recordPayment = useCallback(async (
    saleId: string, amount: number, paymentMode: PaymentMode, paidAt: string, remarks: string
  ) => {
    const sale = data.find((s) => s.id === saleId)
    if (!sale) throw new Error('Sale not found')

    const newAmountReceived = (sale.amount_received ?? 0) + amount
    const newBalance = sale.total_amount - newAmountReceived
    const newStatus = newBalance <= 0 ? 'paid' : 'partial'

    const { error: updateErr } = await supabase
      .from('sales')
      .update({
        amount_received: newAmountReceived,
        status: newStatus,
        payment_mode: paymentMode,
        // Stamp paid_at on first full settlement only
        ...(newStatus === 'paid' && !sale.paid_at ? { paid_at: paidAt } : {}),
      })
      .eq('id', saleId)
    if (updateErr) throw new Error(updateErr.message)

    const { error: paymentErr } = await supabase
      .from('sale_payments')
      .insert({ station_id: stationId, sale_id: saleId, amount, payment_mode: paymentMode, paid_at: paidAt, remarks: remarks || null })
    if (paymentErr) throw new Error(paymentErr.message)

    await fetchData()
  }, [data, stationId, fetchData])

  const rescheduleOrder = useCallback(async (saleId: string, scheduledAt: string) => {
    const { error: e } = await supabase
      .from('sales')
      .update({ scheduled_at: scheduledAt })
      .eq('id', saleId)
      .eq('station_id', stationId)
    if (e) throw new Error(e.message)
    const reminderAt = new Date(new Date(scheduledAt).getTime() - 15 * 60 * 1000).toISOString()
    await supabase
      .from('reminders')
      .update({ scheduled_at: reminderAt, is_dismissed: false })
      .eq('sale_id', saleId)
      .eq('station_id', stationId)
    await fetchData()
  }, [fetchData, stationId])

  const deleteSale = useCallback(async (saleId: string) => {
    // Restore supplies deducted when the sale was originally recorded
    const sale = data.find((s) => s.id === saleId)
    if (sale && stationId) {
      const itemsToRestore = sale.items && sale.items.length > 0
        ? sale.items
        : [{ product_id: sale.product_id, qty: sale.qty }]
      await Promise.all(
        itemsToRestore
          .filter((i) => !!i.product_id)
          .map((i) => restoreLinkedSupplies(stationId, i.product_id, i.qty))
      )
    }
    // Delete related records first to avoid FK constraint errors
    await supabase.from('reminders').delete().eq('sale_id', saleId)
    await supabase.from('sale_payments').delete().eq('sale_id', saleId)
    const { error: e } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId)
      .eq('station_id', stationId)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData, stationId, data])

  const confirmFulfillment = useCallback(async (saleId: string) => {
    const { error: e } = await supabase
      .from('sales')
      .update({ fulfilled_at: new Date().toISOString() })
      .eq('id', saleId)
    if (e) throw new Error(e.message)
    // Dismiss any open reminders for this sale
    await supabase.from('reminders').update({ is_dismissed: true }).eq('sale_id', saleId)
    await fetchData()
  }, [fetchData])

  return { data, isLoading, error, addSale, deleteSale, recordPayment, rescheduleOrder, confirmFulfillment, refetch: fetchData }
}
