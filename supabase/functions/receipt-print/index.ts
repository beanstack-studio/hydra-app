import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ────────────────────────────────────────────────────────────────────

interface TextLine {
  type: 0
  content: string
  bold: number
  align: number
  format: number
}

type ReceiptLine = TextLine

interface CartItem {
  product_name: string
  qty: number
  price: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const DIVIDER = '--------------------------------'
const LINE_WIDTH = 32  // 58mm paper; change to 48 for 80mm

// Allow unauthenticated requests — fetched by Bluetooth Print app, no auth headers
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  const [whole, dec] = Math.abs(amount).toFixed(2).split('.')
  return `₱${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`
}

function formatPHDateTime(dateStr: string): string {
  const date = new Date(dateStr)

  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date)
  const dp: Record<string, string> = {}
  for (const p of dateParts) dp[p.type] = p.value

  // Replace narrow no-break space (U+202F) Intl inserts before AM/PM —
  // corrupts to â€¯ when receiver treats UTF-8 bytes as Latin-1
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date).replace(/\u202F/g, ' ')

  return `${dp.day}-${dp.month}-${dp.year} ${time}`
}

function padLine(left: string, right: string, width = LINE_WIDTH): string {
  const gap = width - left.length - right.length
  return left + (gap > 0 ? ' '.repeat(gap) : ' ') + right
}

function truncate(s: string, max = LINE_WIDTH): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s
}

function txt(content: string, bold = 0, align = 0, format = 0): TextLine {
  return { type: 0, content, bold, align, format }
}

function blank(): TextLine {
  return txt('', 0, 0, 0)
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  const url = new URL(req.url)
  const txnId = url.searchParams.get('txn_id')

  if (!txnId) {
    return new Response(JSON.stringify({ error: 'txn_id required' }), {
      status: 400,
      headers: JSON_HEADERS,
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SERVICE_ROLE_KEY')!,
  )

  // ── Fetch sale ─────────────────────────────────────────────────────────────
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('*')
    .eq('id', txnId)
    .single()

  if (saleError || !sale) {
    return new Response(JSON.stringify({ error: 'Sale not found' }), {
      status: 404,
      headers: JSON_HEADERS,
    })
  }

  // ── Fetch station + settings in parallel ───────────────────────────────────
  const [{ data: station }, { data: settings }] = await Promise.all([
    supabase.from('stations').select('name, photo_url').eq('id', sale.station_id).single(),
    supabase.from('station_settings').select('*').eq('station_id', sale.station_id).maybeSingle(),
  ])

  console.log('station:', JSON.stringify(station))
  console.log('station_settings:', JSON.stringify(settings))

  // ── Resolve items ──────────────────────────────────────────────────────────
  const items: CartItem[] =
    Array.isArray(sale.items) && sale.items.length > 0
      ? (sale.items as CartItem[])
      : [{
          product_name: sale.product_name as string,
          qty:          sale.qty          as number,
          price:        sale.price_per_piece as number,
        }]

  // ── Derived values ─────────────────────────────────────────────────────────
  const orderNum       = `#${(txnId as string).slice(-6).toUpperCase()}`
  const receiptDateTime = formatPHDateTime(
    (sale.paid_at as string | null) ?? (sale.sale_date as string)
  )

  const stationName    = (station?.name ?? 'Water Station') as string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s              = settings as Record<string, any> | null
  const stationAddress = (s?.business_address as string | null | undefined) ?? null
  const stationPhone   = (s?.business_phone   as string | null | undefined) ?? null
  const stationEmail   = (s?.business_email   as string | null | undefined) ?? null

  // ── Build entries (exact order — do not reorder) ───────────────────────────
  const entries: ReceiptLine[] = []

  // 1. Station name
  entries.push(txt(stationName, 1, 1, 2))

  // 2. Address
  if (stationAddress?.trim()) entries.push(txt(stationAddress, 0, 1, 0))

  // 3. Phone
  if (stationPhone?.trim()) entries.push(txt(stationPhone, 0, 1, 0))

  // 4. Email
  if (stationEmail?.trim()) entries.push(txt(stationEmail, 0, 1, 0))

  // 5. Empty line
  entries.push(blank())

  // 6. Order number
  entries.push(txt(`ORDER ${orderNum}`, 0, 1, 0))

  // 7. Paid date/time PHT
  entries.push(txt(receiptDateTime, 0, 1, 0))

  // 8. Divider
  entries.push(txt(DIVIDER, 0, 0, 0))

  // 9+. Items
  for (const item of items) {
    const subtotal = item.qty * item.price
    entries.push(txt(truncate(item.product_name), 1, 0, 0))
    entries.push(txt(padLine(`  ${item.qty} x ${formatCurrency(item.price)}`, formatCurrency(subtotal)), 0, 0, 0))
  }

  // Container fee
  if (sale.container_enabled && (sale.container_qty as number) > 0) {
    const subtotal = (sale.container_qty as number) * (sale.container_price as number)
    entries.push(txt(padLine('  Container fee', formatCurrency(subtotal)), 0, 0, 0))
  }

  // Delivery fee
  if (sale.delivery_zone_name && (sale.delivery_zone_price as number) > 0) {
    entries.push(txt(padLine('  Delivery fee', formatCurrency(sale.delivery_zone_price as number)), 0, 0, 0))
  }

  // Divider
  entries.push(txt(DIVIDER, 0, 0, 0))

  // TOTAL
  entries.push(txt(padLine('TOTAL:', formatCurrency(sale.total_amount as number)), 1, 0, 0))

  // Payment
  entries.push(txt(padLine('Payment:', (sale.payment_mode as string).toUpperCase()), 0, 0, 0))

  // Delivery / Pickup details
  if (sale.order_type === 'delivery' || sale.order_type === 'pickup') {
    const label = sale.order_type === 'delivery' ? 'Delivery' : 'Pickup'
    if (sale.delivery_address) {
      entries.push(txt(`${label} address: ${sale.delivery_address}`, 0, 0, 0))
    }
    if (sale.scheduled_at) {
      entries.push(txt(`${label} time: ${formatPHDateTime(sale.scheduled_at as string)}`, 0, 0, 0))
    }
  }

  // Remarks
  if (sale.remarks) {
    entries.push(txt(`Remarks: ${sale.remarks}`, 0, 0, 0))
  }

  // Empty line
  entries.push(blank())

  // Thank you
  entries.push(txt('Thank you for your order!', 0, 1, 0))

  // Empty line (paper feed)
  entries.push(blank())

  // Thermer/Bluetooth Print expects JSON_FORCE_OBJECT — numeric string keys
  const body = Object.fromEntries(entries.map((v, i) => [i, v]))
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS })
})
