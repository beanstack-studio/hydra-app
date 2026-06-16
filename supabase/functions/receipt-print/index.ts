import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ────────────────────────────────────────────────────────────────────

interface TextLine {
  type: 0
  content: string
  bold: number
  align: number
  format: number
}

interface ImageLine {
  type: 1
  path: string
  align: number
}

type ReceiptLine = TextLine | ImageLine

interface CartItem {
  product_name: string
  qty: number
  price: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const DIVIDER = '--------------------------------'

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

  // Replace narrow no-break space (U+202F) that Intl inserts before AM/PM —
  // it corrupts to â€¯ when the receiver treats the UTF-8 bytes as Latin-1
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date).replace(/\u202F/g, ' ')

  return `${dp.day}-${dp.month}-${dp.year} ${time}`
}

const LINE_WIDTH = 32  // 58mm paper; change to 48 for 80mm

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

function img(path: string, align = 1): ImageLine {
  return { type: 1, path, align }
}

function blank(): TextLine {
  return { type: 0, content: '', bold: 0, align: 0, format: 0 }
}

function divider(): TextLine {
  return txt(DIVIDER)
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
  // stations.photo_url  = logo image
  // station_settings.*  = business_address, business_phone (log all cols to debug)
  const [{ data: station }, { data: settings }] = await Promise.all([
    supabase
      .from('stations')
      .select('name, photo_url')
      .eq('id', sale.station_id)
      .single(),
    supabase
      .from('station_settings')
      .select('*')
      .eq('station_id', sale.station_id)
      .maybeSingle(),
  ])

  // Log full rows so column names are visible in Supabase function logs
  console.log('station:', JSON.stringify(station))
  console.log('station_settings:', JSON.stringify(settings))

  // ── Resolve items ──────────────────────────────────────────────────────────
  // Use items JSONB array when present; fall back to single-product columns
  // (older sales recorded before multi-item support)
  const items: CartItem[] =
    Array.isArray(sale.items) && sale.items.length > 0
      ? (sale.items as CartItem[])
      : [{
          product_name: sale.product_name as string,
          qty: sale.qty as number,
          price: sale.price_per_piece as number,
        }]

  // ── Order number — last 6 chars of UUID, uppercase ─────────────────────────
  const orderNum = `#${(txnId as string).slice(-6).toUpperCase()}`

  // ── Date/time shown on receipt (paid_at preferred, falls back to sale_date) ─
  const receiptDateTime = formatPHDateTime(
    (sale.paid_at as string | null) ?? (sale.sale_date as string)
  )

  // Logo from stations.photo_url (set in Business Settings → profile photo)
  const logoUrl        = (station?.photo_url as string | null | undefined) ?? null
  const stationName    = (station?.name ?? 'Water Station') as string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s              = settings as Record<string, any> | null
  const stationAddress = (s?.business_address as string | null | undefined) ?? null
  const stationPhone   = (s?.business_phone   as string | null | undefined) ?? null

  // ── Build receipt ──────────────────────────────────────────────────────────
  const receipt: ReceiptLine[] = []

  // 1. Logo — from stations.photo_url
  if (logoUrl?.trim()) receipt.push(img(logoUrl, 1))

  // 2. Empty line
  receipt.push(blank())

  // 3. Station name
  receipt.push(txt(stationName, 1, 1, 2))   // bold | centered | double-width

  // 4. Address
  if (stationAddress?.trim()) receipt.push(txt(stationAddress, 0, 1, 0))

  // 5. Phone
  if (stationPhone?.trim()) receipt.push(txt(stationPhone, 0, 1, 0))

  // 7. Empty line
  receipt.push(blank())

  // 8. Order number
  receipt.push(txt(`ORDER ${orderNum}`, 0, 1, 0))

  // 9. Date/time paid
  receipt.push(txt(receiptDateTime, 0, 1, 0))

  // 10. Divider
  receipt.push(divider())

  // 11. Items
  for (const item of items) {
    const subtotal = item.qty * item.price
    const qtyLine  = `${item.qty} x ${formatCurrency(item.price)}`
    receipt.push(txt(truncate(item.product_name), 1, 0, 0))
    receipt.push(txt(padLine(qtyLine, formatCurrency(subtotal)), 0, 0, 0))
  }

  // 12. Container fee
  if (sale.container_enabled && (sale.container_qty as number) > 0) {
    const subtotal = (sale.container_qty as number) * (sale.container_price as number)
    const qtyLine  = `${sale.container_qty} x ${formatCurrency(sale.container_price as number)}`
    receipt.push(txt('Container', 1, 0, 0))
    receipt.push(txt(padLine(qtyLine, formatCurrency(subtotal)), 0, 0, 0))
  }

  // 13. Delivery zone fee
  if (sale.delivery_zone_name && (sale.delivery_zone_price as number) > 0) {
    const zoneName = truncate(`Delivery (${sale.delivery_zone_name})`)
    receipt.push(txt(padLine(zoneName, formatCurrency(sale.delivery_zone_price as number)), 0, 0, 0))
  }

  // 14. Divider
  receipt.push(divider())

  // 15. Total
  receipt.push(txt(padLine('TOTAL:', formatCurrency(sale.total_amount as number)), 1, 0, 0))

  // 16. Payment method
  receipt.push(txt(padLine('Payment:', (sale.payment_mode as string).toUpperCase()), 0, 0, 0))

  // 17. Delivery / Pickup details
  if (sale.order_type === 'delivery' || sale.order_type === 'pickup') {
    const label = sale.order_type === 'delivery' ? 'Delivery' : 'Pickup'
    if (sale.delivery_address) {
      receipt.push(txt(`${label} address: ${sale.delivery_address}`, 0, 0, 0))
    }
    if (sale.scheduled_at) {
      receipt.push(txt(`${label} time: ${formatPHDateTime(sale.scheduled_at as string)}`, 0, 0, 0))
    }
  }

  // 18. Remarks
  if (sale.remarks) {
    receipt.push(txt(`Remarks: ${sale.remarks}`, 0, 0, 0))
  }

  // 19. Empty line
  receipt.push(blank())

  // 20. Thank you
  receipt.push(txt('Thank you for your order!', 0, 1, 0))

  // 21. Empty line (paper feed)
  receipt.push(blank())

  // Thermer/Bluetooth Print expects JSON_FORCE_OBJECT format — an object with
  // numeric string keys, not a plain array
  const receiptObj = Object.fromEntries(receipt.map((v, i) => [i, v]))
  return new Response(JSON.stringify(receiptObj), { headers: JSON_HEADERS })
})
