export type PaymentMode = 'cash' | 'gcash' | 'maya' | 'utang'
export type OrderType = 'walk-in' | 'delivery' | 'pickup'
export type SaleStatus = 'paid' | 'partial' | 'unpaid'
export type CustomerType = 'walk_in' | 'regular' | 'retailer'

export interface CartItem {
  product_id: string
  product_name: string
  qty: number
  price: number
}

export interface Sale {
  id: string
  station_id: string
  customer_id: string | null
  customer_name: string
  customer_type: CustomerType
  product_id: string
  product_name: string
  qty: number
  price_per_piece: number
  product_total: number
  container_enabled: boolean
  container_qty: number
  container_price: number
  delivery_zone_id: string | null
  delivery_zone_name: string | null
  delivery_zone_price: number
  total_amount: number
  payment_mode: PaymentMode
  amount_received: number
  balance_due: number
  order_type: OrderType
  sale_date: string
  scheduled_at: string | null
  delivery_address: string | null
  remarks: string | null
  status: SaleStatus
  items: CartItem[] | null
  fulfilled_at: string | null
  created_at: string
}

export interface SaleInsert {
  station_id: string
  customer_id: string | null
  customer_name: string
  customer_type: CustomerType
  product_id: string
  product_name: string
  qty: number
  price_per_piece: number
  product_total: number
  container_enabled: boolean
  container_qty: number
  container_price: number
  delivery_zone_id: string | null
  delivery_zone_name: string | null
  delivery_zone_price: number
  total_amount: number
  payment_mode: PaymentMode
  amount_received: number
  status: SaleStatus
  order_type: OrderType
  sale_date: string
  scheduled_at: string | null
  delivery_address: string | null
  remarks: string | null
  items?: CartItem[]
}

export interface PaymentRecord {
  id: string
  sale_id: string
  station_id: string
  amount: number
  payment_mode: PaymentMode
  paid_at: string
  remarks: string | null
  created_at: string
}

export interface SaleWithPayments extends Sale {
  sale_payments: PaymentRecord[]
}
