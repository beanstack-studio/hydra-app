export type ExpenseCategory = 'labor' | 'gasoline' | 'supplies' | 'maintenance' | 'other'
export type ExpenseFrequency = 'daily' | 'weekly' | 'monthly' | 'one_off'
export type ExpensePaymentMethod = 'cash' | 'credit_card' | 'gcash' | 'maya' | 'other'

export interface Expense {
  id: string
  station_id: string
  category: ExpenseCategory
  item: string
  price: number
  amount: number
  expense_date: string
  frequency: string
  employee_name: string | null
  payment_method: ExpensePaymentMethod | null
  remarks: string | null
  receipt_url: string | null
  inventory_item_id: string | null
  recorded_by: string | null
  created_at: string
  updated_at: string
}

export type ExpenseInput = {
  category: ExpenseCategory
  amount: number
  expense_date: string
  payment_method: ExpensePaymentMethod | null
  remarks: string | null
  receipt_url?: string | null
  inventory_item_id?: string | null
}
