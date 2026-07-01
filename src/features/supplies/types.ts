export type SupplyType = 'supply' | 'asset'
export type SupplyStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export interface SupplyProductLink {
  product_id: string
  units_per_sale: number
}

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
  // Populated from supply_product_links junction table (requires DB migration)
  supply_product_links?: SupplyProductLink[]
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
  // Multi-product links (stored in supply_product_links junction table)
  product_links?: SupplyProductLink[]
}
