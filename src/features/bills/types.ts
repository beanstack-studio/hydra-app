export type BillType = 'electricity' | 'water' | 'internet' | 'rent' | 'other' | 'maintenance'
export type BillPaymentMethod = 'cash' | 'credit_card' | 'gcash' | 'maya' | 'other'

export interface Bill {
  id: string
  station_id: string
  bill_type: BillType
  description: string | null
  price: number
  amount: number
  month: number
  year: number
  due_date: string | null
  date_paid: string | null
  payment_method: BillPaymentMethod | null
  bill_receipt_url: string | null
  payment_receipt_url: string | null
  created_at: string
  updated_at: string
}

export type BillInput = {
  bill_type: BillType
  amount: number
  month: number
  year: number
  due_date?: string | null
  date_paid?: string | null
  payment_method?: BillPaymentMethod | null
  description?: string | null
  bill_receipt_url?: string | null
  payment_receipt_url?: string | null
}
