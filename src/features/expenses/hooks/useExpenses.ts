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

    let inventoryItemId = input.inventory_item_id ?? null
    let itemLabel = CATEGORY_ITEM_LABELS[input.category] ?? input.category
    const supplyQty = input.supply_qty ?? 0

    // Handle supply stock update/creation
    if (input.category === 'supplies' && supplyQty > 0) {
      const pricePerUnit = input.amount / supplyQty

      if (input.new_supply_name) {
        // Create new supply item and link it
        const { data: newSupply } = await supabase.from('supplies').insert({
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
        if (newSupply) inventoryItemId = (newSupply as { id: string }).id
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
          inventoryItemId = input.supply_id
        }
        itemLabel = input.supply_name ?? itemLabel
      }
    }

    const { error: e } = await supabase.from('expenses').insert({
      station_id: stationId,
      category: input.category,
      item: itemLabel,
      price: input.amount,
      amount: input.amount,
      frequency: 'one_off',
      expense_date: input.expense_date,
      payment_method: input.payment_method ?? null,
      remarks: input.remarks ?? null,
      receipt_url,
      inventory_item_id: inventoryItemId,
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

    const { error: e } = await supabase
      .from('expenses')
      .update({
        category: input.category,
        item: input.category ? (CATEGORY_ITEM_LABELS[input.category] ?? input.category) : undefined,
        price: input.amount,
        amount: input.amount,
        expense_date: input.expense_date,
        payment_method: input.payment_method ?? null,
        remarks: input.remarks ?? null,
        receipt_url,
      })
      .eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData, uploadReceipt, data])

  const deleteExpense = useCallback(async (id: string) => {
    const existing = data.find((e) => e.id === id)
    if (existing?.receipt_url) {
      await supabase.storage.from('receipts').remove([existing.receipt_url])
    }
    const { error: e } = await supabase.from('expenses').delete().eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData, data])

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
