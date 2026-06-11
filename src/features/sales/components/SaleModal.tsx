import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getDay, addMinutes, parse } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { Package, Plus, Minus, X, ShoppingCart } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, generateTimeSlots, generateTimeSlotsInRange, cn, PH_TZ, cleanPhone, toTitleCase } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Product, DeliveryZone, StationSettings, DayKey } from '@/features/settings/types'
import type { Customer } from '@/features/customers/types'
import type { Sale, CartItem, SaleInsert, SaleStatus, CustomerType, OrderType, PaymentMode } from '../types'

// ── Schema ────────────────────────────────────────────────────────────────────

const saleSchema = z.object({
  customer_id: z.string().nullable(),
  customer_name: z.string(),
  customer_type: z.enum(['walk_in', 'regular', 'retailer']),
  customer_phone: z.string(),
  container_enabled: z.boolean(),
  container_qty: z.number().min(1),
  delivery_zone_id: z.string().nullable(),
  order_type: z.enum(['walk-in', 'delivery', 'pickup']),
  scheduled_date: z.string(),
  scheduled_time: z.string(),
  delivery_address: z.string(),
  payment_mode: z.enum(['cash', 'gcash', 'maya']),
  amount_received: z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === 'number' && isNaN(v as number)) ? 0 : v),
    z.number().min(0)
  ),
  sale_date: z.string().min(1, 'Sale date is required'),
  remarks: z.string(),
  set_reminder: z.boolean(),
  discount: z.number().min(0),
})

type SaleSchema = z.infer<typeof saleSchema>

// ── Constants ─────────────────────────────────────────────────────────────────

// Walk-in is an order type only — not a customer classification
const CUSTOMER_TYPES: { value: CustomerType; label: string }[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'retailer', label: 'Retailer' },
]

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: 'walk-in', label: 'Walk-in' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'pickup', label: 'Pickup' },
]

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya', label: 'Maya' },
]

const CUSTOMER_TYPE_BADGE: Record<CustomerType, string> = {
  walk_in: 'Walk-in',
  regular: 'Regular',
  retailer: 'Retailer',
}

type ProductTypeFilter = 'all' | 'water' | 'ice' | 'addon'

const typeRank: Record<string, number> = { water: 0, ice: 1, addon: 2 }

// ── Product card ──────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: Product
  cartQty: number
  onAdd: () => void
  onDecrement: () => void
  isDisabled?: boolean
  isAddon?: boolean
}

