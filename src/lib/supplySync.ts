import { supabase } from '@/lib/supabase'

/**
 * Restores supply stock for a product when a sale is deleted or quantity decreases.
 * Handles both the junction-table (supply_product_links) and legacy direct-link patterns.
 */
export async function restoreLinkedSupplies(stationId: string, productId: string, qtySold: number): Promise<void> {
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

/**
 * Deducts supply stock for a product when a sale is created or quantity increases.
 * Handles both the junction-table (supply_product_links) and legacy direct-link patterns.
 */
export async function deductLinkedSupplies(stationId: string, productId: string, qtySold: number): Promise<void> {
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
