import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ReceiptLine {
  type: number
  content?: string
  bold?: number
  align?: number
  format?: number
}

interface CartItem {
  product_name: string
  qty: number
  price: number
}

const DIVIDER = '--------------------------------'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatCurrency(amount: number): string {
  const abs = Math.abs(amount)
  const [whole, dec] = abs.toFixed(2).split('.')
  const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `P${formatted}.${dec}`
}

function formatPHDate(dateStr: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(new Date(dateStr))
  const p: Record<string, string> = {}
  for (const part of parts) p[part.type] = part.value
  return `${p.day}-${p.month}-${p.year}`
}

function formatPHTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateStr))
}

function txt(content: string, bold = 0, align = 0, format = 0): ReceiptLine {
  return { type: 0, content, bold, align, format }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  const txnId = url.searchParams.get('txn_id')

  if (!txnId) {
    return new Response(JSON.stringify({ error: 'txn_id required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('*')
    .eq('id', txnId)
    .single()

  if (saleError || !sale) {
    return new Response(JSON.stringify({ error: 'Sale not found' }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const [{ data: station }, { data: customer }] = await Promise.all([
    supabase.from('stations').select('name').eq('id', sale.station_id).single(),
    sale.customer_id
      ? supabase.from('customers').select('phone').eq('id', sale.customer_id).single()
      : Promise.resolve({ data: null }),
  ])

  const stationName: string = station?.name ?? 'Water Station'
  const customerPhone: string | null = customer?.phone ?? null

  // Resolve items: use the items JSONB array if present, else fall back to the
  // top-level single-product columns (for older sales recorded before multi-item)
  const items: CartItem[] =
    Array.isArray(sale.items) && sale.items.length > 0
      ? (sale.items as CartItem[])
      : [{ product_name: sale.product_name as string, qty: sale.qty as number, price: sale.price_per_piece as number }]

  const receipt: ReceiptLine[] = []

  // ── Header ──────────────────────────────────────────────────────────────────
  receipt.push(txt(stationName, 1, 1, 2))  // bold | centered | double-width
  receipt.push(txt(`${formatPHDate(sale.sale_date)}  ${formatPHTime(sale.sale_date)}`, 0, 1))
  receipt.push(txt(DIVIDER))

  // ── Customer ─────────────────────────────────────────────────────────────────
  receipt.push(txt(`Customer: ${sale.customer_name}`))
  if (customerPhone) {
    receipt.push(txt(`Phone:    ${customerPhone}`))
  }
  receipt.push(txt(DIVIDER))

  // ── Items ────────────────────────────────────────────────────────────────────
  for (const item of items) {
    const subtotal = item.qty * item.price
    receipt.push(txt(item.product_name, 1))
    receipt.push(txt(`  ${item.qty} x ${formatCurrency(item.price)}  =  ${formatCurrency(subtotal)}`))
  }

  if (sale.container_enabled && (sale.container_qty as number) > 0) {
    const subtotal = (sale.container_qty as number) * (sale.container_price as number)
    receipt.push(txt('Container', 1))
    receipt.push(txt(`  ${sale.container_qty} x ${formatCurrency(sale.container_price as number)}  =  ${formatCurrency(subtotal)}`))
  }

  if (sale.delivery_zone_name && (sale.delivery_zone_price as number) > 0) {
    receipt.push(txt(`Delivery fee (${sale.delivery_zone_name})`, 1))
    receipt.push(txt(`  ${formatCurrency(sale.delivery_zone_price as number)}`))
  }

  receipt.push(txt(DIVIDER))

  // ── Total & payment ──────────────────────────────────────────────────────────
  receipt.push(txt(`TOTAL: ${formatCurrency(sale.total_amount as number)}`, 1))
  receipt.push(txt(`Payment: ${(sale.payment_mode as string).toUpperCase()}`))

  // ── Delivery / Pickup details ────────────────────────────────────────────────
  if (sale.order_type === 'delivery' || sale.order_type === 'pickup') {
    receipt.push(txt(DIVIDER))
    const label = sale.order_type === 'delivery' ? 'Delivery' : 'Pickup'
    receipt.push(txt(`${label} Details`, 1))
    if (sale.delivery_address) {
      receipt.push(txt(`Address: ${sale.delivery_address}`))
    }
    if (sale.scheduled_at) {
      receipt.push(txt(`Time:    ${formatPHDate(sale.scheduled_at as string)} ${formatPHTime(sale.scheduled_at as string)}`))
    }
  }

  // ── Remarks ──────────────────────────────────────────────────────────────────
  if (sale.remarks) {
    receipt.push(txt(DIVIDER))
    receipt.push(txt(`Remarks: ${sale.remarks}`))
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  receipt.push(txt(DIVIDER))
  receipt.push(txt('Thank you for your order!', 0, 1))
  receipt.push(txt('', 0, 1))  // trailing newline / feed

  return new Response(JSON.stringify(receipt), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
