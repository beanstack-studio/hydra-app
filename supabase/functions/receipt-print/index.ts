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

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  const [whole, dec] = Math.abs(amount).toFixed(2).split('.')
  return `P${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`
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

function txt(content: string, bold = 0, align = 0, format = 0): TextLine {
  return { type: 0, content, bold, align, format }
}

function img(path: string, align = 1): ImageLine {
  return { type: 1, path, align }
}

function blank(): TextLine {
  return txt('')
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
      headers: { ...CORS, 'Content-Type': 'application/json' },
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
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // ── Fetch station name + settings in parallel ──────────────────────────────
  const [{ data: station }, { data: settings }] = await Promise.all([
    supabase.from('stations').select('name').eq('id', sale.station_id).single(),
    supabase
      .from('station_settings')
      .select('business_address, business_phone')
      .eq('station_id', sale.station_id)
      .maybeSingle(),
  ])

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

  const logoUrl = Deno.env.get('VITE_LOGO_URL') ?? null
  const stationName: string = station?.name ?? 'Water Station'
  const stationAddress: string | null = settings?.business_address ?? null
  const stationPhone: string | null = settings?.business_phone ?? null

  // ── Build receipt ──────────────────────────────────────────────────────────
  const receipt: ReceiptLine[] = []

  // Logo
  if (logoUrl) receipt.push(img(logoUrl, 1))

  // Station header
  receipt.push(txt(stationName, 1, 1, 2))            // bold | centered | double-width

  if (stationAddress || stationPhone) {
    const headerDetail = [stationAddress, stationPhone].filter(Boolean).join('  |  ')
    receipt.push(txt(headerDetail, 0, 1, 0))          // centered
  }

  receipt.push(blank())

  // Order number + date/time
  receipt.push(txt(`ORDER ${orderNum}`, 0, 1, 0))    // centered
  receipt.push(txt(receiptDateTime, 0, 1, 0))         // centered

  receipt.push(divider())

  // Items
  for (const item of items) {
    const subtotal = item.qty * item.price
    receipt.push(txt(item.product_name, 1))
    receipt.push(txt(`  ${item.qty} x ${formatCurrency(item.price)}  =  ${formatCurrency(subtotal)}`))
  }

  // Container fee
  if (sale.container_enabled && (sale.container_qty as number) > 0) {
    const subtotal = (sale.container_qty as number) * (sale.container_price as number)
    receipt.push(txt('Container', 1))
    receipt.push(txt(`  ${sale.container_qty} x ${formatCurrency(sale.container_price as number)}  =  ${formatCurrency(subtotal)}`))
  }

  // Delivery zone fee
  if (sale.delivery_zone_name && (sale.delivery_zone_price as number) > 0) {
    receipt.push(txt(`Delivery fee (${sale.delivery_zone_name})`, 1))
    receipt.push(txt(`  ${formatCurrency(sale.delivery_zone_price as number)}`))
  }

  receipt.push(divider())

  // Total + payment method
  receipt.push(txt(`TOTAL: ${formatCurrency(sale.total_amount as number)}`, 1))
  receipt.push(txt(`Payment: ${(sale.payment_mode as string).toUpperCase()}`))

  // Delivery / Pickup details
  if (sale.order_type === 'delivery' || sale.order_type === 'pickup') {
    const label = sale.order_type === 'delivery' ? 'Delivery' : 'Pickup'
    if (sale.delivery_address) {
      receipt.push(txt(`${label} address: ${sale.delivery_address}`))
    }
    if (sale.scheduled_at) {
      receipt.push(txt(`${label} time: ${formatPHDateTime(sale.scheduled_at as string)}`))
    }
  }

  // Remarks
  if (sale.remarks) {
    receipt.push(txt(`Remarks: ${sale.remarks}`))
  }

  // Footer
  receipt.push(blank())
  receipt.push(txt('Thank you for your order!', 0, 1))
  receipt.push(blank())  // paper feed

  // Thermer/Bluetooth Print expects JSON_FORCE_OBJECT format — an object with
  // numeric string keys, not a plain array
  const receiptObj = Object.fromEntries(receipt.map((v, i) => [i, v]))
  return new Response(JSON.stringify(receiptObj), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
