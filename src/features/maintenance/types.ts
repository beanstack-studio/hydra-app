// DB row — matches actual Supabase column names
export interface MaintenanceLog {
  id: string
  station_id: string
  item_filter: string       // equipment name (DB column)
  qty: number
  total_price: number
  maintenance_date: string  // primary date column (NOT NULL)
  service_date: string | null
  cost: number | null
  technician: string | null
  remarks: string | null    // stores issue/work description
  photos_urls: string | null
  recorded_by: string | null
  created_at: string
  updated_at: string
}

// Form input — user-friendly names, mapped to DB in the hook
export type MaintenanceLogInput = {
  equipment: string       // → item_filter
  issue: string           // → remarks
  service_date: string    // → maintenance_date AND service_date
  cost: number | null     // → cost AND total_price
  technician: string | null
  photos_urls: string | null
}
