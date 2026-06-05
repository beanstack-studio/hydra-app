export interface Product {
  id: string
  station_id: string
  name: string
  type: 'water' | 'ice' | 'addon'
  addon_category: string | null
  unit: string | null
  price: number
  is_active: boolean
  sort_order: number
  image_url: string | null
  created_at: string
  updated_at: string
}

export type ProductInput = Pick<Product, 'name' | 'type' | 'price' | 'is_active' | 'image_url'>

export interface DeliveryZone {
  id: string
  station_id: string
  name: string
  price: number
  is_active: boolean
  sort_order: number
  created_at: string
}

export type DeliveryZoneInput = Pick<DeliveryZone, 'name' | 'price' | 'is_active'>

export type PayType = 'hourly' | 'daily'

export type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface DaySchedule {
  open: boolean
  open_time: string   // e.g. "6:00 AM" — matches generateTimeSlots() output
  close_time: string  // e.g. "6:00 PM"
}

export type OpenHours = Record<DayKey, DaySchedule>

export const DEFAULT_OPEN_HOURS: OpenHours = {
  monday:    { open: true,  open_time: '6:00 AM', close_time: '6:00 PM' },
  tuesday:   { open: true,  open_time: '6:00 AM', close_time: '6:00 PM' },
  wednesday: { open: true,  open_time: '6:00 AM', close_time: '6:00 PM' },
  thursday:  { open: true,  open_time: '6:00 AM', close_time: '6:00 PM' },
  friday:    { open: true,  open_time: '6:00 AM', close_time: '6:00 PM' },
  saturday:  { open: true,  open_time: '6:00 AM', close_time: '6:00 PM' },
  sunday:    { open: false, open_time: '6:00 AM', close_time: '6:00 PM' },
}

export interface StationSettings {
  id: string
  station_id: string
  container_fee_enabled: boolean
  container_fee_price: number
  container_name: string | null
  business_phone: string | null
  business_address: string | null
  open_hours: OpenHours | null
  updated_at: string
}

export type StationSettingsInput = Omit<StationSettings, 'id' | 'station_id' | 'updated_at'>

export type ContactType = 'mobile' | 'landline' | 'messenger' | 'email'

export interface ContactDetail {
  id: string
  station_id: string
  type: ContactType
  value: string
  label: string | null
  created_at: string
}

export type ContactDetailInput = Pick<ContactDetail, 'type' | 'value' | 'label'>

export interface SettingsData {
  products: Product[]
  deliveryZones: DeliveryZone[]
  stationSettings: StationSettings | null
  contacts: ContactDetail[]
}
