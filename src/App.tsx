import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import SalesPage from '@/pages/SalesPage'
import ExpensesPage from '@/pages/ExpensesPage'
import CustomersPage from '@/pages/CustomersPage'
import CustomerProfilePage from '@/pages/CustomerProfilePage'
import InventoryPage from '@/pages/InventoryPage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'

function AuthInitializer() {
  useAuth()
  return null
}

function AuthGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isInitialized = useAuthStore((s) => s.isInitialized)

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const user = useAuthStore((s) => s.user)
  const isInitialized = useAuthStore((s) => s.isInitialized)

  return (
    <BrowserRouter>
      <AuthInitializer />
      <Routes>
        <Route
          path="/login"
          element={
            isInitialized && user
              ? <Navigate to="/sales" replace />
              : <LoginPage />
          }
        />
        <Route
          path="/"
          element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }
        >
          <Route index element={<Navigate to="/sales" replace />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:id" element={<CustomerProfilePage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
