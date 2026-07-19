import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatInTimeZone } from 'date-fns-tz'
import { nowPH, PH_TZ } from '@/lib/utils'
import type { ReportsData, ExpenseSummaryItem, ProductSalesSummary, DailyPoint, ProductRanking, CustomerRanking, SupplyRanking, ExpenseRanking, OutstandingCustomer, ProductTallyRow, ProductTallyGroup } from '../types'

export type ReportMode = 'daily' | 'weekly' | 'monthly' | 'ytd'

// ── Week helpers ──────────────────────────────────────────────────────────────

function getMondayStr(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() // 0=Sun … 6=Sat
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return formatInTimeZone(d, PH_TZ, 'yyyy-MM-dd')
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return formatInTimeZone(d, PH_TZ, 'yyyy-MM-dd')
}

interface UseReportsReturn {
  data: ReportsData | null
  isLoading: boolean
  error: string | null
  mode: ReportMode
  month: number
  year: number
  selectedDate: string
  weekStart: string
  weekEnd: string
  setMode: (m: ReportMode) => void
  setMonth: (m: number) => void
  setYear: (y: number) => void
  setSelectedDate: (d: string) => void
  setWeekStart: (d: string) => void
  goToPrevWeek: () => void
  goToNextWeek: () => void
}

export function useReports(): UseReportsReturn {
  const stationId = useAuthStore((s) => s.stationId)

  const now = nowPH()
  const todayStr = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')

  const [mode,         setMode]         = useState<ReportMode>('daily')
  const [month,        setMonth]        = useState(now.getMonth() + 1)
  const [year,         setYear]         = useState(now.getFullYear())
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [weekStart,    setWeekStart]    = useState(() => getMondayStr(todayStr))

  const weekEnd = addDaysStr(weekStart, 6)

  const goToPrevWeek = useCallback(() => setWeekStart((ws) => addDaysStr(ws, -7)), [])
  const goToNextWeek = useCallback(() => setWeekStart((ws) => addDaysStr(ws, 7)), [])

  const [data, setData] = useState<ReportsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    setIsLoading(true)
    try {
      const todayPH    = nowPH()
      const currentYear = todayPH.getFullYear()

      let startDate: string
      let endDate: string
      let billsMaxMonth: number | null = null
      const includeBills = mode === 'monthly' || mode === 'ytd'

      if (mode === 'daily') {
        startDate = selectedDate
        endDate   = selectedDate
      } else if (mode === 'weekly') {
        startDate = weekStart
        endDate   = weekEnd
      } else if (mode === 'ytd') {
        startDate = `${year}-01-01`
        endDate = year === currentYear
          ? formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')
          : `${year}-12-31`
        billsMaxMonth = year === currentYear ? todayPH.getMonth() + 1 : 12
      } else {
        startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const endMonth = month === 12 ? 1 : month + 1
        const endYear  = month === 12 ? year + 1 : year
        endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
      }

      let billsQuery = supabase
        .from('monthly_bills')
        .select('*')
        .eq('station_id', stationId)
        .eq('year', year)
      if (mode === 'monthly') {
        billsQuery = billsQuery.eq('month', month)
      } else if (billsMaxMonth !== null) {
        billsQuery = billsQuery.lte('month', billsMaxMonth)
      }

      // ── Phase 1: row counts + small tables + outstanding RPC (all parallel) ──
      // Row counts are needed to plan how many 1 000-row batch queries to fire.
      // Bills, products, and the outstanding RPC are small / aggregate so they
      // don't need batching and can be fetched directly here.
      const BATCH = 1000
      const [salesCountRes, expCountRes, billsRes, productsRes, outstandingRpc] = await Promise.all([
        supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .eq('station_id', stationId)
          .gte('sale_date', startDate)
          .lte('sale_date', endDate),
        supabase
          .from('expenses')
          .select('*', { count: 'exact', head: true })
          .eq('station_id', stationId)
          .gte('expense_date', startDate)
          .lte('expense_date', endDate),
        includeBills ? billsQuery : Promise.resolve({ data: [], error: null }),
        supabase
          .from('products')
          .select('id, name, type')
          .eq('station_id', stationId)
          .eq('is_active', true)
          .order('type')
          .order('name'),
        // RPC: SUM(balance_due) + top-5 per customer across ALL time.
        // Replaces the unbounded raw table scan that was silently capped at
        // 1 000 rows by PostgREST (stations with >1 000 lifetime sales would
        // understate their true outstanding balance with no visible error).
        supabase.rpc('get_outstanding_summary', { p_station_id: stationId }),
      ])

      if (salesCountRes.error) throw new Error(salesCountRes.error.message)
      if (expCountRes.error)   throw new Error(expCountRes.error.message)
      if (outstandingRpc.error) throw new Error(outstandingRpc.error.message)
      if (billsRes.error) setError(`Could not load bills: ${billsRes.error.message}`)

      const salesTotal = salesCountRes.count ?? 0
      const expTotal   = expCountRes.count   ?? 0

      // ── Phase 2: fetch all sales + expenses rows in parallel 1 000-row batches ─
      // A period with >1 000 rows (e.g. YTD for a busy station) would silently
      // truncate with a plain .select() — same root cause as the Backwash Tracker
      // bug. Two-phase count→batch guarantees we get every row.
      const salesFetches = Array.from({ length: Math.ceil(salesTotal / BATCH) || 0 }, (_, i) =>
        supabase
          .from('sales')
          .select('id, sale_date, total_amount, status, balance_due, product_name, qty, customer_name, items, amount_received, payment_mode')
          .eq('station_id', stationId)
          .gte('sale_date', startDate)
          .lte('sale_date', endDate)
          .range(i * BATCH, i * BATCH + BATCH - 1)
      )
      const expFetches = Array.from({ length: Math.ceil(expTotal / BATCH) || 0 }, (_, i) =>
        supabase
          .from('expenses')
          .select('*')
          .eq('station_id', stationId)
          .gte('expense_date', startDate)
          .lte('expense_date', endDate)
          .range(i * BATCH, i * BATCH + BATCH - 1)
      )

      const [salesBatches, expBatches] = await Promise.all([
        Promise.all(salesFetches),
        Promise.all(expFetches),
      ])

      for (const res of [...salesBatches, ...expBatches]) {
        if (res.error) throw new Error(res.error.message)
      }

      const sales    = salesBatches.flatMap((r) => r.data ?? [])
      const expenses = expBatches.flatMap((r) => r.data ?? [])
      const bills    = billsRes.data ?? []

      // Parse outstanding RPC result
      type OutstandingSummary = { total: number; top: Array<{ customer_name: string; balance_due: number }> }
      const outstandingSummary = outstandingRpc.data as OutstandingSummary | null

      // ── Daily sales map: full order totals by sale/order date ─────────────
      const dailyOrderMap = new Map<string, number>()
      for (const s of sales) {
        const dateKey = s.sale_date as string
        dailyOrderMap.set(dateKey, (dailyOrderMap.get(dateKey) ?? 0) + (s.total_amount as number))
      }

      // ── Daily expenses map ───────────────────────────────────────────────
      const dailyExpMap = new Map<string, number>()
      for (const e of expenses) {
        const dateKey = formatInTimeZone(new Date(e.expense_date as string), PH_TZ, 'yyyy-MM-dd')
        dailyExpMap.set(dateKey, (dailyExpMap.get(dateKey) ?? 0) + (e.amount as number))
      }

      let dailyPoints: DailyPoint[]
      if (mode === 'weekly') {
        // Always show all 7 days Mon–Sun even if no data
        dailyPoints = Array.from({ length: 7 }, (_, i) => {
          const dateKey = addDaysStr(weekStart, i)
          return {
            date:     dateKey,
            sales:    dailyOrderMap.get(dateKey) ?? 0,
            expenses: dailyExpMap.get(dateKey) ?? 0,
          }
        })
      } else {
        const allDates = new Set([...dailyOrderMap.keys(), ...dailyExpMap.keys()])
        dailyPoints = Array.from(allDates)
          .sort()
          .map((date) => ({
            date,
            sales:    dailyOrderMap.get(date) ?? 0,
            expenses: dailyExpMap.get(date) ?? 0,
          }))
      }

      // ── Expense summary by category ──────────────────────────────────────
      const expenseMap = new Map<string, number>()
      for (const e of expenses) {
        const cat = e.category as string
        expenseMap.set(cat, (expenseMap.get(cat) ?? 0) + (e.amount as number))
      }
      for (const b of bills) {
        const cat = `bill_${b.bill_type as string}`
        expenseMap.set(cat, (expenseMap.get(cat) ?? 0) + (b.amount as number))
      }
      const expenseSummary: ExpenseSummaryItem[] = Array.from(expenseMap.entries())
        .map(([category, total]) => ({ category, total }))

      // ── Product sales summary (donut chart) ─────────────────────────────
      const productMap = new Map<string, number>()
      for (const s of sales) {
        const items = s.items as Array<{ product_name: string; qty: number; price: number }> | null
        if (items && items.length > 0) {
          for (const item of items) {
            const name = item.product_name || 'Unknown'
            productMap.set(name, (productMap.get(name) ?? 0) + item.qty * item.price)
          }
        } else {
          const name = (s.product_name as string) || 'Unknown'
          productMap.set(name, (productMap.get(name) ?? 0) + (s.total_amount as number))
        }
      }
      const productSales: ProductSalesSummary[] = Array.from(productMap.entries())
        .map(([product_name, total_amount]) => ({ product_name, total_amount }))
        .sort((a, b) => b.total_amount - a.total_amount)

      // ── Top products ranking (by qty) ────────────────────────────────────
      const productRankMap = new Map<string, { qty: number; order_count: number; total_amount: number }>()
      for (const s of sales) {
        const items = s.items as Array<{ product_name: string; qty: number; price: number }> | null
        if (items && items.length > 0) {
          for (const item of items) {
            const name = item.product_name || 'Unknown'
            const prev = productRankMap.get(name) ?? { qty: 0, order_count: 0, total_amount: 0 }
            productRankMap.set(name, {
              qty:          prev.qty + item.qty,
              order_count:  prev.order_count + 1,
              total_amount: prev.total_amount + item.qty * item.price,
            })
          }
        } else {
          const name = (s.product_name as string) || 'Unknown'
          const prev = productRankMap.get(name) ?? { qty: 0, order_count: 0, total_amount: 0 }
          productRankMap.set(name, {
            qty:          prev.qty + ((s.qty as number) ?? 0),
            order_count:  prev.order_count + 1,
            total_amount: prev.total_amount + (s.total_amount as number),
          })
        }
      }
      const topProducts: ProductRanking[] = Array.from(productRankMap.entries())
        .map(([product_name, v]) => ({ product_name, ...v }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5)

      // ── Top customers ranking (by total spend) ───────────────────────────
      const customerRankMap = new Map<string, { order_count: number; total_amount: number }>()
      for (const s of sales) {
        const name = (s.customer_name as string) || 'Walk-in'
        const prev = customerRankMap.get(name) ?? { order_count: 0, total_amount: 0 }
        customerRankMap.set(name, {
          order_count: prev.order_count + 1,
          total_amount: prev.total_amount + (s.total_amount as number),
        })
      }
      const topCustomers: CustomerRanking[] = Array.from(customerRankMap.entries())
        .map(([customer_name, v]) => ({ customer_name, ...v }))
        .sort((a, b) => b.total_amount - a.total_amount)
        .slice(0, 5)

      // ── Top supplies ranking (by spend = most replenished) ───────────────
      const supplyRankMap = new Map<string, { purchase_count: number; total_amount: number }>()
      for (const e of expenses) {
        if ((e.category as string) !== 'supplies') continue
        const item = (e.item as string) || 'Unknown'
        const prev = supplyRankMap.get(item) ?? { purchase_count: 0, total_amount: 0 }
        supplyRankMap.set(item, {
          purchase_count: prev.purchase_count + 1,
          total_amount: prev.total_amount + (e.amount as number),
        })
      }
      const topSupplies: SupplyRanking[] = Array.from(supplyRankMap.entries())
        .map(([item, v]) => ({ item, ...v }))
        .sort((a, b) => b.purchase_count - a.purchase_count || b.total_amount - a.total_amount)
        .slice(0, 5)

      // ── Top expenses ranking (by total amount, grouped by item label) ────
      // Unions general expenses + bills (bills only available for monthly/ytd)
      const BILL_LABEL: Record<string, string> = {
        electricity: 'Electricity', water: 'Water', internet: 'Internet',
        rent: 'Rent', maintenance: 'Maintenance', other: 'Other',
      }
      const expenseRankMap = new Map<string, { total_amount: number; category: string }>()
      for (const e of expenses) {
        const item = (e.item as string) || 'Unknown'
        const cat  = (e.category as string) || 'other'
        const prev = expenseRankMap.get(item) ?? { total_amount: 0, category: cat }
        expenseRankMap.set(item, { total_amount: prev.total_amount + (e.amount as number), category: prev.category })
      }
      for (const b of bills) {
        const typeLabel = BILL_LABEL[b.bill_type as string] ?? (b.bill_type as string)
        const desc = (b.description as string | null)?.trim() ?? null
        // Use description when it meaningfully differs from the type label
        const item = desc && desc.toLowerCase() !== typeLabel.toLowerCase() ? desc : typeLabel
        const prev = expenseRankMap.get(item) ?? { total_amount: 0, category: `bill_${b.bill_type as string}` }
        expenseRankMap.set(item, { total_amount: prev.total_amount + (b.amount as number), category: prev.category })
      }
      const topExpenses: ExpenseRanking[] = Array.from(expenseRankMap.entries())
        .map(([item, v]) => ({ item, ...v }))
        .sort((a, b) => b.total_amount - a.total_amount)
        .slice(0, 5)

      // ── Top outstanding balances (all-time, from RPC) ────────────────────
      // Computed server-side by get_outstanding_summary() — no JS aggregation
      // of raw rows needed, and no 1 000-row truncation risk.
      const topOutstanding: OutstandingCustomer[] = (outstandingSummary?.top ?? []).map((t) => ({
        customer_name: t.customer_name,
        balance_due:   Number(t.balance_due),
      }))

      // ── Product tally (grouped by type, promo variants merged) ──────────
      type ProductType = 'water' | 'ice' | 'addon'
      const PROMO_RE = /^\*PROMO\s+/i
      const TYPE_LABELS: Record<ProductType, string> = { water: 'Water', ice: 'Ice', addon: 'Add-ons' }
      const TYPE_ORDER: ProductType[] = ['water', 'ice', 'addon']

      const activeProducts = (productsRes.data ?? []) as Array<{ id: string; name: string; type: ProductType }>

      // Base-name → product lookup (sale items are matched after stripping promo prefix)
      const productByName = new Map<string, { id: string; type: ProductType }>()
      for (const p of activeProducts) productByName.set(p.name, { id: p.id, type: p.type })

      // Init all active products at zero units/revenue
      const tallyById = new Map<string, { units: number; revenue: number }>()
      for (const p of activeProducts) tallyById.set(p.id, { units: 0, revenue: 0 })

      for (const s of sales) {
        const items = s.items as Array<{ product_name: string; qty: number; price: number }> | null
        if (items && items.length > 0) {
          for (const item of items) {
            const baseName = item.product_name.replace(PROMO_RE, '')
            const meta = productByName.get(baseName)
            if (!meta) continue
            const cur = tallyById.get(meta.id) ?? { units: 0, revenue: 0 }
            tallyById.set(meta.id, { units: cur.units + item.qty, revenue: cur.revenue + item.qty * item.price })
          }
        } else {
          const baseName = ((s.product_name as string) || '').replace(PROMO_RE, '')
          const meta = productByName.get(baseName)
          if (!meta) continue
          const cur = tallyById.get(meta.id) ?? { units: 0, revenue: 0 }
          tallyById.set(meta.id, {
            units:   cur.units   + ((s.qty as number) ?? 0),
            revenue: cur.revenue + (s.total_amount as number),
          })
        }
      }

      // Group by type (activeProducts already ordered type → name by DB query)
      const groupRows = new Map<ProductType, ProductTallyRow[]>()
      for (const t of TYPE_ORDER) groupRows.set(t, [])
      for (const p of activeProducts) {
        const tally = tallyById.get(p.id) ?? { units: 0, revenue: 0 }
        groupRows.get(p.type)!.push({ product_id: p.id, product_name: p.name, type: p.type, ...tally })
      }
      const productTally: ProductTallyGroup[] = TYPE_ORDER
        .map((type) => {
          const products = groupRows.get(type) ?? []
          return {
            type,
            label:        TYPE_LABELS[type],
            products,
            totalUnits:   products.reduce((sum, r) => sum + r.units,   0),
            totalRevenue: products.reduce((sum, r) => sum + r.revenue, 0),
          }
        })
        .filter((g) => g.products.length > 0)

      // ── Totals ───────────────────────────────────────────────────────────
      const totalSalesAmount = sales.reduce((sum, s) => sum + (s.total_amount as number), 0)
      const totalExpensesAmount =
        expenses.reduce((s, r) => s + (r.amount as number), 0) +
        bills.reduce((s, r) => s + (r.amount as number), 0)

      // ── Outstanding: all-time total from RPC (NOT date-scoped) ─────────────
      // get_outstanding_summary() sums balance_due across the station's entire
      // history, so this reflects the real current unpaid balance regardless of
      // which reporting period (daily / weekly / monthly / YTD) is selected.
      const outstandingAmount = Number(outstandingSummary?.total ?? 0)

      setData({
        dailyPoints,
        expenseSummary,
        productSales,
        totalSalesAmount,
        totalExpensesAmount,
        netProfit: totalSalesAmount - totalExpensesAmount,
        outstandingAmount,
        topProducts,
        topCustomers,
        topSupplies,
        topExpenses,
        topOutstanding,
        productTally,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setIsLoading(false)
    }
  }, [stationId, mode, month, year, selectedDate, weekStart, weekEnd])

  useEffect(() => { void fetchData() }, [fetchData])

  return {
    data, isLoading, error,
    mode, month, year, selectedDate, weekStart, weekEnd,
    setMode, setMonth, setYear, setSelectedDate, setWeekStart,
    goToPrevWeek, goToNextWeek,
  }
}
