import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Customer, CustomerInput } from '../types'

interface UseCustomersReturn {
  data: Customer[]
  isLoading: boolean
  error: string | null
  addCustomer: (input: CustomerInput) => Promise<Customer>
  updateCustomer: (id: string, input: Partial<CustomerInput>) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  searchCustomers: (query: string) => Promise<Customer[]>
}

export function useCustomers(): UseCustomersReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      // RPC computes last_ordered_at and total_balance server-side via a single
      // LEFT JOIN + GROUP BY, avoiding both the nested-subquery row-cap risk and
      // the N-row JS aggregation the old .select('*, sales(...)') approach required.
      const { data: rows, error: e } = await supabase
        .rpc('get_customers_with_stats', { p_station_id: stationId })
      if (e) throw new Error(e.message)
      setData((rows ?? []) as Customer[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    void fetchData()
    if (!stationId) return
    const channel = supabase
      .channel(`customers:${stationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `station_id=eq.${stationId}` }, () => { void fetchData() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchData, stationId])

  const addCustomer = useCallback(async (input: CustomerInput): Promise<Customer> => {
    if (!stationId) throw new Error('No station')
    const { data: row, error: e } = await supabase
      .from('customers')
      .insert({ ...input, station_id: stationId })
      .select()
      .single()
    if (e) throw new Error(e.message)
    await fetchData()
    return row as Customer
  }, [stationId, fetchData])

  const updateCustomer = useCallback(async (id: string, input: Partial<CustomerInput>) => {
    const { error: e } = await supabase
      .from('customers')
      .update(input)
      .eq('id', id)
      .eq('station_id', stationId)
    if (e) throw new Error(e.message)
    // Sync address change to pending unfulfilled delivery sales
    if (input.address) {
      await supabase
        .from('sales')
        .update({ delivery_address: input.address })
        .eq('customer_id', id)
        .eq('station_id', stationId)
        .eq('order_type', 'delivery')
        .is('fulfilled_at', null)
    }
    await fetchData()
  }, [fetchData, stationId])

  const deleteCustomer = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('customers').delete().eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  const searchCustomers = useCallback(async (query: string): Promise<Customer[]> => {
    if (!stationId || query.length < 3) return []
    const { data: rows } = await supabase
      .from('customers')
      .select('*')
      .eq('station_id', stationId)
      .ilike('name', `%${query}%`)
      .limit(10)
    return (rows ?? []) as Customer[]
  }, [stationId])

  return { data, isLoading, error, addCustomer, updateCustomer, deleteCustomer, searchCustomers }
}
