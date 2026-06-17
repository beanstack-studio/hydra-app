import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// — Constants
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }

// — Helpers

// Strips out decimals (.00) for clean receipt line styling
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

function truncate(s: string, max = 32): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s
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

// Fixed 3-Column Grid alignment helper function (Total width = 32)
function formatThreeColumns(qtyNum: number, itemName: string, priceStr: string): string {
  const qtyCol  = `${qtyNum}x`.padEnd(2).slice(0, 2)     // Width: 2
  const priceCol = priceStr.padStart(5).slice(-5)       // Width: 5
  
  // 32 total - 2 (qty) - 1 (space) - 5 (price) = 24 left for item text
  const itemColWidth = 24 
  let itemCol = itemName.trim()
  if (itemCol.length > itemColWidth) {
    itemCol = itemCol.slice(0, itemColWidth - 3) + '...'
  } else {
    itemCol = itemCol.padEnd(itemColWidth)
  }

  return `${qtyCol} ${itemCol}${priceCol}`
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

  // — Fetch station data
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

  // — Build entries array
  const entries: object[] = []

  // 1. Scaled down micro-logo
  if (logoUrl) {
    entries.push({
      type: 1,
      path: `https://weserv.nl{encodeURIComponent(logoUrl)}&w=45&h=45&fit=contain&pad=5&bg=ffffff`,
      align: 1,
    })
  }

  // 2. Station Identity Header
  entries.push({ type: 0, content: stationName, bold: 1, align: 1, format: 2 })
  if (address) entries.push({ type: 0, content: address, bold: 0, align: 1, format: 0 })
  if (phone) entries.push({ type: 0, content: phone, bold: 0, align: 1, format: 0 })
  if (messengerContact) entries.push({ type: 0, content: messengerContact.value, bold: 0, align: 1, format: 0 })
  if (email) entries.push({ type: 0, content: email, bold: 0, align: 1, format: 0 })

  // Spacing
  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })
  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })

  // Meta metadata info
  entries.push({ type: 0, content: `ORDER #${orderId}`, bold: 0, align: 1, format: 0 })
  entries.push({ type: 0, content: paidAt, bold: 0, align: 1, format: 0 })
  entries.push({ type: 0, content: '--------------------------------', bold: 0, align: 0, format: 0 })

  // 11. Loop and display 3-column aligned items
  for (const item of items) {
    const formattedLine = formatThreeColumns(item.qty, item.name, formatCurrency(item.subtotal))
    entries.push({
      type: 0,
      content: formattedLine,
      bold: 0,
      align: 0,
      format: 0,
    })
  }

  // 12. Justified container fee layout configuration
  if (containerFee) {
    const formattedFeeLine = formatThreeColumns(1, 'Container Fee', formatCurrency(containerFee))
    entries.push({
      type: 0,
      content: formattedFeeLine,
      bold: 0,
      align: 0,
      format: 0,
    })
  }

  // Divider
  entries.push({ type: 0, content: '--------------------------------', bold: 0, align: 0, format: 0 })

  // 14. Total Row - Fixed alignment via native printer setting
  entries.push({
    type: 0,
    content: `TOTAL: ${formatCurrency(total)}`,
    bold: 0,
    align: 2,
    format: 0,
  })

  // 15. Payment Row - Fixed alignment via native printer setting
  entries.push({
    type: 0,
    content: `Payment: ${paymentMethod}`,
    bold: 0,
    align: 2,
    format: 0,
  })

  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })

  // 17. Logistics Information Block
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
