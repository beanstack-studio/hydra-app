import { createClient } from 'npm:@supabase/supabase-js@2'

// — Constants
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }

// — Helpers

function formatCurrency(amount: number): string {
  const whole = Math.floor(Math.abs(amount))
  return `₱${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function formatPHDate(dateStr: string): string {
  const date = new Date(dateStr)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date)
  const dp: Record<string, string> = {}
  for (const p of parts) dp[p.type] = p.value
  return `${dp.day}-${dp.month}-${dp.year}`
}

function nowPHDate(): string {
  return formatPHDate(new Date().toISOString())
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

// Wraps text at word boundaries to prevent mid-word cuts on thermal printers
function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) {
      current = word
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

// — Handler

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  const url = new URL(req.url)
  const saleIdsParam = url.searchParams.get('sale_ids')

  if (!saleIdsParam) {
    return new Response(JSON.stringify({ error: 'sale_ids required' }), {
      status: 400,
      headers: JSON_HEADERS,
    })
  }

  const saleIds = saleIdsParam.split(',').map((s) => s.trim()).filter(Boolean)

  if (saleIds.length === 0) {
    return new Response(JSON.stringify({ error: 'No sale IDs provided' }), {
      status: 400,
      headers: JSON_HEADERS,
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // — Fetch sales ordered by date ascending
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('*')
    .in('id', saleIds)
    .order('sale_date', { ascending: true })

  if (salesError || !sales || sales.length === 0) {
    return new Response(JSON.stringify({ error: 'Sales not found' }), {
      status: 404,
      headers: JSON_HEADERS,
    })
  }

  const firstSale = sales[0]
  const stationId = firstSale.station_id as string
  const customerName = firstSale.customer_name as string

  // — Fetch station + settings + contacts
  const [{ data: station }, { data: settings }, { data: contacts }] = await Promise.all([
    supabase.from('stations').select('name, photo_url').eq('id', stationId).single(),
    supabase.from('station_settings').select('*').eq('station_id', stationId).maybeSingle(),
    supabase.from('station_contacts').select('type, value').eq('station_id', stationId).order('created_at'),
  ])

  const s = settings as Record<string, unknown> | null
  const contactRows = (contacts ?? []) as Array<{ type: string; value: string }>

  const stationName = (station?.name ?? 'Water Station') as string
  const logoUrl = (station?.photo_url as string | null | undefined) ?? null
  const address = (s?.business_address as string | null | undefined) ?? null

  const phoneContact = contactRows.find((c) => c.type === 'mobile' || c.type === 'landline')
  const phone: string | null = phoneContact ? formatPhoneDigits(phoneContact.value) : null
  const messengerContact = contactRows.find((c) => c.type === 'messenger')

  const entries: object[] = []

  // 1. Logo
  if (logoUrl) {
    entries.push({
      type: 1,
      path: `https://weserv.nl/?url=${encodeURIComponent(logoUrl)}&w=100&h=100&fit=contain&pad=30&bg=ffffff`,
      align: 1,
    })
  }

  // 2. Station name + contact info
  entries.push({ type: 0, content: stationName, bold: 1, align: 1, format: 2 })
  if (address) {
    for (const line of wrapText(address, 32)) {
      entries.push({ type: 0, content: line, bold: 0, align: 1, format: 0 })
    }
  }
  if (phone) entries.push({ type: 0, content: phone, bold: 0, align: 1, format: 0 })
  if (messengerContact) entries.push({ type: 0, content: messengerContact.value, bold: 0, align: 1, format: 0 })

  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })

  // 3. Statement header
  entries.push({ type: 0, content: 'ACCOUNT STATEMENT', bold: 1, align: 1, format: 0 })
  entries.push({ type: 0, content: customerName, bold: 0, align: 1, format: 0 })
  entries.push({ type: 0, content: `As of ${nowPHDate()}`, bold: 0, align: 1, format: 0 })
  entries.push({ type: 0, content: '--------------------------------', bold: 0, align: 0, format: 0 })

  let grandTotal = 0

  // 4. List each sale — separated by dashed lines between dates
  for (let idx = 0; idx < sales.length; idx++) {
    const sale = sales[idx]
    // Dashed separator before each sale entry (after the first, which already has the header dash)
    if (idx > 0) {
      entries.push({ type: 0, content: '--------------------------------', bold: 0, align: 0, format: 0 })
    }

    const saleDate = formatPHDate(sale.sale_date as string)
    const rawItems: Array<{ product_name: string; qty: number; price: number }> =
      Array.isArray(sale.items) && sale.items.length > 0
        ? sale.items
        : [{ product_name: sale.product_name as string, qty: sale.qty as number, price: sale.price_per_piece as number }]

    const itemSummary = rawItems.map((i) => `${i.qty}x ${i.product_name}`).join(', ')
    const total = sale.total_amount as number
    grandTotal += total

    const orderNo = `#${(sale.id as string).slice(-6).toUpperCase()}`

    // Date + Order # on their own lines, then item summary below (wrapped at word boundaries)
    entries.push({ type: 0, content: `${saleDate}  ${orderNo}`, bold: 0, align: 0, format: 0 })
    for (const line of wrapText(itemSummary, 32)) {
      entries.push({ type: 0, content: line, bold: 0, align: 0, format: 0 })
    }
    entries.push({ type: 0, content: formatCurrency(total), bold: 0, align: 2, format: 0 })
  }

  // 5. Grand total
  entries.push({ type: 0, content: '--------------------------------', bold: 0, align: 0, format: 0 })
  entries.push({ type: 0, content: `TOTAL: ${formatCurrency(grandTotal)}`, bold: 1, align: 2, format: 0 })

  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })
  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })
  entries.push({ type: 0, content: 'Thank you!', bold: 0, align: 1, format: 0 })
  entries.push({ type: 0, content: '', bold: 0, align: 0, format: 0 })

  const obj = Object.fromEntries(entries.map((v, i) => [String(i).padStart(2, '0'), v]))
  return new Response(JSON.stringify(obj), { headers: JSON_HEADERS })
})
