import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatInTimeZone } from 'date-fns-tz'
import { nowPH, PH_TZ } from '@/lib/utils'
import type { ReportsData, ExpenseSummaryItem, ProductSalesSummary, DailyPoint } from '../types'

interface UseReportsReturn {
  data: ReportsData | null
  isLoading: boolean
  error: string | null
  month: number
  year: number
  setMonth: (m: number) => void
  setYear: (y: number) => void
}

export function useReports(): UseReportsReturn {
  const stationId = useAuthStore((s) => s.stationId)

  const now = nowPH()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const [data, setData] = useState<ReportsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    setIsLoading(true)
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endMonth = month === 12 ? 1 : month + 1
      const endYear  = month === 12 ? year + 1 : year
      const endDate  = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

      const [salesRes, expensesRes, billsRes] = await Promise.all([
        supabase
          .from('sales')
          .select('sale_date, total_amount, status, product_name')
          .eq('station_id', stationId)
          .gte('sale_date', startDate)
          .lt('sale_date', endDate),
        supabase
          .from('expenses')
          .select('*')
          .eq('station_id', stationId)
          .gte('expense_date', startDate)
          .lt('expense_date', endDate),
        supabase
          .from('monthly_bills')
          .select('*')
          .eq('station_id', stationId)
          .eq('month', month)
          .eq('year', year),
      ])

      const sales    = salesRes.data    ?? []
      const expenses = expensesRes.data ?? []
      const bills    = billsRes.data    ?? []

      const queryError = salesRes.error?.message || expensesRes.error?.message
      if (queryError) setError(`Could not load all data: ${queryError}`)

      // ── Daily sales map ──────────────────────────────────────────────────
      const dailySalesMap = new Map<string, number>()
      for (const s of sales) {
        const dateKey = formatInTimeZone(new Date(s.sale_date as string), PH_TZ, 'yyyy-MM-dd')
        dailySalesMap.set(dateKey, (dailySalesMap.get(dateKey) ?? 0) + (s.total_amount as number))
      }

      // ── Daily expenses map ───────────────────────────────────────────────
      const dailyExpMap = new Map<string, number>()
      for (const e of expenses) {
        const dateKey = formatInTimeZone(new Date(e.expense_date as string), PH_TZ, 'yyyy-MM-dd')
        dailyExpMap.set(dateKey, (dailyExpMap.get(dateKey) ?? 0) + (e.amount as number))
      }

      // Merge into daily points (union of dates)
      const allDates = new Set([...dailySalesMap.keys(), ...dailyExpMap.keys()])
      const dailyPoints: DailyPoint[] = Array.from(allDates)
        .sort()
        .map((date) => ({
          date,
          sales: dailySalesMap.get(date) ?? 0,
          expenses: dailyExpMap.get(date) ?? 0,
        }))

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

      // ── Product sales summary ────────────────────────────────────────────
      const productMap = new Map<string, number>()
      for (const s of sales) {
        const name = (s.product_name as string) || 'Unknown'
        productMap.set(name, (productMap.get(name) ?? 0) + (s.total_amount as number))
      }
      const productSales: ProductSalesSummary[] = Array.from(productMap.entries())
        .map(([product_name, total_amount]) => ({ product_name, total_amount }))
        .sort((a, b) => b.total_amount - a.total_amount)

      // ── Totals ───────────────────────────────────────────────────────────
      const totalExpensesAmount =
        expenses.reduce((s, r) => s + (r.amount as number), 0) +
        bills.reduce((s, r) => s + (r.amount as number), 0)
      const totalSalesAmount = sales.reduce((s, r) => s + (r.total_amount as number), 0)

      setData({
        dailyPoints,
        expenseSummary,
        productSales,
        totalSalesAmount,
        totalExpensesAmount,
        netProfit: totalSalesAmount - totalExpensesAmount,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setIsLoading(false)
    }
  }, [stationId, month, year])

  useEffect(() => { void fetchData() }, [fetchData])

  return { data, isLoading, error, month, year, setMonth, setYear }
}
