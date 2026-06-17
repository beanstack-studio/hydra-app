import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ────────────────────────────────────────────────────────────────

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

function truncate(s: string, max = 32): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s
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

  // Log full rows to confirm field names in Supabase dashboard
  console.log('station:', JSON.stringify(station))
  console.log('station_settings:', JSON.stringify(settings))

  // ── Map variables ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = settings as Record<string, any> | null

  const stationName = (station?.name ?? 'Water Station') as string
  const logoUrl     = (station?.photo_url as string | null | undefined) ?? null
  const address     = (s?.business_address as string | null | undefined) ?? null

  // Try all known field name variants for phone — logs will reveal actual name
  const phone = ((
    s?.business_phone ??
    s?.phone ??
    s?.contact_phone ??
    s?.phone_number ??
    s?.contact_number ??
    s?.mobile
  ) as string | null | undefined) ?? null

  const email = (s?.business_email as string | null | undefined) ?? null

  const orderId = (txnId as string).slice(-6).toUpperCase()
  const paidAt  = formatPHDateTime(
    (sale.paid_at as string | null) ?? (sale.sale_date as string)
  )

  interface Item { name: string; qty: number; unit: number; subtotal: number }
  const rawItems: Array<{ product_name: string; qty: number; price: number }> =
    Array.isArray(sale.items) && sale.items.length > 0
      ? sale.items
      : [{ product_name: sale.product_name as string, qty: sale.qty as number, price: sale.price_per_piece as number }]

  const items: Item[] = rawItems.map((i) => ({
    name:     truncate(i.product_name),
    qty:      i.qty,
    unit:     i.price,
    subtotal: i.qty * i.price,
  }))

  const containerFee: number =
    sale.container_enabled && (sale.container_qty as number) > 0
      ? (sale.container_qty as number) * (sale.container_price as number)
      : 0

  const total         = sale.total_amount as number
  const paymentMethod = (sale.payment_mode as string).toUpperCase()

  const isScheduled = sale.order_type === 'delivery' || sale.order_type === 'pickup'
  const orderLabel  = sale.order_type === 'delivery' ? 'Delivery' : 'Pickup'

  // Raw values for building the detail block
  const rawAddress: string | null = isScheduled && sale.order_type === 'delivery' && sale.delivery_address
    ? (sale.delivery_address as string)
    : null

  const rawScheduledTime: string | null = isScheduled && sale.scheduled_at
    ? formatPHDateTime(sale.scheduled_at as string)
    : null

  const showDetailBlock = isScheduled && (rawAddress !== null || rawScheduledTime !== null)

  const remarks: string | null = sale.remarks
    ? `Remarks: ${sale.remarks as string}`
    : null

  // ── Build entries ──────────────────────────────────────────────────────────

  const entries: object[] = []

  // 1. Logo
  if (logoUrl) entries.push({ type:1, path: `https://images.weserv.nl/?url=${encodeURIComponent(logoUrl)}&w=50&h=50&fit=contain`, align:1 })

  // 2. Station name
  entries.push({ type:0, content: stationName, bold:1, align:1, format:2 })

  // 3. Address
  if (address) entries.push({ type:0, content: address, bold:0, align:1, format:0 })

  // 4. Phone (centered; tries all known field name variants)
  if (phone) entries.push({ type:0, content: phone, bold:0, align:1, format:0 })

  // 5. Email
  if (email) entries.push({ type:0, content: email, bold:0, align:1, format:0 })

  // 6–7. Two blank lines before ORDER #
  entries.push({ type:0, content:'', bold:0, align:0, format:0 })
  entries.push({ type:0, content:'', bold:0, align:0, format:0 })

  // 8. Order number
  entries.push({ type:0, content:`ORDER #${orderId}`, bold:0, align:1, format:0 })

  // 9. Paid date/time
  entries.push({ type:0, content: paidAt, bold:0, align:1, format:0 })

  // 10. Divider
  entries.push({ type:0, content:'--------------------------------', bold:0, align:0, format:0 })

  // 11. Items — name on its own line (bold), amount on next line (left-aligned)
  for (const item of items) {
    entries.push({ type:0, content: item.name, bold:1, align:0, format:0 })
    entries.push({ type:0, content: `${item.qty} x ${formatCurrency(item.unit)}  =  ${formatCurrency(item.subtotal)}`, bold:0, align:0, format:0 })
  }

  // 12. Container fee (left-aligned)
  if (containerFee) entries.push({ type:0, content: `Container fee  =  ${formatCurrency(containerFee)}`, bold:0, align:0, format:0 })

  // 13. Divider
  entries.push({ type:0, content:'--------------------------------', bold:0, align:0, format:0 })

  // 14. Total (left-aligned)
  entries.push({ type:0, content: `TOTAL: ${formatCurrency(total)}`, bold:1, align:0, format:0 })

  // 15. Payment mode (left-aligned)
  entries.push({ type:0, content: `Payment: ${paymentMethod}`, bold:0, align:0, format:0 })

  // 16. Blank line after payment
  entries.push({ type:0, content:'', bold:0, align:0, format:0 })

  // 17–18. Delivery / Pickup detail block
  if (showDetailBlock) {
    entries.push({ type:0, content: `${orderLabel} details:`, bold:0, align:0, format:0 })

    if (sale.order_type === 'delivery') {
      const parts = [rawAddress, rawScheduledTime].filter((v): v is string => v !== null)
      entries.push({ type:0, content: `  ${parts.join(', ')}`, bold:0, align:0, format:0 })
    } else {
      // Pickup — scheduled time only
      if (rawScheduledTime) entries.push({ type:0, content: `  ${rawScheduledTime}`, bold:0, align:0, format:0 })
    }
  }

  // 19. Remarks
  if (remarks) entries.push({ type:0, content: remarks, bold:0, align:0, format:0 })

  // 20–21. Two blank lines before thank you
  entries.push({ type:0, content:'', bold:0, align:0, format:0 })
  entries.push({ type:0, content:'', bold:0, align:0, format:0 })

  // 22. Thank you
  entries.push({ type:0, content:'Thank you for your order!', bold:0, align:1, format:0 })

  // 23. Trailing blank line
  entries.push({ type:0, content:'', bold:0, align:0, format:0 })

  const obj = Object.fromEntries(entries.map((v, i) => [String(i).padStart(2, '0'), v]))
  return new Response(JSON.stringify(obj), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
