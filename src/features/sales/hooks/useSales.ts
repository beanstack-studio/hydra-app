import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { restoreLinkedSupplies, deductLinkedSupplies } from '@/lib/supplySync'
import { deriveStatus } from '../types'
import type { Sale, SaleInsert, PaymentMode, CartItem, EditSaleUpdate } from '../types'

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
  updateSaleItems: (saleId: string, update: EditSaleUpdate) => Promise<void>
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
      // Cleaned search term — strip leading # so "#9C790D" → "9C790D"
      const q = search.length >= 3
        ? search.replace(/^#/, '').replace(/%/g, '').trim()
        : ''

      if (!q) {
        // No active search — load all sales with only the dropdown filters applied
        let baseQuery = supabase
          .from('sales')
          .select('*')
          .eq('station_id', stationId)
          .order('created_at', { ascending: false })
        if (filterStatus)    baseQuery = baseQuery.eq('status', filterStatus)
        if (filterOrderType) baseQuery = baseQuery.eq('order_type', filterOrderType)
        const { data: rows, error: e } = await baseQuery
        if (e) throw new Error(e.message)
        setData((rows ?? []) as Sale[])
        return
      }

      // ── Active search ────────────────────────────────────────────────────────

      // 1. Server-side text search across customer_name and product_name.
      //    These are TEXT columns so ILIKE works correctly.  Results come from
      //    ALL sales — not just the most-recently-loaded 1 000 rows.
      let textQuery = supabase
        .from('sales')
        .select('*')
        .eq('station_id', stationId)
        .or(`customer_name.ilike.%${q}%,product_name.ilike.%${q}%`)
        .order('created_at', { ascending: false })
      if (filterStatus)    textQuery = textQuery.eq('status', filterStatus)
      if (filterOrderType) textQuery = textQuery.eq('order_type', filterOrderType)
      const { data: textRows, error: textErr } = await textQuery
      if (textErr) throw new Error(textErr.message)

      const seen = new Set<string>((textRows ?? []).map((r) => r.id))
      const merged: Sale[] = (textRows ?? []) as Sale[]

      // 2. Order-number search — the displayed order # is the last 6 chars of
      //    the UUID (id.slice(-6) in the UI).  ILIKE on a uuid column cannot be
      //    expressed through the PostgREST JS client (::text in .or() breaks the
      //    logic-tree parser; ::text in .filter() gets URL-encoded by
      //    URLSearchParams).  Instead we call a SECURITY INVOKER Postgres
      //    function that does right(id::text, 6) ILIKE server-side, so the match
      //    works across ALL sales with no row-count cap.
      if (/^[0-9a-f]+$/i.test(q) && q.length <= 8) {
        const { data: rpcRows, error: rpcErr } = await supabase
          .rpc('search_sales_by_order_suffix', {
            p_station_id: stationId,
            p_suffix:     q,
          })
        if (rpcErr) throw new Error(rpcErr.message)

        // Apply the active dropdown filters client-side on the (small) RPC
        // result set so order-number search respects the same status / type
        // filters as the name search above.
        for (const row of (rpcRows ?? []) as Sale[]) {
          if (seen.has(row.id)) continue
          if (filterStatus    && row.status     !== filterStatus)    continue
          if (filterOrderType && row.order_type !== filterOrderType) continue
          merged.push(row)
        }
      }

      // Keep newest-first regardless of merge order
      merged.sort((a, b) => b.created_at.localeCompare(a.created_at))
      setData(merged)
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

  const updateSaleItems = useCallback(async (
    saleId: string, update: EditSaleUpdate
  ) => {
    const sale = data.find((s) => s.id === saleId)
    if (!sale) throw new Error('Sale not found')
    const { items, discount, saleDate, paymentMode, amountReceived, paidAt } = update
    const firstItem = items[0]
    if (!firstItem) throw new Error('At least one item is required')
    const containerTotal = sale.container_enabled ? sale.container_qty * sale.container_price : 0
    const itemsTotal = items.reduce((sum, i) => sum + i.qty * i.price, 0)
    const newTotal = Math.max(0, itemsTotal + containerTotal - discount)

    // Recalculate status from new total and amount paid.
    // balance_due is a DB computed column (total_amount - amount_received),
    // so it updates automatically; we only need to write status explicitly.
    const newBalanceDue = newTotal - amountReceived
    const newStatus = deriveStatus(newBalanceDue, newTotal)

    const { error: e } = await supabase
      .from('sales')
      .update({
        items,
        product_id: firstItem.product_id,
        product_name: firstItem.product_name,
        qty: firstItem.qty,
        price_per_piece: firstItem.price,
        product_total: firstItem.qty * firstItem.price,
        discount_amount: discount,
        total_amount: newTotal,
        sale_date: saleDate,
        payment_mode: paymentMode,
        amount_received: amountReceived,
        status: newStatus,
        ...(paidAt !== null ? { paid_at: paidAt } : {}),
      })
      .eq('id', saleId)
      .eq('station_id', stationId)
    if (e) throw new Error(e.message)

    // Sync inventory: compute per-item delta and restore/deduct only the difference.
    if (stationId) {
      const beforeItems = sale.items && sale.items.length > 0
        ? sale.items
        : [{ product_id: sale.product_id, qty: sale.qty }]

      const beforeMap = new Map<string, number>()
      for (const item of beforeItems) {
        if (item.product_id) beforeMap.set(item.product_id, item.qty)
      }
      const afterMap = new Map<string, number>()
      for (const item of items) {
        if (item.product_id) afterMap.set(item.product_id, item.qty)
      }

      const allIds = new Set([...beforeMap.keys(), ...afterMap.keys()])
      await Promise.all(
        [...allIds].map(async (productId) => {
          const before = beforeMap.get(productId) ?? 0
          const after = afterMap.get(productId) ?? 0
          const delta = after - before
          if (delta < 0) return restoreLinkedSupplies(stationId, productId, Math.abs(delta))
          if (delta > 0) return deductLinkedSupplies(stationId, productId, delta)
        })
      )
    }

    await fetchData()
  }, [data, fetchData, stationId])

  return { data, isLoading, error, addSale, deleteSale, recordPayment, rescheduleOrder, confirmFulfillment, updateSaleItems, refetch: fetchData }
}
