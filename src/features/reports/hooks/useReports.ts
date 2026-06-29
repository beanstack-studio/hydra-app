import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatInTimeZone } from 'date-fns-tz'
import { nowPH, PH_TZ } from '@/lib/utils'
import type { ReportsData, ExpenseSummaryItem, ProductSalesSummary, DailyPoint, ProductRanking, CustomerRanking, SupplyRanking } from '../types'

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
  const todayStr = formatInTimeZone(now, PH_TZ, 'yyyy-MM-dd')

  const [mode,         setMode]         = useState<ReportMode>('monthly')
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
          ? formatInTimeZone(todayPH, PH_TZ, 'yyyy-MM-dd')
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

      const [paymentsRes, salesRes, expensesRes, billsRes] = await Promise.all([
        supabase
          .from('sale_payments')
          .select('paid_at, amount')
          .eq('station_id', stationId)
          .gte('paid_at', startDate)
          .lte('paid_at', endDate),
        supabase
          .from('sales')
          .select('sale_date, total_amount, status, product_name, qty, customer_name, items')
          .eq('station_id', stationId)
          .gte('sale_date', startDate)
          .lte('sale_date', endDate),
        supabase
          .from('expenses')
          .select('*')
          .eq('station_id', stationId)
          .gte('expense_date', startDate)
          .lte('expense_date', endDate),
        includeBills ? billsQuery : Promise.resolve({ data: [], error: null }),
      ])

      const payments = paymentsRes.data ?? []
      const sales    = salesRes.data    ?? []
      const expenses = expensesRes.data ?? []
      const bills    = billsRes.data    ?? []

      const queryError = paymentsRes.error?.message || salesRes.error?.message || expensesRes.error?.message
      if (queryError) setError(`Could not load all data: ${queryError}`)

      // ── Daily payments map (revenue = cash actually received) ────────────
      const dailySalesMap = new Map<string, number>()
      for (const p of payments) {
        const dateKey = p.paid_at as string  // stored as YYYY-MM-DD
        dailySalesMap.set(dateKey, (dailySalesMap.get(dateKey) ?? 0) + (p.amount as number))
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
            sales:    dailySalesMap.get(dateKey) ?? 0,
            expenses: dailyExpMap.get(dateKey) ?? 0,
          }
        })
      } else {
        const allDates = new Set([...dailySalesMap.keys(), ...dailyExpMap.keys()])
        dailyPoints = Array.from(allDates)
          .sort()
          .map((date) => ({
            date,
            sales:    dailySalesMap.get(date) ?? 0,
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

      // ── Totals ───────────────────────────────────────────────────────────
      const totalExpensesAmount =
        expenses.reduce((s, r) => s + (r.amount as number), 0) +
        bills.reduce((s, r) => s + (r.amount as number), 0)
      const totalSalesAmount = payments.reduce((s, p) => s + (p.amount as number), 0)

      setData({
        dailyPoints,
        expenseSummary,
        productSales,
        totalSalesAmount,
        totalExpensesAmount,
        netProfit: totalSalesAmount - totalExpensesAmount,
        topProducts,
        topCustomers,
        topSupplies,
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
