import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Expense, ExpenseInput, ExpensePaymentMethod } from '../types'

const CATEGORY_ITEM_LABELS: Record<string, string> = {
  labor:       'Labor',
  gasoline:    'Gasoline',
  supplies:    'Supplies',
  maintenance: 'Maintenance',
  other:       'Other',
}

interface UseExpensesReturn {
  data: Expense[]
  isLoading: boolean
  error: string | null
  addExpense: (input: ExpenseInput, file?: File) => Promise<void>
  updateExpense: (id: string, input: Partial<ExpenseInput>, file?: File) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
  markExpensePaid: (id: string, paymentMethod: ExpensePaymentMethod) => Promise<void>
  getReceiptUrl: (path: string) => Promise<string>
}

/**
 * After any supplies expense is created, edited, or deleted, re-derive
 * supplies.store and supplies.last_purchased_at from the current expenses
 * table so denormalized fields never go stale.
 *
 * Matching logic mirrors useSupplyPurchaseHistory: expense.item ILIKE
 * '%supplyName%' so renamed supplies still find their older records.
 */
async function recomputeSupplyFromExpenses(
  stationId: string,
  itemName: string,
): Promise<void> {
  const trimmed = itemName.trim()
  if (!trimmed || trimmed.toLowerCase() === 'supplies') return

  // 1. Find the supply whose name matches the expense item label
  const { data: supplyRows, error: supplyErr } = await supabase
    .from('supplies')
    .select('id, name')
    .eq('station_id', stationId)
    .ilike('name', trimmed)
    .limit(1)

  if (supplyErr) {
    console.error('[recomputeSupply] supply lookup failed:', supplyErr.message, { itemName: trimmed })
    return
  }

  const supply = (supplyRows ?? [])[0] as { id: string; name: string } | undefined
  if (!supply) {
    console.warn('[recomputeSupply] no supply matched item:', trimmed)
    return
  }

  // 2. Find the most-recent remaining expense that matches this supply name.
  //    Use %name% wildcard so renamed supplies still link to older expense rows.
  const { data: nextRows, error: nextErr } = await supabase
    .from('expenses')
    .select('supplier, expense_date')
    .eq('station_id', stationId)
    .eq('category', 'supplies')
    .ilike('item', `%${supply.name.trim()}%`)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (nextErr) {
    console.error('[recomputeSupply] expense lookup failed:', nextErr.message, { supplyName: supply.name })
    return
  }

  const next = (nextRows ?? [])[0] as { supplier: string | null; expense_date: string } | undefined

  // 3. Write the freshly derived values back — null/null when no expense remains
  const { error: updateErr } = await supabase
    .from('supplies')
    .update({
      store:             next?.supplier         ?? null,
      last_purchased_at: next?.expense_date     ?? null,
    })
    .eq('id', supply.id)
    .eq('station_id', stationId)

  if (updateErr) {
    console.error('[recomputeSupply] supply update failed:', updateErr.message, { supplyId: supply.id })
  }
}

