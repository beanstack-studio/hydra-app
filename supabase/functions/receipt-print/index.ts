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

// Format clean phone digits for receipt display
function formatPhoneDigits(digits: string): string {
  if (digits.startsWith('09') && digits.length === 11)
    return `${digits.slice(0,4)} ${digits.slice(4,7)} ${digits.slice(7,11)}`
  if (digits.startsWith('0') && !digits.startsWith('09') && digits.length <= 10)
    return `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6,10)}`
  return digits
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

  // ── Fetch station + settings + contacts in parallel ───────────────────────
  const [{ data: station }, { data: settings }, { data: contacts }] = await Promise.all([
    supabase.from('stations').select('name, photo_url').eq('id', sale.station_id).single(),
    supabase.from('station_settings').select('*').eq('station_id', sale.station_id).maybeSingle(),
    supabase.from('station_contacts').select('type, value').eq('station_id', sale.station_id).order('created_at'),
  ])

  console.log('station:', JSON.stringify(station))
  console.log('station_settings:', JSON.stringify(settings))
  console.log('station_contacts:', JSON.stringify(contacts))

  // ── Map variables ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = settings as Record<string, any> | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contactRows = (contacts ?? []) as Array<{ type: string; value: string }>

  const stationName = (station?.name ?? 'Water Station') as string
  const logoUrl     = (station?.photo_url as string | null | undefined) ?? null
  const address     = (s?.business_address as string | null | undefined) ?? null

  // Phone: first mobile or landline entry from station_contacts (stored as clean digits)
  const phoneContact = contactRows.find((c) => c.type === 'mobile' || c.type === 'landline')
  const phone: string | null = phoneContact ? formatPhoneDigits(phoneContact.value) : null

  // Messenger / email for receipt header
  const messengerContact = contactRows.find((c) => c.type === 'messenger')
  const emailContact     = contactRows.find((c) => c.type === 'email')
  const email = emailContact?.value ?? null

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
  // w=100&h=100 keeps the source image crisp (no upscale blur).
  // pad=30 adds 30px whitespace on each side so the logo prints at ~40% canvas width —
  // roughly 1.5× the height of double-size station name text on a 58mm roll.
  if (logoUrl) entries.push({ type:1, path: `https://images.weserv.nl/?url=${encodeURIComponent(logoUrl)}&w=100&h=100&fit=contain&pad=30&bg=ffffff`, align:1 })

  // 2. Station name
  entries.push({ type:0, content: stationName, bold:1, align:1, format:2 })

  // 3. Address
  if (address) entries.push({ type:0, content: address, bold:0, align:1, format:0 })

  // 4. Phone (centered; tries all known field name variants)
  if (phone) entries.push({ type:0, content: phone, bold:0, align:1, format:0 })

  // 5. Messenger
  if (messengerContact) entries.push({ type:0, content: messengerContact.value, bold:0, align:1, format:0 })

  // 6. Email
  if (email) entries.push({ type:0, content: email, bold:0, align:1, format:0 })

  // Two blank lines before ORDER #
  entries.push({ type:0, content:'', bold:0, align:0, format:0 })
  entries.push({ type:0, content:'', bold:0, align:0, format:0 })

  // 8. Order number
  entries.push({ type:0, content:`ORDER #${orderId}`, bold:0, align:1, format:0 })

  // 9. Paid date/time
  entries.push({ type:0, content: paidAt, bold:0, align:1, format:0 })

  // 10. Divider
  entries.push({ type:0, content:'--------------------------------', bold:0, align:0, format:0 })

  // 11. Items — name on its own line, amount right-aligned via padStart (align:0 = normal text)
  for (const item of items) {
    entries.push({ type:0, content: item.name, bold:0, align:0, format:0 })
    entries.push({ type:0, content: `${item.qty} x ${formatCurrency(item.unit)}  =  ${formatCurrency(item.subtotal)}`.padStart(32), bold:0, align:2, format:0 })
  }

  // 12. Container fee (right-aligned via padStart)
  if (containerFee) entries.push({ type:0, content: `Container fee  =  ${formatCurrency(containerFee)}`.padStart(32), bold:0, align:0, format:0 })

  // 13. Divider
  entries.push({ type:0, content:'--------------------------------', bold:0, align:0, format:0 })

  // 14. Total (right-aligned via padStart)
  entries.push({ type:0, content: `TOTAL: ${formatCurrency(total)}`.padStart(32), bold:0, align:0, format:0 })

  // 15. Payment mode (right-aligned via padStart)
  entries.push({ type:0, content: `Payment: ${paymentMethod}`.padStart(32), bold:0, align:2, format:0 })

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
