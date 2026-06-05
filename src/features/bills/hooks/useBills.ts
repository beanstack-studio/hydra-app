import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { nowPH } from '@/lib/utils'
import type { Bill, BillInput } from '../types'

interface UseBillsReturn {
  data: Bill[]
  isLoading: boolean
  error: string | null
  month: number
  year: number
  setMonth: (m: number) => void
  setYear: (y: number) => void
  addBill: (input: BillInput, billFile?: File, paymentFile?: File) => Promise<void>
  updateBill: (id: string, input: Partial<BillInput>, billFile?: File, paymentFile?: File) => Promise<void>
  deleteBill: (id: string) => Promise<void>
  markPaid: (id: string, paidDate: string) => Promise<void>
  payBill: (id: string, paidDate: string) => Promise<void>
  getFileUrl: (path: string) => Promise<string>
}

export function useBills(): UseBillsReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const now = nowPH()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<Bill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const { data: rows, error: e } = await supabase
        .from('monthly_bills')
        .select('*')
        .eq('station_id', stationId)
        .eq('month', month)
        .eq('year', year)
        .order('created_at')
      if (e) throw new Error(e.message)
      setData((rows ?? []) as Bill[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bills')
    } finally {
      setIsLoading(false)
    }
  }, [stationId, month, year])

  useEffect(() => { void fetchData() }, [fetchData])

  const uploadFile = useCallback(async (file: File, prefix: string): Promise<string> => {
    if (!stationId) throw new Error('No station')
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${stationId}/bills/${prefix}-${Date.now()}-${sanitized}`
    const { error: e } = await supabase.storage.from('receipts').upload(path, file)
    if (e) throw new Error(e.message)
    return path
  }, [stationId])

  const removeFile = useCallback(async (path: string) => {
    await supabase.storage.from('receipts').remove([path])
  }, [])

  const addBill = useCallback(async (input: BillInput, billFile?: File, paymentFile?: File) => {
    if (!stationId) return
    let billReceiptUrl: string | null = null
    let paymentReceiptUrl: string | null = null
    if (billFile) billReceiptUrl = await uploadFile(billFile, 'bill')
    if (paymentFile) paymentReceiptUrl = await uploadFile(paymentFile, 'pay')

    const { error: e } = await supabase.from('monthly_bills').insert({
      station_id: stationId,
      bill_type: input.bill_type,
      price: input.amount,
      amount: input.amount,
      month: input.month,
      year: input.year,
      due_date: input.due_date ?? null,
      date_paid: input.date_paid ?? null,
      description: input.description ?? null,
      payment_method: input.payment_method ?? null,
      bill_receipt_url: billReceiptUrl,
      payment_receipt_url: paymentReceiptUrl,
    })
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData, uploadFile])

  const updateBill = useCallback(async (
    id: string,
    input: Partial<BillInput>,
    billFile?: File,
    paymentFile?: File,
  ) => {
    const existing = data.find((b) => b.id === id)
    let billReceiptUrl: string | null | undefined = undefined
    let paymentReceiptUrl: string | null | undefined = undefined

    if (billFile) {
      const path = await uploadFile(billFile, 'bill')
      if (existing?.bill_receipt_url) await removeFile(existing.bill_receipt_url)
      billReceiptUrl = path
    } else if (input.bill_receipt_url === null && existing?.bill_receipt_url) {
      await removeFile(existing.bill_receipt_url)
      billReceiptUrl = null
    }

    if (paymentFile) {
      const path = await uploadFile(paymentFile, 'pay')
      if (existing?.payment_receipt_url) await removeFile(existing.payment_receipt_url)
      paymentReceiptUrl = path
    } else if (input.payment_receipt_url === null && existing?.payment_receipt_url) {
      await removeFile(existing.payment_receipt_url)
      paymentReceiptUrl = null
    }

    const updateData: Record<string, unknown> = {
      bill_type: input.bill_type,
      price: input.amount,
      amount: input.amount,
      month: input.month,
      year: input.year,
      due_date: input.due_date ?? null,
      description: input.description ?? null,
      date_paid: input.date_paid ?? null,
      payment_method: input.payment_method ?? null,
    }
    if (billReceiptUrl !== undefined) updateData.bill_receipt_url = billReceiptUrl
    if (paymentReceiptUrl !== undefined) updateData.payment_receipt_url = paymentReceiptUrl

    const { error: e } = await supabase.from('monthly_bills').update(updateData).eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData, uploadFile, removeFile, data])

  const deleteBill = useCallback(async (id: string) => {
    const existing = data.find((b) => b.id === id)
    if (existing?.bill_receipt_url) await removeFile(existing.bill_receipt_url)
    if (existing?.payment_receipt_url) await removeFile(existing.payment_receipt_url)
    const { error: e } = await supabase.from('monthly_bills').delete().eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData, removeFile, data])

  const markPaid = useCallback(async (id: string, paidDate: string) => {
    const { error: e } = await supabase
      .from('monthly_bills')
      .update({ date_paid: paidDate })
      .eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  const payBill = useCallback(async (id: string, paidDate: string) => {
    if (!stationId) return
    const bill = data.find((b) => b.id === id)

    const { error: e } = await supabase
      .from('monthly_bills')
      .update({ date_paid: paidDate })
      .eq('id', id)
    if (e) throw new Error(e.message)

    if (bill) {
      const isMaintenanceBill =
        bill.bill_type === 'maintenance' ||
        (bill.description != null && bill.description.startsWith('Maintenance:'))
      if (isMaintenanceBill) {
        await supabase.from('expenses').insert({
          station_id: stationId,
          category: 'maintenance',
          item: 'Maintenance',
          price: bill.amount,
          amount: bill.amount,
          frequency: 'one_off',
          expense_date: paidDate,
          remarks: bill.description || 'Maintenance payment',
        })
        // silently ignore expense insert errors
      }
    }

    await fetchData()
  }, [stationId, data, fetchData])

  const getFileUrl = useCallback(async (path: string): Promise<string> => {
    const { data: signed, error: e } = await supabase.storage
      .from('receipts')
      .createSignedUrl(path, 3600)
    if (e) throw new Error(e.message)
    return signed.signedUrl
  }, [])

  return { data, isLoading, error, month, year, setMonth, setYear, addBill, updateBill, deleteBill, markPaid, payBill, getFileUrl }
}
