import type { CustomerType } from '@/features/sales/types'

export type { CustomerType }

export interface Customer {
  id: string
  station_id: string
  name: string
  type: CustomerType
  phone: string | null
  messenger: string | null
  address: string | null
  created_at: string
  last_ordered_at?: string | null
  total_balance?: number
}

export type CustomerInput = Pick<Customer, 'name' | 'type' | 'phone' | 'messenger' | 'address'>
