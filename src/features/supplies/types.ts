export type SupplyType = 'supply' | 'asset'
export type SupplyStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export interface Supply {
  id: string
  station_id: string
  name: string
  type: SupplyType
  qty: number
  price_per_unit: number | null
  store: string | null
  last_purchased_at: string | null
  threshold: number
  linked_product_id: string | null
  units_per_sale: number
  created_at: string
}

export interface SupplyInput {
  name: string
  type: SupplyType
  qty: number
  price_per_unit: number | null
  store: string | null
  last_purchased_at: string | null
  threshold: number
  linked_product_id: string | null
  units_per_sale: number
}
