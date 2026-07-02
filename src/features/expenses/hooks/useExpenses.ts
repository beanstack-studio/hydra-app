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
 *
 * Throws on any DB failure so callers can catch and surface the error
 * rather than silently leaving the supply in a stale state.
 *
 * IMPORTANT: The supply UPDATE uses .select() instead of the default
 * return=minimal mode. PostgREST returns HTTP 204 with {data:null,
 * error:null} even when 0 rows match — checking error alone cannot
 * detect a silent station_id mismatch or deleted row. .select() gives
 * us back the written rows so we can verify the write actually landed.
 */
async function recomputeSupplyFromExpenses(
  stationId: string,
  itemName: string,
): Promise<void> {
  const trimmed = itemName.trim()
  if (!trimmed || trimmed.toLowerCase() === 'supplies') return

  console.log('[recomputeSupply] ▶ start', { station: stationId.slice(-8), item: trimmed })

  // 1. Find the supply whose name matches the expense item label
  const { data: supplyRows, error: supplyErr } = await supabase
    .from('supplies')
    .select('id, name')
    .eq('station_id', stationId)
    .ilike('name', trimmed)
    .limit(1)

  if (supplyErr) {
    console.error('[recomputeSupply] ✗ supply lookup failed:', supplyErr.message, { itemName: trimmed })
    throw new Error(`[recomputeSupply] supply lookup: ${supplyErr.message}`)
  }

  const supply = (supplyRows ?? [])[0] as { id: string; name: string } | undefined
  if (!supply) {
    // No matching supply row — this item may not have an inventory entry yet.
    console.warn('[recomputeSupply] ✗ no supply matched item:', trimmed, { station: stationId.slice(-8) })
    return
  }

  console.log('[recomputeSupply] ✔ supply found', { id: supply.id.slice(-8), name: supply.name })

  // 2. Find the most-recent remaining expense that matches this supply name.
  //    Use %name% wildcard so renamed supplies still find their older records.
  const { data: nextRows, error: nextErr } = await supabase
    .from('expenses')
    .select('id, supplier, expense_date')
    .eq('station_id', stationId)
    .eq('category', 'supplies')
    .ilike('item', `%${supply.name.trim()}%`)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (nextErr) {
    console.error('[recomputeSupply] ✗ expense lookup failed:', nextErr.message, { supplyName: supply.name })
    throw new Error(`[recomputeSupply] expense lookup: ${nextErr.message}`)
  }

  const next = (nextRows ?? [])[0] as
    | { id: string; supplier: string | null; expense_date: string }
    | undefined

  console.log(
    '[recomputeSupply] ✔ most-recent expense:',
    next
      ? { id: next.id.slice(-8), supplier: next.supplier, expense_date: next.expense_date }
      : 'none — will null out supply store',
  )

  // 3. Write the freshly derived values back — null/null when no expense remains.
  //    Use .select() so we get back the written rows; this is the only way to
  //    detect a 0-row match (PostgREST returns error:null regardless of row count
  //    when using the default return=minimal header).
  const { data: written, error: updateErr } = await supabase
    .from('supplies')
    .update({
      store:             next?.supplier     ?? null,
      last_purchased_at: next?.expense_date ?? null,
    })
    .eq('id', supply.id)
    .eq('station_id', stationId)
    .select('id, store, last_purchased_at')

  if (updateErr) {
    console.error('[recomputeSupply] ✗ supply update failed:', updateErr.message, { supplyId: supply.id })
    throw new Error(`[recomputeSupply] supply update: ${updateErr.message}`)
  }

  if (!written?.length) {
    // This means .eq('station_id', stationId) didn't match — supply row exists
    // but with a different station_id (data inconsistency) or was deleted.
    console.error('[recomputeSupply] ✗ supply update matched 0 rows', {
      supplyId: supply.id.slice(-8),
      station: stationId.slice(-8),
    })
    throw new Error(`[recomputeSupply] supply update matched 0 rows for id=${supply.id}`)
  }

  console.log('[recomputeSupply] ✔ done', {
    store: written[0].store,
    last_purchased_at: written[0].last_purchased_at,
  })
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

    // Recompute supply denormalized fields for every edit that touches a
    // supplies expense — before OR after the change.
    // Wrapped in try/catch: the expense write already succeeded above; a
    // recompute failure must not roll it back or show "Save failed" to the user.
    if (stationId) {
      const oldCategory = existing?.category
      const oldItemName = existing?.item
      const newItemName = itemLabel ?? oldItemName

      try {
        // Case 3a — category changed FROM 'supplies': treat like a delete so the
        // old supply's store/last_purchased_at are re-derived without this row.
        if (oldCategory === 'supplies' && resolvedCategory !== 'supplies' && oldItemName) {
          await recomputeSupplyFromExpenses(stationId, oldItemName)
        }

        // Cases 1, 2, 3b — expense is (or became) a supplies expense.
        if (resolvedCategory === 'supplies') {
          // Case 2 / 3b — item name changed: recompute the OLD supply first so it
          // no longer reflects this expense's supplier/date.
          if (oldItemName && newItemName && oldItemName !== newItemName) {
            await recomputeSupplyFromExpenses(stationId, oldItemName)
          }
          // Case 1 — always recompute the current (new) supply name.
          if (newItemName) {
            await recomputeSupplyFromExpenses(stationId, newItemName)
          }
        }
      } catch (recomputeErr) {
        // Log clearly — the inventory may be out of sync until corrected.
        console.error('[updateExpense] supply recompute failed (expense was saved):', recomputeErr)
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
      try {
        await recomputeSupplyFromExpenses(stationId, existing.item)
      } catch (recomputeErr) {
        console.error('[deleteExpense] supply recompute failed (expense was deleted):', recomputeErr)
      }
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
