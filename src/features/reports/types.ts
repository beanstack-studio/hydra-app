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

export interface ProductTallyRow {
  product_id: string
  product_name: string
  type: 'water' | 'ice' | 'addon'
  units: number
  revenue: number
}

export interface ProductTallyGroup {
  type: 'water' | 'ice' | 'addon'
  label: string
  products: ProductTallyRow[]
  totalUnits: number
  totalRevenue: number
}

export interface ExpenseRanking {
  item: string
  category: string
  total_amount: number
}

export interface OutstandingCustomer {
  customer_name: string
  balance_due: number
}

export interface ReportsData {
  dailyPoints: DailyPoint[]
  expenseSummary: ExpenseSummaryItem[]
  productSales: ProductSalesSummary[]
  totalSalesAmount: number
  totalExpensesAmount: number
  netProfit: number
  outstandingAmount: number
  topProducts: ProductRanking[]
  topCustomers: CustomerRanking[]
  topSupplies: SupplyRanking[]
  topExpenses: ExpenseRanking[]
  topOutstanding: OutstandingCustomer[]
  productTally: ProductTallyGroup[]
}
