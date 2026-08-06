export type PaymentMode = 'cash' | 'gcash' | 'maya' | 'utang'
export type OrderType = 'walk-in' | 'delivery' | 'pickup'
export type SaleStatus = 'paid' | 'partial' | 'unpaid'

/** Derive the correct display status from live balance_due / total_amount values,
 *  ignoring the potentially-stale `status` DB column. */
export function deriveStatus(balanceDue: number, totalAmount: number): SaleStatus {
  if (balanceDue <= 0) return 'paid'
  if (balanceDue >= totalAmount) return 'unpaid'
  return 'partial'
}
export type CustomerType = 'walk_in' | 'regular' | 'retailer' | 'one_time'

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

  total_amount: number
  discount_amount: number
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
  paid_at: string | null
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

  total_amount: number
  discount_amount: number
  payment_mode: PaymentMode
  amount_received: number
  status: SaleStatus
  order_type: OrderType
  sale_date: string
  scheduled_at: string | null
  delivery_address: string | null
  remarks: string | null
  paid_at?: string | null
  items?: CartItem[]
}

export interface EditSaleUpdate {
  items: CartItem[]
  discount: number
  saleDate: string
  paymentMode: PaymentMode
  amountReceived: number
  paidAt: string | null
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
