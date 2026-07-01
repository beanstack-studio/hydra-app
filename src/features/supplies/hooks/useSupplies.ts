import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Supply, SupplyInput, SupplyStatus, SupplyProductLink } from '../types'

function computeStatus(qty: number, threshold: number): SupplyStatus {
  if (qty <= 0) return 'out_of_stock'
  if (qty <= threshold) return 'low_stock'
  return 'in_stock'
}

interface RestockOpts {
  supplier?: string
  pricePerUnit?: number | null
  purchaseDate: string
  logAsExpense: boolean
}

interface UseSuppliesReturn {
  data: Supply[]
  isLoading: boolean
  error: string | null
  addSupply: (input: SupplyInput) => Promise<void>
  updateSupply: (id: string, input: Partial<SupplyInput>) => Promise<void>
  deleteSupply: (id: string) => Promise<void>
  adjustQty: (id: string, newQty: number) => Promise<void>
  deductForSale: (productId: string, qtySold: number) => Promise<void>
  restockSupply: (id: string, qtyAdded: number, opts: RestockOpts) => Promise<void>
}

export function useSupplies(): UseSuppliesReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<Supply[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const { data: rows, error: e } = await supabase
        .from('supplies')
        .select('*')
        .eq('station_id', stationId)
        .order('name')
      if (e) throw new Error(e.message)

      // Fetch product links separately — table may not exist yet (ignore errors)
      const { data: linksData } = await supabase
        .from('supply_product_links')
        .select('supply_id, product_id, units_per_sale')
        .eq('station_id', stationId)

      const linksMap = new Map<string, SupplyProductLink[]>()
      for (const link of (linksData ?? []) as { supply_id: string; product_id: string; units_per_sale: number }[]) {
        const existing = linksMap.get(link.supply_id) ?? []
        linksMap.set(link.supply_id, [...existing, { product_id: link.product_id, units_per_sale: link.units_per_sale }])
      }

      setData((rows ?? []).map((row) => ({
        ...row,
        supply_product_links: linksMap.get((row as { id: string }).id) ?? [],
      })) as Supply[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load supplies')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    void fetchData()
    if (!stationId) return
    const channel = supabase
      .channel(`supplies:${stationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplies', filter: `station_id=eq.${stationId}` }, () => { void fetchData() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchData, stationId])

  const saveProductLinks = useCallback(async (supplyId: string, links: SupplyProductLink[]) => {
    if (!stationId) return
    const validLinks = links.filter((l) => l.product_id)
    // Return early if nothing to save — avoids 403 from unconfigured RLS policy
    if (validLinks.length === 0) return

    // Delete existing links; filter by station_id to satisfy RLS policy
    const { error: deleteErr } = await supabase
      .from('supply_product_links')
      .delete()
      .eq('supply_id', supplyId)
      .eq('station_id', stationId)
    if (deleteErr) return

    const { error: insertErr } = await supabase.from('supply_product_links').insert(
      validLinks.map((l) => ({
        station_id: stationId,
        supply_id:  supplyId,
        product_id: l.product_id,
        units_per_sale: l.units_per_sale,
      }))
    )
    // Silently ignore RLS 42501 — single link via linked_product_id column still works
    if (insertErr && insertErr.code !== '42501') throw new Error(insertErr.message)
  }, [stationId])

  const addSupply = useCallback(async (input: SupplyInput) => {
    if (!stationId) return
    const { name, type, qty, price_per_unit, store, last_purchased_at, threshold, linked_product_id, units_per_sale } = input
    const { data: newRow, error: e } = await supabase.from('supplies').insert({
      station_id: stationId,
      name, type, qty, price_per_unit, store, last_purchased_at, threshold, linked_product_id, units_per_sale,
    }).select('id').single()
    if (e) throw new Error(e.message)
    if (newRow && input.product_links) {
      await saveProductLinks((newRow as { id: string }).id, input.product_links)
    }
    await fetchData()
  }, [stationId, fetchData, saveProductLinks])

  const updateSupply = useCallback(async (id: string, input: Partial<SupplyInput>) => {
    // Build only DB-safe fields (exclude product_links which is not a DB column)
    const dbFields: Record<string, unknown> = {}
    if (input.name              !== undefined) dbFields.name              = input.name
    if (input.threshold         !== undefined) dbFields.threshold         = input.threshold
    if (input.linked_product_id !== undefined) dbFields.linked_product_id = input.linked_product_id
    if (input.units_per_sale    !== undefined) dbFields.units_per_sale    = input.units_per_sale
    if (input.qty               !== undefined) dbFields.qty               = input.qty
    if (input.price_per_unit    !== undefined) dbFields.price_per_unit    = input.price_per_unit
    if (input.store             !== undefined) dbFields.store             = input.store
    if (input.last_purchased_at !== undefined) dbFields.last_purchased_at = input.last_purchased_at

    if (Object.keys(dbFields).length > 0) {
      const { error: e } = await supabase.from('supplies').update(dbFields).eq('id', id)
      if (e) throw new Error(e.message)
    }

    if (input.product_links !== undefined) {
      await saveProductLinks(id, input.product_links)
    }

    await fetchData()
  }, [fetchData, saveProductLinks])

  const deleteSupply = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('supplies').delete().eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  const adjustQty = useCallback(async (id: string, newQty: number) => {
    const { error: e } = await supabase
      .from('supplies')
      .update({ qty: Math.max(0, newQty) })
      .eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  const deductForSale = useCallback(async (productId: string, qtySold: number) => {
    if (!stationId) return
    const linked = data.filter((s) => s.linked_product_id === productId && s.qty > 0)
    if (linked.length === 0) return
    await Promise.all(
      linked.map((s) => {
        const deduct = qtySold * s.units_per_sale
        const newQty = Math.max(0, s.qty - deduct)
        return supabase.from('supplies').update({ qty: newQty }).eq('id', s.id)
      })
    )
    await fetchData()
  }, [stationId, data, fetchData])

  const restockSupply = useCallback(async (id: string, qtyAdded: number, opts: RestockOpts) => {
    if (!stationId) return
    const { supplier, pricePerUnit, purchaseDate, logAsExpense } = opts

    const supply = data.find((s) => s.id === id)
    const currentQty = supply?.qty ?? 0

    // 1. Update the supply row
    const updateFields: Record<string, unknown> = { qty: currentQty + qtyAdded, last_purchased_at: purchaseDate }
    if (supplier)       updateFields.store          = supplier
    if (pricePerUnit)   updateFields.price_per_unit = pricePerUnit

    const { error: supplyErr } = await supabase.from('supplies').update(updateFields).eq('id', id)
    if (supplyErr) throw new Error(supplyErr.message)

    // 2. Log to restock_history if supplier + price provided
    if (supplier && pricePerUnit) {
      const { error: histErr } = await supabase.from('restock_history').insert({
        station_id:     stationId,
        supply_id:      id,
        supplier,
        price_per_unit: pricePerUnit,
        qty_added:      qtyAdded,
        restocked_at:   purchaseDate,
      })
      if (histErr) throw new Error(histErr.message)
    }

    // 3. Optionally log as expense
    if (logAsExpense && pricePerUnit && supply) {
      const totalCost = pricePerUnit * qtyAdded
      const { error: expErr } = await supabase.from('expenses').insert({
        station_id:    stationId,
        category:      'supplies',
        item:          supply.name,
        price:         totalCost,
        amount:        totalCost,
        qty:           qtyAdded,
        price_per_unit: pricePerUnit,
        expense_date:  purchaseDate,
        frequency:     'one_off',
        supplier:      supplier ?? null,
        supply_id:     id,
        supply_name:   supply.name,
      })
      if (expErr) throw new Error(expErr.message)
    }

    await fetchData()
  }, [stationId, data, fetchData])

  return { data, isLoading, error, addSupply, updateSupply, deleteSupply, adjustQty, deductForSale, restockSupply }
}

export { computeStatus }
