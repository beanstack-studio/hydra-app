//import { createClient } from 'https://esm.sh'
//import { createClient } from 'https://skypack.dev'
import { createClient } from 'npm:@supabase/supabase-js@2'

// — Constants
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }

// — Helpers

// Strips out decimals (.00) for clean currency display
function formatCurrency(amount: number): string {
  const whole = Math.floor(Math.abs(amount))
  return `₱${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
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

  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date).replace(/\u202F/g, ' ')

  return `${dp.day}-${dp.month}-${dp.year} ${time}`
}

function formatPhoneDigits(digits: string): string {
  if (digits.startsWith('09') && digits.length === 11) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`
  }
  if (digits.startsWith('0') && !digits.startsWith('09') && digits.length <= 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`
  }
  return digits
}

// — Handler

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

  // — Fetch sale
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

  // — Fetch station + settings + contacts
  const [
    { data: station },
    { data: settings },
    { data: contacts }
  ] = await Promise.all([
    supabase.from('stations').select('name, photo_url').eq('id', sale.station_id).single(),
    supabase.from('station_settings').select('*').eq('station_id', sale.station_id).maybeSingle(),
    supabase.from('station_contacts').select('type, value').eq('station_id', sale.station_id).order('created_at'),
  ])

  const s = settings as Record<string, any> | null
  const contactRows = (contacts ?? []) as Array<{ type: string; value: string }>

  const stationName = (station?.name ?? 'Water Station') as string
  const logoUrl     = (station?.photo_url as string | null | undefined) ?? null
  const address     = (s?.business_address as string | null | undefined) ?? null

  const phoneContact = contactRows.find((c) => c.type === 'mobile' || c.type === 'landline')
  const phone: string | null = phoneContact ? formatPhoneDigits(phoneContact.value) : null

  const messengerContact = contactRows.find((c) => c.type === 'messenger')
  const emailContact     = contactRows.find((c) => c.type === 'email')
  const email: string | null = emailContact ? emailContact.value : null

  const orderId = (txnId as string).slice(-6).toUpperCase()
  const paidAt  = formatPHDateTime((sale.paid_at as string | null) ?? (sale.sale_date as string))

  interface Item { name: string; qty: number; unit: number; subtotal: number }
  const rawItems: Array<{ product_name: string; qty: number; price: number }> =
    Array.isArray(sale.items) && sale.items.length > 0
      ? sale.items
      : [{ product_name: sale.product_name as string, qty: sale.qty as number, price: sale.price_per_piece as number }]

  const items: Item[] = rawItems.map((i) => ({
    name:     i.product_name,
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

  const rawAddress: string | null = isScheduled && sale.order_type === 'delivery' && sale.delivery_address
    ? (sale.delivery_address as string)
    : null

  const rawScheduledTime: string | null = isScheduled && sale.scheduled_at
    ? formatPHDateTime(sale.scheduled_at as string)
    : null

  const showDetailBlock = isScheduled && (rawAddress !== null || rawScheduledTime !== null)
  const remarks: string | null = sale.remarks ? `Remarks: ${sale.remarks as string}` : null

  // — Build entries
  const entries: object[] = []

  // 1. Logo 
  if (logoUrl) {
    entries.push({
      type: 1,
      path: `https://weserv.nl{encodeURIComponent(logoUrl)}&w=100&h=100&fit=contain&pad=30&bg=ffffff`,
      align: 1,
    })
  }

  // 2. Station name
  entries.push({ type: 0, content: stationName, bold: 1, align: 1, format: 2 })

  // 3. Address & Contacts
  if (address) entries.push({ type: 0, content: address, bold: 0, align: 1, format: 0 })
  if (phone) entries.push({ type: 0, content: phone, bold: 0, align: 1, format: 0 })
  if (messengerContact) entries.push({ type: 0, content: messengerContact.value, bold: 0, align: 1, format: 0 })
  if (email) entries.push({ type: 0, content: email, bold: 0, align: 1, format: 0 })

  // Spacing
  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })
  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })

  // Meta order identifier details block
  entries.push({ type: 0, content: `ORDER #${orderId}`, bold: 0, align: 1, format: 0 })
  entries.push({ type: 0, content: paidAt, bold: 0, align: 1, format: 0 })
  entries.push({ type: 0, content: '--------------------------------', bold: 0, align: 0, format: 0 })

  // 11. Print items using Native Application Left-Right text splitting (Type: 4)
  for (const item of items) {
    entries.push({
      type: 4,
      leftText: `${item.qty} x ${item.name}`,
      rightText: formatCurrency(item.subtotal),
      bold: 0,
      format: 0,
    })
  }

  // 12. Container fee using native left-right row splitting structure (Type: 4)
  if (containerFee) {
    entries.push({
      type: 4,
      leftText: '1 x Container Fee',
      rightText: formatCurrency(containerFee),
      bold: 0,
      format: 0,
    })
  }

  // Divider
  entries.push({ type: 0, content: '--------------------------------', bold: 0, align: 0, format: 0 })

  // 14. TOTAL Row (Left/Right split block format)
  entries.push({
    type: 4,
    leftText: 'TOTAL:',
    rightText: formatCurrency(total),
    bold: 1,
    format: 0,
  })

  // Blank line added before payment method row
  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })

  // 15. Payment method Row (Left/Right split block format)
  entries.push({
    type: 4,
    leftText: 'Payment method:',
    rightText: paymentMethod,
    bold: 0,
    format: 0,
  })

  // 17. Logistics block
  if (showDetailBlock) {
    entries.push({ type: 0, content: `${orderLabel} details:`, bold: 0, align: 0, format: 0 })

    if (sale.order_type === 'delivery') {
      const parts = [rawAddress, rawScheduledTime].filter((v): v is string => v !== null)
      entries.push({ type: 0, content: `  ${parts.join(', ')}`, bold: 0, align: 0, format: 0 })
    } else {
      if (rawScheduledTime) entries.push({ type: 0, content: `  ${rawScheduledTime}`, bold: 0, align: 0, format: 0 })
    }
  }

  if (remarks) entries.push({ type: 0, content: remarks, bold: 0, align: 0, format: 0 })

  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })
  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })

  // Footer Message
  entries.push({ type: 0, content: 'Thank you for your order!', bold: 0, align: 1, format: 0 })
  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })

  const obj = Object.fromEntries(entries.map((v, i) => [String(i).padStart(2, '0'), v]))
  return new Response(JSON.stringify(obj), { headers: JSON_HEADERS })
})