function ProductCard({ product, cartQty, onAdd, onDecrement, isDisabled = false, isAddon = false }: ProductCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-card transition-all duration-150 overflow-hidden w-full',
        cartQty > 0 ? 'border-primary ring-1 ring-primary/20' : 'border-border',
        isDisabled && 'opacity-40 pointer-events-none'
      )}
    >
      <button
        type="button"
        onClick={onAdd}
        className="aspect-square w-full bg-muted flex items-center justify-center overflow-hidden hover:opacity-90 transition-opacity"
      >
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <Package className="h-10 w-10 text-muted-foreground/30" />
        )}
      </button>
      <div className="p-2.5">
        <p className="text-xs font-semibold leading-tight mb-0.5 truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground mb-2">{formatCurrency(product.price)}</p>
        {cartQty > 0 ? (
          <div className={cn(
            'flex items-center rounded-lg bg-primary text-primary-foreground py-1 px-1.5',
            isAddon ? 'justify-between gap-1' : 'justify-between'
          )}>
            <button type="button" onClick={onDecrement} className="p-1 hover:opacity-80 transition-opacity">
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-xs font-semibold">{isAddon ? 'Added ✓' : `${cartQty} in cart`}</span>
            {!isAddon && (
              <button type="button" onClick={onAdd} className="p-1 hover:opacity-80 transition-opacity">
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center justify-center gap-1 rounded-lg text-xs py-1.5 font-medium transition-colors w-full bg-muted text-foreground/70 hover:bg-accent"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SaleModalProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  deliveryZones: DeliveryZone[]
  stationSettings: StationSettings | null
  onSubmit: (input: SaleInsert) => Promise<Sale>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SaleModal({ isOpen, onClose, products, deliveryZones, stationSettings, onSubmit }: SaleModalProps) {
  const { toast } = useToast()
  const stationId = useAuthStore((s) => s.stationId)

  const activeProducts = useMemo(() => products.filter((p) => p.is_active), [products])
  const hasAddonProducts = activeProducts.some((p) => p.type === 'addon')
  const hasDeliveryAddonProducts = activeProducts.some((p) => p.type === 'addon' && p.name.toLowerCase().includes('delivery'))
  const activeZones = deliveryZones.filter((z) => z.is_active)
  const containerEnabled = stationSettings?.container_fee_enabled ?? false
  const containerPrice = stationSettings?.container_fee_price ?? 0

  const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')
  const defaultTime = '8:00 AM'

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [typeFilter, setTypeFilter] = useState<ProductTypeFilter>('all')
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products')
  const [step, setStep] = useState<1 | 2>(1)
  const [showDiscount, setShowDiscount] = useState(false)
  const [shownBlocker, setShownBlocker] = useState<string | null>(null)

  // Customer state
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register, handleSubmit, control, reset, setValue,
    formState: { isSubmitting },
  } = useForm<SaleSchema>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      customer_id: null,
      customer_name: '',
      customer_type: 'regular',
      customer_phone: '',
      container_enabled: false,
      container_qty: 1,
      delivery_zone_id: null,
      order_type: 'walk-in',
      scheduled_date: todayPH,
      scheduled_time: defaultTime,
      delivery_address: '',
      payment_mode: 'cash',
      sale_date: todayPH,
      remarks: '',
      set_reminder: true,
      discount: 0,
    },
  })

  const watchedFields = useWatch({ control })
  const cEnabled = watchedFields.container_enabled ?? false
  const cQty = watchedFields.container_qty ?? 1
  const zoneId = watchedFields.delivery_zone_id ?? null
  const paymentMode = watchedFields.payment_mode ?? 'cash'
  const orderType = watchedFields.order_type ?? 'walk-in'
  const discount = watchedFields.discount ?? 0
  const scheduledDate = watchedFields.scheduled_date ?? ''

  // Derive available time slots from open hours when scheduling delivery/pickup
  const DAY_INDEX_TO_KEY: DayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  const { availableTimeSlots, isClosedDay } = useMemo(() => {
    const needsSchedule = orderType === 'delivery' || orderType === 'pickup'
    const openHours = stationSettings?.open_hours

    let rawSlots: string[]
    if (!needsSchedule || !scheduledDate || !openHours) {
      rawSlots = generateTimeSlots()
    } else {
      const dayIndex = getDay(new Date(scheduledDate + 'T00:00:00'))
      const dayKey = DAY_INDEX_TO_KEY[dayIndex]
      const schedule = openHours[dayKey]
      if (!schedule.open) {
        return { availableTimeSlots: [], isClosedDay: true }
      }
      rawSlots = generateTimeSlotsInRange(schedule.open_time, schedule.close_time)
    }

    // Filter out times already past (or within 30 min) when scheduling for today (PHT)
    if (scheduledDate === todayPH) {
      const nowPH = toZonedTime(new Date(), PH_TZ)
      const cutoff = addMinutes(nowPH, 30)
      const cutoffMins = cutoff.getHours() * 60 + cutoff.getMinutes()
      rawSlots = rawSlots.filter((s) => {
        const d = parse(s, 'h:mm a', new Date())
        return d.getHours() * 60 + d.getMinutes() > cutoffMins
      })
    }

    return { availableTimeSlots: rawSlots, isClosedDay: false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderType, scheduledDate, stationSettings?.open_hours, todayPH])

  const selectedZone = activeZones.find((z) => z.id === zoneId) ?? null
  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0)
  const grandTotal = cartTotal + (cEnabled ? cQty * containerPrice : 0) + (selectedZone?.price ?? 0) - discount
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0)
  const amountReceivedRaw = watchedFields.amount_received
  const amountReceived = (amountReceivedRaw == null || !Number.isFinite(amountReceivedRaw)) ? 0 : amountReceivedRaw
  const balanceDue = Math.max(0, grandTotal - amountReceived)
  const isPaidInFull = balanceDue === 0 && cartItems.length > 0

  const filteredProducts = activeProducts
    .filter((p) => typeFilter === 'all' || p.type === typeFilter)
    .sort((a, b) => typeFilter === 'all' ? (typeRank[a.type] ?? 1) - (typeRank[b.type] ?? 1) : 0)

  // Cart operations
  // Delivery add-ons (name contains "delivery", case-insensitive) are capped at 1 per cart.
  // Other add-ons (e.g. Container Fee) can have any qty.
  const isDeliveryAddon = useCallback((p: Product) =>
    p.type === 'addon' && p.name.toLowerCase().includes('delivery'), [])

  const addToCart = useCallback((product: Product) => {
    const isDelivery = isDeliveryAddon(product)
    setCartItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id)
      if (existing) {
        if (isDelivery) return prev  // delivery add-on: qty capped at 1, do nothing
        return prev.map((i) => i.product_id === product.id ? { ...i, qty: i.qty + 1 } : i)
      }
      // Swap out any existing delivery add-on when adding a new one
      const filtered = isDelivery
        ? prev.filter((i) => !isDeliveryAddon(activeProducts.find((ap) => ap.id === i.product_id) ?? ({ type: '', name: '' } as unknown as Product)))
        : prev
      return [...filtered, { product_id: product.id, product_name: product.name, price: product.price, qty: 1 }]
    })
  }, [activeProducts, isDeliveryAddon])

  const updateCartQty = useCallback((productId: string, qty: number) => {
    const product = activeProducts.find((p) => p.id === productId)
    if (product && isDeliveryAddon(product) && qty > 1) return  // delivery addons capped at 1
    if (qty <= 0) setCartItems((prev) => prev.filter((i) => i.product_id !== productId))
    else setCartItems((prev) => prev.map((i) => i.product_id === productId ? { ...i, qty } : i))
  }, [activeProducts, isDeliveryAddon])

  const removeFromCart = useCallback((productId: string) => {
    setCartItems((prev) => prev.filter((i) => i.product_id !== productId))
  }, [])

  // Customer search
  const searchCustomers = useCallback(async (q: string) => {
    if (q.length < 1 || !stationId) { setCustomerResults([]); return }
    setSearchLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('station_id', stationId)
      .ilike('name', `%${q}%`)
      .limit(5)
    setCustomerResults((data ?? []) as Customer[])
    setSearchLoading(false)
  }, [stationId])

  useEffect(() => {
    if (isNewCustomer || selectedCustomer) return
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => { void searchCustomers(customerQuery) }, 250)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [customerQuery, searchCustomers, isNewCustomer, selectedCustomer])

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c)
    setIsNewCustomer(false)
    setCustomerQuery(c.name)
    setCustomerResults([])
    setValue('customer_id', c.id)
    setValue('customer_name', c.name)
    setValue('customer_type', c.type)
    setValue('customer_phone', c.phone ?? '')
    if (c.address) setValue('delivery_address', c.address)
  }

  const selectNewCustomer = () => {
    setIsNewCustomer(true)
    setCustomerResults([])
    setValue('customer_name', customerQuery)
    setValue('customer_id', null)
    setValue('customer_type', 'regular')
    setValue('customer_phone', '')
  }

  const clearCustomer = () => {
    setSelectedCustomer(null)
    setIsNewCustomer(false)
    setCustomerQuery('')
    setCustomerResults([])
    setValue('customer_id', null)
    setValue('customer_name', '')
    setValue('customer_phone', '')
    setValue('delivery_address', '')
  }

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      reset()
      setCartItems([])
      setTypeFilter('all')
      setActiveTab('products')
      setCustomerQuery('')
      setCustomerResults([])
      setSelectedCustomer(null)
      setIsNewCustomer(false)
      setStep(1)
      setShowDiscount(false)
      setShownBlocker(null)
    }
  }, [isOpen, reset])

  // Remove delivery add-ons from cart when switching away from delivery order type
  useEffect(() => {
    if (orderType === 'walk-in' || orderType === 'pickup') {
      setCartItems((prev) => prev.filter((item) => {
        const p = activeProducts.find((ap) => ap.id === item.product_id)
        return !p || !isDeliveryAddon(p)
      }))
    }
  }, [orderType, activeProducts, isDeliveryAddon])

  // Clear scheduled time when it's no longer in available slots (e.g. user picks today, current time is past)
  const scheduledTime = watchedFields.scheduled_time ?? ''
  useEffect(() => {
    if (availableTimeSlots.length > 0 && scheduledTime && !availableTimeSlots.includes(scheduledTime)) {
      setValue('scheduled_time', availableTimeSlots[0])
    }
  }, [availableTimeSlots, scheduledTime, setValue])

  const hasCustomer = !!selectedCustomer || isNewCustomer

  const nextBlockers: string[] = []
  if (cartItems.length === 0) nextBlockers.push('Add at least one product')
  if (!hasCustomer) {
    nextBlockers.push('Select or enter a customer')
  } else if (isNewCustomer && !customerQuery.trim()) {
    nextBlockers.push('Enter customer name')
  } else if (orderType === 'delivery' || orderType === 'pickup') {
    if (isClosedDay) nextBlockers.push('Station is closed on the selected date')
    if (!(watchedFields.customer_phone ?? '').trim()) nextBlockers.push('Contact number required')
    if (orderType === 'delivery' && !(watchedFields.delivery_address ?? '').trim()) nextBlockers.push('Delivery address required')
  }

  if (orderType === 'delivery' && hasDeliveryAddonProducts) {
    const cartHasDeliveryAddon = cartItems.some((i) => {
      const p = activeProducts.find((ap) => ap.id === i.product_id)
      return p ? isDeliveryAddon(p) : false
    })
    if (!cartHasDeliveryAddon) nextBlockers.push('Select a delivery add-on')
  }

  // Displayed error: only the one the user last triggered, auto-clears when they fix it
  const displayedBlocker = shownBlocker !== null && nextBlockers.includes(shownBlocker) ? shownBlocker : null

  const handleNext = () => {
    if (nextBlockers.length > 0) {
      setShownBlocker(nextBlockers[0])  // show highest-priority error
      return
    }
    setShownBlocker(null)
    setStep(2)
  }

  const onFormSubmit = handleSubmit(async (values) => {
    if (!stationId) {
      toast({ title: 'Station not found', description: 'Sign out and sign back in.', variant: 'destructive' })
      return
    }
    if (cartItems.length === 0) {
      toast({ title: 'Add at least one product', variant: 'destructive' })
      return
    }
    if (isNewCustomer && !customerQuery.trim()) {
      toast({ title: 'Customer name required', variant: 'destructive' })
      return
    }
    if (values.order_type !== 'walk-in' && !values.customer_id && !isNewCustomer) {
      toast({ title: 'Customer required', description: 'Select an existing customer or add a new one for delivery/pickup orders.', variant: 'destructive' })
      return
    }
    if ((values.order_type === 'delivery' || values.order_type === 'pickup') && !values.customer_phone) {
      toast({ title: 'Contact number required for delivery/pickup', variant: 'destructive' })
      return
    }
    if (values.order_type === 'delivery' && !values.delivery_address) {
      toast({ title: 'Delivery address required', variant: 'destructive' })
      return
    }

    try {
      let customerId = values.customer_id

      if (isNewCustomer && customerQuery.trim()) {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({
            station_id: stationId,
            name: customerQuery.trim(),
            type: values.customer_type,
            phone: values.customer_phone ? cleanPhone(values.customer_phone) : null,
            messenger: null,
            address: values.order_type === 'delivery' ? (toTitleCase(values.delivery_address) || null) : null,
          })
          .select()
          .single()
        if (custErr) throw new Error(custErr.message)
        customerId = (newCust as Customer).id
      } else if (selectedCustomer && values.order_type === 'delivery' && values.delivery_address) {
        // Sync delivery address back to customer profile whenever it's provided or changed
        const newAddr = toTitleCase(values.delivery_address)
        if (newAddr !== selectedCustomer.address) {
          await supabase.from('customers').update({ address: newAddr }).eq('id', selectedCustomer.id)
        }
      }

      const zone = activeZones.find((z) => z.id === values.delivery_zone_id)
      const firstItem = cartItems[0]

      let scheduledAt: string | null = null
      if ((values.order_type === 'delivery' || values.order_type === 'pickup') && values.scheduled_date) {
        const combined = `${values.scheduled_date} ${values.scheduled_time || defaultTime}`
        const parsed = new Date(combined)
        scheduledAt = isNaN(parsed.getTime()) ? null : parsed.toISOString()
      }

      const customerName = toTitleCase(customerQuery.trim() || 'Walk-in')
      const discountValue = values.discount ?? 0
      const finalTotal = cartTotal + (values.container_enabled ? values.container_qty * containerPrice : 0) + (zone?.price ?? 0) - discountValue
      const amountReceived = Math.min(values.amount_received, finalTotal)
      const finalBalance = Math.max(0, finalTotal - amountReceived)
      const saleStatus: SaleStatus = finalBalance === 0 ? 'paid' : amountReceived > 0 ? 'partial' : 'unpaid'

      const insert: SaleInsert = {
        station_id: stationId,
        customer_id: customerId,
        customer_name: customerName,
        customer_type: values.customer_type,
        product_id: firstItem.product_id,
        product_name: firstItem.product_name,
        qty: firstItem.qty,
        price_per_piece: firstItem.price,
        product_total: firstItem.price * firstItem.qty,
        container_enabled: values.container_enabled,
        container_qty: values.container_enabled ? values.container_qty : 0,
        container_price: values.container_enabled ? containerPrice : 0,
        delivery_zone_id: zone?.id ?? null,
        delivery_zone_name: zone?.name ?? null,
        delivery_zone_price: zone?.price ?? 0,
        total_amount: finalTotal,
        payment_mode: values.payment_mode,
        amount_received: amountReceived,
        status: saleStatus,
        order_type: values.order_type,
        sale_date: values.sale_date,
        scheduled_at: scheduledAt,
        delivery_address: values.order_type === 'delivery' ? (toTitleCase(values.delivery_address) || null) : null,
        remarks: values.remarks || null,
        items: cartItems,
      }

      const savedSale = await onSubmit(insert)

      if ((values.order_type === 'delivery' || values.order_type === 'pickup') && scheduledAt && values.set_reminder) {
        const reminderAt = new Date(new Date(scheduledAt).getTime() - 15 * 60 * 1000).toISOString()
        await supabase.from('reminders').insert({
          station_id: stationId,
          sale_id: savedSale.id,
          customer_name: customerName,
          order_type: values.order_type,
          scheduled_at: reminderAt,
          message: [
            `${values.order_type === 'delivery' ? 'Delivery' : 'Pickup'} — ${customerName} — ${cartItems.map((i) => `${i.product_name} ×${i.qty}`).join(', ')}`,
            cleanPhone(values.customer_phone) || '',
            values.order_type === 'delivery' ? (values.delivery_address || '') : '',
          ].join('|||'),
          is_dismissed: false,
        })
      }

      toast({ title: 'Sale recorded' })
      onClose()
    } catch (e) {
      toast({
        title: 'Failed to record sale',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  })

  const pillBase = 'flex-1 rounded-md px-2 py-1.5 text-xs font-medium border transition-all duration-150 text-center'
  const pillActive = 'bg-primary text-primary-foreground border-primary'
  const pillInactive = 'bg-background text-muted-foreground border-border hover:bg-accent'
  const selectClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  const typeFilters: { value: ProductTypeFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'water', label: 'Water' },
    { value: 'ice', label: 'Ice' },
    ...(hasAddonProducts ? [{ value: 'addon' as ProductTypeFilter, label: 'Add-ons' }] : []),
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Sale" size="xl" noPadding>
      <div className="flex flex-col h-full">

        {/* Mobile tab bar */}
        <div className="flex lg:hidden border-b border-border shrink-0">
          <button type="button" onClick={() => setActiveTab('products')}
            className={cn('flex-1 py-2.5 text-sm font-medium border-b-2 transition-all duration-150',
              activeTab === 'products' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
            Products
          </button>
          <button type="button" onClick={() => setActiveTab('cart')}
            className={cn('flex-1 py-2.5 text-sm font-medium border-b-2 transition-all duration-150',
              activeTab === 'cart' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
            {cartCount > 0 ? `Cart (${cartCount}) · ${formatCurrency(grandTotal)}` : 'Cart'}
          </button>
        </div>

        {/* Form wraps both panels so Controllers work from either side */}
        <form onSubmit={onFormSubmit} className="flex flex-col lg:flex-row flex-1 min-h-0">

          {/* ── Left: Product grid ─────────────────────────────────────── */}
          <div className={cn('flex-1 flex flex-col min-h-0 lg:border-r border-border', activeTab !== 'products' && 'hidden lg:flex')}>

            {/* Type filter — fixed, never scrolls */}
            <div className="flex gap-2 px-4 pt-4 pb-3 flex-wrap shrink-0 border-b border-border/50">
              {typeFilters.map((f) => (
                <button key={f.value} type="button" onClick={() => setTypeFilter(f.value)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium border transition-all duration-150',
                    typeFilter === f.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
                  )}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Product grid — scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Package className="h-8 w-8 opacity-40" />
                  <p className="text-sm">No products. Add them in Settings.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-2">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      cartQty={cartItems.find((i) => i.product_id === product.id)?.qty ?? 0}
                      onAdd={() => addToCart(product)}
                      onDecrement={() => updateCartQty(product.id, (cartItems.find((i) => i.product_id === product.id)?.qty ?? 1) - 1)}
                      isDisabled={isDeliveryAddon(product) && (orderType === 'walk-in' || orderType === 'pickup')}
                      isAddon={isDeliveryAddon(product)}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ── Right: Order panel ─────────────────────────────────────── */}
          <div className={cn(
            'w-full lg:w-80 xl:w-96 flex flex-col bg-background flex-1 min-h-0 lg:flex-none',
            activeTab !== 'cart' && 'hidden lg:flex'
          )}>

            {/* Step indicator */}
            <div className="flex border-b border-border shrink-0">
              <button type="button" onClick={() => setStep(1)}
                className={cn('flex-1 py-2.5 text-xs font-semibold tracking-wide uppercase border-b-2 transition-all duration-150',
                  step === 1 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                1 · Details
              </button>
              <button type="button" onClick={() => step === 2 && setStep(2)}
                className={cn('flex-1 py-2.5 text-xs font-semibold tracking-wide uppercase border-b-2 transition-all duration-150',
                  step === 2 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
                  step === 1 && 'cursor-default opacity-40')}>
                2 · Payment
              </button>
            </div>

            {/* ── Step 1: Customer · Items · Order Type ── */}
            {step === 1 && (
              <div className="flex-1 overflow-y-auto divide-y divide-border">

                {/* Customer */}
                <div className="px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</p>

                  <div className="relative">
                    <Input
                      placeholder="Customer name…"
                      value={customerQuery}
                      readOnly={!!selectedCustomer}
                      onChange={(e) => {
                        const val = e.target.value
                        setCustomerQuery(val)
                        setValue('customer_name', val)
                        if (!isNewCustomer) setValue('customer_id', null)
                      }}
                      autoComplete="off"
                      className={cn(selectedCustomer && 'bg-muted/50 cursor-default')}
                    />

                    {/* Search dropdown */}
                    {!selectedCustomer && !isNewCustomer && customerQuery.length >= 1 && (
                      <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-52 overflow-y-auto">
                        {searchLoading ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
                        ) : (
                          <>
                            {customerResults.length === 0 && (
                              <p className="px-3 py-2 text-xs text-muted-foreground">No customers found</p>
                            )}
                            {customerResults.map((c) => (
                              <button key={c.id} type="button"
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent text-left"
                                onClick={() => selectCustomer(c)}>
                                <span className="text-sm font-medium">{c.name}</span>
                                <Badge variant="outline">{CUSTOMER_TYPE_BADGE[c.type]}</Badge>
                              </button>
                            ))}
                            {customerResults.length < 5 && (
                              <button type="button"
                                className={cn('w-full flex items-center px-3 py-2 hover:bg-accent text-left gap-2',
                                  customerResults.length > 0 && 'border-t border-border')}
                                onClick={selectNewCustomer}>
                                <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="text-sm text-primary font-medium">New: "{customerQuery}"</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {(selectedCustomer || isNewCustomer) && (
                      <button type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                        onClick={clearCustomer}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* New customer: type pills (Regular / Retailer only) */}
                  {isNewCustomer && (
                    <Controller
                      name="customer_type"
                      control={control}
                      render={({ field }) => (
                        <div className="flex gap-1">
                          {CUSTOMER_TYPES.map((t) => (
                            <button key={t.value} type="button"
                              onClick={() => field.onChange(t.value)}
                              className={cn(pillBase, field.value === t.value ? pillActive : pillInactive)}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                      )}
                    />
                  )}

                </div>

                {/* Items */}
                <div className="px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</p>
                  {cartItems.length === 0 ? (
                    <div className="flex items-center gap-2 py-2 text-muted-foreground">
                      <ShoppingCart className="h-4 w-4" />
                      <p className="text-sm">Tap a product to add it</p>
                    </div>
                  ) : (
                    cartItems.map((item) => {
                      const itemProduct = activeProducts.find((p) => p.id === item.product_id)
                      const isAddonItem = itemProduct ? isDeliveryAddon(itemProduct) : false
                      return (
                        <div key={item.product_id} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} ea</p>
                          </div>
                          {isAddonItem ? (
                            <span className="text-xs text-muted-foreground shrink-0">Add-on</span>
                          ) : (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button type="button" size="icon" variant="outline" className="h-6 w-6"
                                onClick={() => updateCartQty(item.product_id, item.qty - 1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                              <Button type="button" size="icon" variant="outline" className="h-6 w-6"
                                onClick={() => updateCartQty(item.product_id, item.qty + 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          <span className="text-sm font-semibold w-16 text-right shrink-0">
                            {formatCurrency(item.price * item.qty)}
                          </span>
                          <Button type="button" size="icon" variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeFromCart(item.product_id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Order Type */}
                <div className="px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order Type</p>
                  <Controller
                    name="order_type"
                    control={control}
                    render={({ field }) => (
                      <div className="flex gap-1.5">
                        {ORDER_TYPES.map((t) => (
                          <button key={t.value} type="button"
                            onClick={() => field.onChange(t.value)}
                            className={cn(pillBase, field.value === t.value ? pillActive : pillInactive)}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                  {(orderType === 'delivery' || orderType === 'pickup') && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{orderType === 'delivery' ? 'Delivery' : 'Pickup'} Date</Label>
                          <DatePickerInput
                            value={scheduledDate}
                            onChange={(v) => setValue('scheduled_date', v, { shouldValidate: true })}
                            min={todayPH}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Time</Label>
                          {isClosedDay ? (
                            <p className="text-xs text-destructive py-1.5">Station closed this day</p>
                          ) : (
                            <Controller
                              name="scheduled_time"
                              control={control}
                              render={({ field }) => (
                                <select value={field.value} onChange={field.onChange} className={selectClass}>
                                  {availableTimeSlots.map((slot) => (
                                    <option key={slot} value={slot}>{slot}</option>
                                  ))}
                                </select>
                              )}
                            />
                          )}
                        </div>
                      </div>
                      {orderType === 'delivery' && (
                        <Input placeholder="Delivery address *" {...register('delivery_address')} />
                      )}
                      {/* Contact number — only when customer is present and order needs it */}
                      {(selectedCustomer || isNewCustomer) && (
                        <PhoneInput name="customer_phone" control={control} placeholder="Contact number *" />
                      )}
                      <Controller
                        name="set_reminder"
                        control={control}
                        render={({ field }) => (
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={field.value}
                              onChange={(e) => field.onChange(e.target.checked)}
                              className="h-4 w-4 rounded border-border accent-primary" />
                            <span className="text-xs text-muted-foreground">Remind me 15 min before</span>
                          </label>
                        )}
                      />
                    </>
                  )}
                </div>

              </div>
            )}

            {/* ── Step 2: Remarks in scrollable area ── */}
            {step === 2 && (
              <div className="flex-1 overflow-y-auto divide-y divide-border">
                <div className="px-4 py-3 space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Remarks</Label>
                  <Input placeholder="Optional notes…" {...register('remarks')} />
                </div>
              </div>
            )}

            {/* Sticky footer */}
            {step === 1 && (
              <div className="px-4 py-3 border-t border-border shrink-0 space-y-3 bg-background">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Grand Total</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</span>
                </div>
                {displayedBlocker && (
                  <p className="text-xs text-destructive">· {displayedBlocker}</p>
                )}
                <Button
                  type="button"
                  className={cn('w-full', nextBlockers.length > 0 && 'opacity-50 cursor-not-allowed')}
                  onClick={handleNext}
                >
                  Next →
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="px-4 py-3 border-t border-border shrink-0 bg-background space-y-3">

                {/* Line 1: Total */}
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(grandTotal)}</span>
                </div>

                {/* Line 2: Discount toggle */}
                {!showDiscount ? (
                  <button type="button" onClick={() => setShowDiscount(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors duration-150">
                    <Plus className="h-3 w-3" /> Add Discount
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground flex-1">Discount</span>
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                      <Input type="number" step="0.01" min="0" className="pl-6 h-8 text-sm"
                        {...register('discount', { valueAsNumber: true })} />
                    </div>
                    <button type="button"
                      onClick={() => { setShowDiscount(false); setValue('discount', 0) }}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Line 3: Payment label + amount input right-aligned */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-muted-foreground shrink-0">Payment</span>
                  <div className="relative flex-1 max-w-[180px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                    <Controller
                      name="amount_received"
                      control={control}
                      render={({ field }) => (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={grandTotal}
                          placeholder="0.00"
                          className="pl-8 h-11 text-2xl font-bold text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={
                            field.value === 0 || field.value == null || !Number.isFinite(field.value as number)
                              ? ''
                              : field.value
                          }
                          onChange={(e) => {
                            const parsed = parseFloat(e.target.value)
                            field.onChange(isNaN(parsed) ? 0 : Math.min(parsed, grandTotal))
                          }}
                        />
                      )}
                    />
                  </div>
                </div>

                {/* Payment mode pills — smaller, below payment row */}
                <Controller name="payment_mode" control={control} render={({ field }) => (
                  <div className="flex gap-1.5">
                    {PAYMENT_MODES.map((m) => (
                      <button key={m.value} type="button" onClick={() => field.onChange(m.value)}
                        className={cn(
                          'flex-1 rounded-md py-1.5 text-xs font-medium border transition-all duration-150',
                          field.value === m.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground'
                        )}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                )} />

                {/* Balance / Paid */}
                {balanceDue > 0 && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Balance due</span>
                    <span className="text-base font-semibold text-destructive">{formatCurrency(balanceDue)}</span>
                  </div>
                )}
                {isPaidInFull && (
                  <p className="text-sm font-semibold text-right text-green-600">✓ Paid in full</p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : 'Record Sale'}
                  </Button>
                </div>

              </div>
            )}

          </div>

        </form>
      </div>
    </Modal>
  )
}