export function useExpenses(): UseExpensesReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const { data: rows, error: e } = await supabase
        .from('expenses')
        .select('*')
        .eq('station_id', stationId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (e) throw new Error(e.message)
      setData((rows ?? []) as Expense[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    void fetchData()
    if (!stationId) return
    const channel = supabase
      .channel(`expenses:${stationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `station_id=eq.${stationId}` }, () => { void fetchData() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchData, stationId])

  const uploadReceipt = useCallback(async (file: File): Promise<string> => {
    if (!stationId) throw new Error('No station')
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${stationId}/${Date.now()}-${sanitized}`
    const { error: e } = await supabase.storage.from('receipts').upload(path, file)
    if (e) throw new Error(e.message)
    return path
  }, [stationId])

  const addExpense = useCallback(async (input: ExpenseInput, file?: File) => {
    if (!stationId) return
    let receipt_url: string | null = input.receipt_url ?? null
    if (file) receipt_url = await uploadReceipt(file)

    let itemLabel = CATEGORY_ITEM_LABELS[input.category] ?? input.category
    const supplyQty = input.supply_qty ?? 0

    // Handle supply stock update/creation
    if (input.category === 'supplies' && supplyQty > 0) {
      const pricePerUnit = input.amount / supplyQty

      if (input.new_supply_name) {
        // Create new supply item and link it
        await supabase.from('supplies').insert({
          station_id: stationId,
          name: input.new_supply_name,
          type: 'supply',
          qty: supplyQty,
          price_per_unit: pricePerUnit,
          store: input.supply_store ?? null,
          last_purchased_at: input.expense_date,
          threshold: 0,
          units_per_sale: 1,
          linked_product_id: null,
        }).select('id').single()
        itemLabel = input.new_supply_name
      } else if (input.supply_id) {
        // Update existing supply — add qty, recalculate price, update store + date
        const { data: existing } = await supabase
          .from('supplies').select('qty').eq('id', input.supply_id).single()
        if (existing) {
          await supabase.from('supplies').update({
            qty: (existing as { qty: number }).qty + supplyQty,
            price_per_unit: pricePerUnit,
            last_purchased_at: input.expense_date,
            ...(input.supply_store ? { store: input.supply_store } : {}),
          }).eq('id', input.supply_id)
        }
        itemLabel = input.supply_name ?? itemLabel
      }
    }

    const storedQty = (input.category === 'supplies' || input.category === 'gasoline') && supplyQty > 0
      ? supplyQty : null

    const { error: e } = await supabase.from('expenses').insert({
      station_id: stationId,
      category: input.category,
      item: itemLabel,
      price: input.amount,
      amount: input.amount,
      qty: storedQty,
      frequency: 'one_off',
      expense_date: input.expense_date,
      payment_method: input.payment_method ?? null,
      remarks: input.remarks ?? null,
      receipt_url,
      // inventory_item_id FK points to legacy 'inventory' table — use null until migration fixes it
      inventory_item_id: null,
      supplier: input.supply_store ?? null,
    })
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData, uploadReceipt])

  const updateExpense = useCallback(async (id: string, input: Partial<ExpenseInput>, file?: File) => {
    const existing = data.find((e) => e.id === id)
    let receipt_url: string | null | undefined = input.receipt_url

    if (file) {
      const newPath = await uploadReceipt(file)
      if (existing?.receipt_url) {
        await supabase.storage.from('receipts').remove([existing.receipt_url])
      }
      receipt_url = newPath
    } else if (input.receipt_url === null && existing?.receipt_url) {
      await supabase.storage.from('receipts').remove([existing.receipt_url])
      receipt_url = null
    }

    const resolvedCategory = input.category ?? existing?.category
    let itemLabel: string | undefined = undefined
    if (resolvedCategory && resolvedCategory !== 'supplies') {
      itemLabel = CATEGORY_ITEM_LABELS[resolvedCategory] ?? resolvedCategory
    } else if (input.supply_name) {
      itemLabel = input.supply_name
    } else if (input.new_supply_name) {
      itemLabel = input.new_supply_name
    }

    const updatedQty = (input.supply_qty != null && input.supply_qty > 0)
      && (resolvedCategory === 'supplies' || resolvedCategory === 'gasoline')
      ? input.supply_qty : null

    const { error: e } = await supabase
      .from('expenses')
      .update({
        category: input.category,
        ...(itemLabel !== undefined ? { item: itemLabel } : {}),
        price: input.amount,
        amount: input.amount,
        ...(updatedQty !== null ? { qty: updatedQty } : {}),
        expense_date: input.expense_date,
        payment_method: input.payment_method ?? null,
        remarks: input.remarks ?? null,
        receipt_url,
        ...(input.supply_store !== undefined ? { supplier: input.supply_store || null } : {}),
      })
      .eq('id', id)
    if (e) throw new Error(e.message)

    // Recompute supply's store + last_purchased_at whenever a supplies expense is
    // edited (date, supplier, or item name may have changed).
    if (resolvedCategory === 'supplies' && stationId) {
      const oldItemName = existing?.item
      const newItemName = itemLabel ?? oldItemName

      // If the item name changed, recompute for the OLD supply first so it
      // no longer incorrectly shows this expense's supplier/date.
      if (oldItemName && newItemName && oldItemName !== newItemName) {
        await recomputeSupplyFromExpenses(stationId, oldItemName)
      }
      // Always recompute for the current supply name.
      if (newItemName) {
        await recomputeSupplyFromExpenses(stationId, newItemName)
      }
    }

    await fetchData()
  }, [fetchData, uploadReceipt, data, stationId])

  const deleteExpense = useCallback(async (id: string) => {
    const existing = data.find((e) => e.id === id)
    if (existing?.receipt_url) {
      await supabase.storage.from('receipts').remove([existing.receipt_url])
    }
    const { error: e } = await supabase.from('expenses').delete().eq('id', id)
    if (e) throw new Error(e.message)

    // Recompute the linked supply's store + last_purchased_at from the next
    // most-recent matching expense now that this row is gone.
    if (existing?.category === 'supplies' && stationId) {
      await recomputeSupplyFromExpenses(stationId, existing.item)
    }

    await fetchData()
  }, [fetchData, data, stationId])

  const markExpensePaid = useCallback(async (id: string, paymentMethod: ExpensePaymentMethod) => {
    const { error: e } = await supabase.from('expenses').update({ payment_method: paymentMethod }).eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  const getReceiptUrl = useCallback(async (path: string): Promise<string> => {
    const { data: signed, error: e } = await supabase.storage
      .from('receipts')
      .createSignedUrl(path, 3600) // 1-hour expiry
    if (e) throw new Error(e.message)
    return signed.signedUrl
  }, [])

  return { data, isLoading, error, addExpense, updateExpense, deleteExpense, markExpensePaid, getReceiptUrl }
}
