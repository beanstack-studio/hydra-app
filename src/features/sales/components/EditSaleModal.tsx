import { useState, useEffect, useMemo } from 'react'
import { Minus, Plus, Search, X } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import type { Sale, CartItem } from '../types'
import type { Product } from '@/features/settings/types'

const ORDER_TYPE_LABEL: Record<string, string> = {
  'walk-in': 'Walk-in',
  delivery:  'Delivery',
  pickup:    'Pickup',
}

interface EditSaleModalProps {
  sale: Sale | null
  isOpen: boolean
  onClose: () => void
  products: Product[]
  onSave: (saleId: string, items: CartItem[], discount: number) => Promise<void>
}

export function EditSaleModal({ sale, isOpen, onClose, products, onSave }: EditSaleModalProps) {
  const { toast } = useToast()

  const [cartItems,    setCartItems]    = useState<CartItem[]>([])
  const [discount,     setDiscount]     = useState(0)
  const [showDiscount, setShowDiscount] = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [isSaving,     setIsSaving]     = useState(false)

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
    setSearchQuery('')
  }, [isOpen, sale])

  // Full reset on close so stale state doesn't flash on next open
  useEffect(() => {
    if (!isOpen) {
      setCartItems([])
      setDiscount(0)
      setShowDiscount(false)
      setSearchQuery('')
    }
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
  const containerTotal = sale && sale.container_enabled ? sale.container_qty * sale.container_price : 0
  const itemsTotal     = cartItems.reduce((sum, i) => sum + i.qty * i.price, 0)
  const grandTotal     = Math.max(0, itemsTotal + containerTotal - discount)
  const showDropdown   = searchResults.length > 0
  const hasNoResults   = searchQuery.trim().length > 0 && searchResults.length === 0
  const customerLabel  = sale?.customer_name || 'Unknown'
  const orderTypeLabel = sale ? (ORDER_TYPE_LABEL[sale.order_type] ?? sale.order_type) : '—'

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
  }

  const handleSave = async () => {
    if (!sale) return
    if (cartItems.length === 0) {
      toast({ title: 'Add at least one item', variant: 'destructive' })
      return
    }
    setIsSaving(true)
    try {
      await onSave(sale.id, cartItems, discount)
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
      title={`Edit Sale #${sale.id.slice(-6).toUpperCase()}`}
      size="sm"
    >
      <div className="space-y-4">

        {/* Read-only context */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-4 py-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Customer</p>
            <p className="font-medium">{customerLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Order Type</p>
            <p className="font-medium">{orderTypeLabel}</p>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</p>

          {cartItems.map((item) => (
            <div key={item.product_id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.product_name}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} ea</p>
              </div>
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

          {/* Container fee — read-only if present */}
          {sale.container_enabled && sale.container_qty > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">Container ×{sale.container_qty}</p>
                <p className="text-xs">{formatCurrency(sale.container_price)} ea</p>
              </div>
              <span className="text-sm font-semibold w-16 text-right shrink-0">
                {formatCurrency(containerTotal)}
              </span>
              {/* Spacer to align with item rows that have a × button */}
              <div className="h-6 w-6 shrink-0" />
            </div>
          )}

          {/* Add product search */}
          <div className="relative pt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search product to add…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
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
        </div>

        {/* Discount */}
        <div className="border-t border-border pt-3 space-y-2">
          {!showDiscount ? (
            <button
              type="button"
              onClick={() => setShowDiscount(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors duration-150"
            >
              <Plus className="h-3 w-3" /> Add Discount
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground flex-1">Discount</span>
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

        {/* Grand total */}
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-sm font-medium text-muted-foreground">Total</span>
          <span className="text-xl font-bold text-primary">{formatCurrency(grandTotal)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
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
        </div>

      </div>
    </Modal>
  )
}
