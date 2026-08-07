import { useState, useEffect, useMemo } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { CalendarClock, CheckCircle2, Clock, MapPin, Minus, Plus, Printer, Search, X } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate, formatTime, PH_TZ } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'
import type { Sale, CartItem, PaymentMode, EditSaleUpdate } from '../types'
import type { Product } from '@/features/settings/types'

const ORDER_TYPE_LABEL: Record<string, string> = {
  'walk-in': 'Walk-in',
  delivery:  'Delivery',
  pickup:    'Pickup',
}

const PAYMENT_LABELS: Record<PaymentMode, string> = {
  cash:  'Cash',
  gcash: 'GCash',
  maya:  'Maya',
  utang: 'Utang',
}

interface EditSaleModalProps {
  sale: Sale | null
  isOpen: boolean
  onClose: () => void
  products: Product[]
  onSave: (saleId: string, update: EditSaleUpdate) => Promise<void>
  onReschedule?: () => void
}

export function EditSaleModal({ sale, isOpen, onClose, products, onSave, onReschedule }: EditSaleModalProps) {
  const { toast } = useToast()
  const role    = useAuthStore((s) => s.role)
  const isOwner = role === 'owner' || role === 'super_admin'

  const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')

  const [cartItems,       setCartItems]       = useState<CartItem[]>([])
  const [discount,        setDiscount]        = useState(0)
  const [showDiscount,    setShowDiscount]    = useState(false)
  const [showAddItem,     setShowAddItem]     = useState(false)
  const [searchQuery,     setSearchQuery]     = useState('')
  const [saleDate,        setSaleDate]        = useState(todayPH)
  const [paymentMode,     setPaymentMode]     = useState<PaymentMode>('cash')
  const [amountReceived,  setAmountReceived]  = useState(0)
  const [paidAt,          setPaidAt]          = useState(todayPH)
  const [showPaymentDate, setShowPaymentDate] = useState(false)
  const [isSaving,        setIsSaving]        = useState(false)

  // Mode determination: owner on an unfulfilled sale → editable; everything else → view-only
  const isFulfilled = sale ? (sale.order_type !== 'walk-in' && !!sale.fulfilled_at) : false
  const readOnly    = !isOwner || isFulfilled

  // Populate from sale whenever modal opens
  useEffect(() => {
    if (!isOpen || !sale) return

    const initial: CartItem[] = sale.items && sale.items.length > 0
      ? sale.items.map((i) => ({ product_id: i.product_id, product_name: i.product_name, qty: i.qty, price: i.price }))
      : [{ product_id: sale.product_id, product_name: sale.product_name, qty: sale.qty, price: sale.price_per_piece }]
    setCartItems(initial)

    const d = sale.discount_amount ?? 0
    setDiscount(d)
    setShowDiscount(d > 0)
    setShowAddItem(false)
    setSearchQuery('')

    setSaleDate(sale.sale_date ?? todayPH)

    const knownModes: PaymentMode[] = ['cash', 'gcash', 'maya']
    setPaymentMode(knownModes.includes(sale.payment_mode) ? sale.payment_mode : 'cash')

    const received = sale.amount_received ?? 0
    setAmountReceived(received)
    setShowPaymentDate(received > 0)

    setPaidAt(
      sale.paid_at
        ? formatInTimeZone(new Date(sale.paid_at), PH_TZ, 'yyyy-MM-dd')
        : todayPH
    )
  // todayPH intentionally omitted — it's stable for the session
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sale])

  // Full reset on close so stale state doesn't flash on next open
  useEffect(() => {
    if (!isOpen) {
      setCartItems([])
      setDiscount(0)
      setShowDiscount(false)
      setShowAddItem(false)
      setSearchQuery('')
      setSaleDate(todayPH)
      setPaymentMode('cash')
      setAmountReceived(0)
      setPaidAt(todayPH)
      setShowPaymentDate(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const activeProducts = useMemo(() => products.filter((p) => p.is_active), [products])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    const inCart = new Set(cartItems.map((i) => i.product_id))
    return activeProducts
      .filter((p) => p.name.toLowerCase().includes(q) && !inCart.has(p.id))
      .slice(0, 6)
  }, [searchQuery, activeProducts, cartItems])

  // Pre-compute derived values above JSX
  const containerTotal   = sale && sale.container_enabled ? sale.container_qty * sale.container_price : 0
  const itemsTotal       = cartItems.reduce((sum, i) => sum + i.qty * i.price, 0)
  const grandTotal       = Math.max(0, itemsTotal + containerTotal - discount)
  const liveBal          = Math.max(0, grandTotal - amountReceived)
  const liveIsPaidInFull = liveBal === 0 && cartItems.length > 0
  const showDropdown     = searchResults.length > 0
  const hasNoResults     = searchQuery.trim().length > 0 && searchResults.length === 0
  const customerLabel    = sale?.customer_name || 'Unknown'
  const orderTypeLabel   = sale ? (ORDER_TYPE_LABEL[sale.order_type] ?? sale.order_type) : '—'
  const modalTitle       = readOnly
    ? `Sale #${sale?.id.slice(-6).toUpperCase() ?? ''}`
    : `Edit Sale #${sale?.id.slice(-6).toUpperCase() ?? ''}`
  const isScheduledOrder = sale ? (sale.order_type === 'delivery' || sale.order_type === 'pickup') : false
  const orderLabel       = sale?.order_type === 'delivery' ? 'Delivery' : 'Pickup'

  const setQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCartItems((prev) => prev.filter((i) => i.product_id !== productId))
    } else {
      setCartItems((prev) => prev.map((i) => i.product_id === productId ? { ...i, qty } : i))
    }
  }

  const addProduct = (product: Product) => {
    setCartItems((prev) => [
      ...prev,
      { product_id: product.id, product_name: product.name, qty: 1, price: product.price },
    ])
    setSearchQuery('')
    setShowAddItem(false)
  }

  const handleSave = async () => {
    if (!sale || readOnly) return
    if (cartItems.length === 0) {
      toast({ title: 'Add at least one item', variant: 'destructive' })
      return
    }
    setIsSaving(true)
    try {
      await onSave(sale.id, {
        items: cartItems,
        discount,
        saleDate,
        paymentMode,
        amountReceived,
        paidAt: showPaymentDate ? paidAt : null,
      })
      toast({ title: 'Sale updated' })
      onClose()
    } catch (e) {
      toast({
        title: 'Failed to update sale',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!sale) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="sm"
    >
      <div className="space-y-4">

        {/* Details */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Details</p>
          <div className="grid grid-cols-2 gap-x-4 items-start text-sm">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium truncate">{customerLabel}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{orderTypeLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sale Date</p>
              {readOnly ? (
                <p className="font-medium">{formatDate(saleDate)}</p>
              ) : (
                <DatePickerInput value={saleDate} onChange={setSaleDate} max={todayPH} />
              )}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</p>

          {cartItems.map((item) => readOnly ? (
            <div key={item.product_id} className="flex items-center justify-between">
              <span className="text-sm font-medium">{item.product_name} ×{item.qty}</span>
              <span className="text-sm text-muted-foreground">{formatCurrency(item.qty * item.price)}</span>
            </div>
          ) : (
            /* TASK 2 — single-line item row, no "₱XX ea" subtitle */
            <div key={item.product_id} className="flex items-center gap-2">
              <span className="flex-1 min-w-0 text-sm font-medium truncate">{item.product_name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-6 w-6"
                  onClick={() => setQty(item.product_id, item.qty - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-6 w-6"
                  onClick={() => setQty(item.product_id, item.qty + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-sm font-semibold w-16 text-right shrink-0">
                {formatCurrency(item.price * item.qty)}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => setQty(item.product_id, 0)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {/* Container fee — read-only in both modes */}
          {sale.container_enabled && sale.container_qty > 0 && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm">Container ×{sale.container_qty}</span>
              <span className="text-sm">{formatCurrency(containerTotal)}</span>
            </div>
          )}

          {/* TASK 3 — "+ Add Item" pattern, editable mode only */}
          {!readOnly && (
            !showAddItem ? (
              <button
                type="button"
                onClick={() => setShowAddItem(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors duration-150"
              >
                <Plus className="h-3 w-3" /> Add Item
              </button>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2">
                  {/* Search input — flex-1, same slot as product name */}
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search product…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-6 h-7 text-xs"
                      autoFocus
                    />
                  </div>
                  {/* Stepper placeholder — invisible ±buttons flank visible qty so search input
                      aligns exactly with product-name flex-1 in regular item rows above */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="h-6 w-6 invisible" />
                    <span className="w-6 text-center text-sm text-muted-foreground">1</span>
                    <div className="h-6 w-6 invisible" />
                  </div>
                  {/* Price placeholder — ₱0.00 until product selected */}
                  <span className="w-16 text-right text-sm text-muted-foreground shrink-0">
                    {formatCurrency(0)}
                  </span>
                  {/* Cancel add-item row */}
                  <button
                    type="button"
                    className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    onClick={() => { setShowAddItem(false); setSearchQuery('') }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {showDropdown && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent text-left"
                        onClick={() => addProduct(p)}
                      >
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{formatCurrency(p.price)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {hasNoResults && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-sm px-3 py-2">
                    <p className="text-xs text-muted-foreground">No products found</p>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Discount — editable mode shows toggle/input; view-only shows text only if > 0 */}
        {(!readOnly || discount > 0) && (
          <div className="border-t border-border pt-3 space-y-2">
            {readOnly ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Discount</span>
                <span className="text-sm font-medium text-destructive">−{formatCurrency(discount)}</span>
              </div>
            ) : !showDiscount ? (
              <button
                type="button"
                onClick={() => setShowDiscount(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors duration-150"
              >
                <Plus className="h-3 w-3" /> Add Discount
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex-1">Discount</span>
                <CurrencyInput
                  value={discount}
                  onChange={(v) => setDiscount(v ?? 0)}
                  className="w-28 h-8"
                />
                <button
                  type="button"
                  onClick={() => { setShowDiscount(false); setDiscount(0) }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Grand total */}
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-xl font-bold text-primary">{formatCurrency(grandTotal)}</span>
        </div>

        {/* Payment — 3-column layout: Date | Method | Amount (list-ready) */}
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment</p>

          {/* Column headers */}
          <div className="grid grid-cols-3 gap-x-3 text-xs text-muted-foreground">
            <span>Date</span>
            <span className="text-center">Method</span>
            <span className="text-right">Amount</span>
          </div>

          {/* Payment row — one for now; add more rows here when multi-payment lands */}
          <div className="grid grid-cols-3 gap-x-3 items-baseline text-sm">
            <span className="font-medium">
              {showPaymentDate ? formatDate(paidAt) : '—'}
            </span>
            <span className="font-medium text-center">{PAYMENT_LABELS[paymentMode]}</span>
            <span className="font-medium text-right">
              {amountReceived > 0 ? formatCurrency(amountReceived) : '—'}
            </span>
          </div>

          {/* Balance Due — prominent line below payment rows */}
          {liveBal > 0 && (
            <div className="flex items-baseline justify-between border-t border-border pt-2">
              <span className="text-xs text-muted-foreground">Balance Due</span>
              <span className="text-base font-semibold text-destructive">{formatCurrency(liveBal)}</span>
            </div>
          )}
          {liveIsPaidInFull && (
            <p className="text-sm font-semibold text-right text-green-600">✓ Paid in full</p>
          )}
        </div>

        {/* Delivery / Pickup details — shown for scheduled order types in both modes */}
        {isScheduledOrder && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {orderLabel} Details
            </p>

            {sale.delivery_address && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{sale.delivery_address}</span>
              </div>
            )}

            {sale.scheduled_at && !isFulfilled && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Scheduled for {formatDate(sale.scheduled_at)} {formatTime(sale.scheduled_at)}</span>
              </div>
            )}

            {isFulfilled && sale.fulfilled_at && (
              <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {orderLabel === 'Delivery' ? 'Delivered' : 'Picked up'} on{' '}
                  {formatDate(sale.fulfilled_at)} at {formatTime(sale.fulfilled_at)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer: Print Receipt + optional Reschedule + main action buttons */}
        <div className="border-t border-border pt-3 space-y-2">
          {/* Print Receipt — both modes, both order types */}
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              const isAndroid = /Android/i.test(navigator.userAgent)
              const scheme = isAndroid ? 'my.bluetoothprint.scheme://' : 'bprint://'
              const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
              const platformParam = isAndroid ? '&platform=android' : ''
              const url = `${scheme}${supabaseUrl}/functions/v1/receipt-print?txn_id=${sale.id}${platformParam}`
              const a = document.createElement('a')
              a.setAttribute('href', url)
              a.click()
            }}
          >
            <Printer className="h-4 w-4" />
            Print Receipt
          </Button>

          {/* Reschedule — editable mode + delivery/pickup + onReschedule wired by parent */}
          {!readOnly && isScheduledOrder && onReschedule && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={onReschedule}
            >
              <CalendarClock className="h-4 w-4" />
              Reschedule
            </Button>
          )}

          {/* Cancel / Save  —or—  Close */}
          <div className="flex gap-2">
            {readOnly ? (
              <Button type="button" className="flex-1" onClick={onClose}>
                Close
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={isSaving || cartItems.length === 0}
                  onClick={() => { void handleSave() }}
                >
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </Button>
              </>
            )}
          </div>
        </div>

      </div>
    </Modal>
  )
}
