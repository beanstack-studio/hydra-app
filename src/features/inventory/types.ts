export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export interface InventoryItem {
  id: string
  station_id: string
  product_id: string
  product_name: string
  available_qty: number
  threshold: number
  status: StockStatus   // computed client-side from available_qty vs threshold
  created_at: string
  updated_at: string
}
