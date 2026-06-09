import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { uploadStationPhoto as uploadStationPhotoToStorage } from '@/lib/storage'
import { useAuthStore } from '@/stores/authStore'
import type {
  Product,
  ProductInput,
  DeliveryZone,
  DeliveryZoneInput,
  SettingsData,
  StationSettings,
  StationSettingsInput,
  ContactDetail,
  ContactDetailInput,
} from '../types'

export interface UseSettingsReturn {
  data: SettingsData | null
  isLoading: boolean
  error: string | null
  addProduct: (input: ProductInput) => Promise<void>
  updateProduct: (id: string, input: Partial<ProductInput>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  addDeliveryZone: (input: DeliveryZoneInput) => Promise<void>
  updateDeliveryZone: (id: string, input: Partial<DeliveryZoneInput>) => Promise<void>
  deleteDeliveryZone: (id: string) => Promise<void>
  updateStationSettings: (input: Partial<StationSettingsInput>) => Promise<void>
  updateStationName: (name: string) => Promise<void>
  uploadStationPhoto: (file: File) => Promise<void>
  addContact: (input: ContactDetailInput) => Promise<void>
  updateContact: (id: string, input: Partial<ContactDetailInput>) => Promise<void>
  deleteContact: (id: string) => Promise<void>
}

// Silently returns null/[] if a Supabase query fails (e.g. table doesn't exist yet)
function safeData<T>(
  result: PromiseSettledResult<{ data: T | null; error: unknown }>,
  fallback: T
): T {
  if (result.status === 'rejected') return fallback
  if (result.value.error) return fallback
  return result.value.data ?? fallback
}

export function useSettings(): UseSettingsReturn {
  const stationId   = useAuthStore((s) => s.stationId)
  const authStation = useAuthStore((s) => s.station)
  const setStation  = useAuthStore((s) => s.setStation)

  const [data, setData] = useState<SettingsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) {
      setIsLoading(false)
      return
    }
    setError(null)
    try {
      // Use allSettled so one missing table doesn't fail everything
      const [productsRes, zonesRes, settingsRes, contactsRes] = await Promise.allSettled([
        supabase
          .from('products')
          .select('*')
          .eq('station_id', stationId)
          .order('type')
          .order('name'),
        supabase
          .from('delivery_zones')
          .select('*')
          .eq('station_id', stationId)
          .order('sort_order'),
        supabase
          .from('station_settings')
          .select('*')
          .eq('station_id', stationId)
          .maybeSingle(),
        supabase
          .from('station_contacts')
          .select('*')
          .eq('station_id', stationId)
          .order('created_at'),
      ])

      setData({
        products: safeData(productsRes, []) as Product[],
        deliveryZones: safeData(zonesRes, []) as DeliveryZone[],
        stationSettings: safeData(settingsRes, null) as StationSettings | null,
        contacts: safeData(contactsRes, []) as ContactDetail[],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    void fetchData()
    if (!stationId) return

    const channel = supabase
      .channel(`settings:${stationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `station_id=eq.${stationId}` }, () => { void fetchData() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_zones', filter: `station_id=eq.${stationId}` }, () => { void fetchData() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'station_settings', filter: `station_id=eq.${stationId}` }, () => { void fetchData() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'station_contacts', filter: `station_id=eq.${stationId}` }, () => { void fetchData() })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [fetchData, stationId])

  const addProduct = useCallback(async (input: ProductInput) => {
    if (!stationId) return
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('station_id', stationId)
    const now = new Date().toISOString()
    const { data: newProduct, error: e } = await supabase.from('products').insert({
      ...input, station_id: stationId, sort_order: (count ?? 0) + 1,
      updated_at: now,
    }).select('id, name').single()
    if (e) throw new Error(e.message)
    // Auto-create inventory row for water/ice products only
    if (newProduct && (input.type === 'water' || input.type === 'ice')) {
      await supabase.from('inventory').upsert({
        station_id: stationId,
        product_id: newProduct.id,
        product_name: newProduct.name,
        available_qty: 0,
        threshold: 5,
        updated_at: now,
      }, { onConflict: 'product_id' })
    }
    await fetchData()
  }, [stationId, fetchData])

  const updateProduct = useCallback(async (id: string, input: Partial<ProductInput>) => {
    const { error: e } = await supabase.from('products').update({
      ...input, updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (e) throw new Error(e.message)
    // Keep inventory product_name in sync
    if (input.name) {
      await supabase.from('inventory').update({ product_name: input.name }).eq('product_id', id)
    }
    // If product type changed to addon, remove it from inventory
    if (input.type === 'addon') {
      await supabase.from('inventory').delete().eq('product_id', id)
    }
    await fetchData()
  }, [fetchData])

  const deleteProduct = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('products').delete().eq('id', id)
    if (e) throw new Error(e.message)
    // Remove corresponding inventory row
    await supabase.from('inventory').delete().eq('product_id', id)
    await fetchData()
  }, [fetchData])

  const addDeliveryZone = useCallback(async (input: DeliveryZoneInput) => {
    if (!stationId) return
    const { count } = await supabase
      .from('delivery_zones')
      .select('*', { count: 'exact', head: true })
      .eq('station_id', stationId)
    const { error: e } = await supabase.from('delivery_zones').insert({
      ...input, station_id: stationId, sort_order: (count ?? 0) + 1,
    })
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData])

  const updateDeliveryZone = useCallback(async (id: string, input: Partial<DeliveryZoneInput>) => {
    const { error: e } = await supabase.from('delivery_zones').update(input).eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  const deleteDeliveryZone = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('delivery_zones').delete().eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  const updateStationSettings = useCallback(async (input: Partial<StationSettingsInput>) => {
    if (!stationId) return
    const { error: e } = await supabase
      .from('station_settings')
      .upsert({ ...input, station_id: stationId, updated_at: new Date().toISOString() }, { onConflict: 'station_id' })
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData])

  const updateStationName = useCallback(async (name: string): Promise<void> => {
    if (!stationId || !authStation) throw new Error('Not authenticated')
    const { error: e } = await supabase.from('stations').update({ name }).eq('id', stationId)
    if (e) throw new Error(e.message)
    setStation({ ...authStation, name })
  }, [stationId, authStation, setStation])

  const uploadStationPhoto = useCallback(async (file: File): Promise<void> => {
    if (!stationId || !authStation) throw new Error('Not authenticated')
    const publicUrl = await uploadStationPhotoToStorage(stationId, file)
    const { error: e } = await supabase.from('stations').update({ photo_url: publicUrl }).eq('id', stationId)
    if (e) throw new Error(e.message)
    setStation({ ...authStation, photo_url: publicUrl })
  }, [stationId, authStation, setStation])

  const addContact = useCallback(async (input: ContactDetailInput) => {
    if (!stationId) return
    const { error: e } = await supabase.from('station_contacts').insert({ ...input, station_id: stationId })
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData])

  const updateContact = useCallback(async (id: string, input: Partial<ContactDetailInput>) => {
    const { error: e } = await supabase.from('station_contacts').update(input).eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  const deleteContact = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('station_contacts').delete().eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  return {
    data, isLoading, error,
    addProduct, updateProduct, deleteProduct,
    addDeliveryZone, updateDeliveryZone, deleteDeliveryZone,
    updateStationSettings, updateStationName, uploadStationPhoto,
    addContact, updateContact, deleteContact,
  }
}
