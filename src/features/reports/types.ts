export interface DailySalesSummary {
  date: string
  total_sales: number
  total_amount: number
}

export interface ExpenseSummaryItem {
  category: string
  total: number
}

export interface ProductSalesSummary {
  product_name: string
  total_amount: number
}

export interface ProductRanking {
  product_name: string
  qty: number
  order_count: number
  total_amount: number
}

export interface CustomerRanking {
  customer_name: string
  order_count: number
  total_amount: number
}

export interface SupplyRanking {
  item: string
  purchase_count: number
  total_amount: number
}

export interface DailyPoint {
  date: string
  sales: number
  expenses: number
}

export interface ReportsData {
  dailyPoints: DailyPoint[]
  expenseSummary: ExpenseSummaryItem[]
  productSales: ProductSalesSummary[]
  totalSalesAmount: number
  totalExpensesAmount: number
  netProfit: number
  topProducts: ProductRanking[]
  topCustomers: CustomerRanking[]
  topSupplies: SupplyRanking[]
}
