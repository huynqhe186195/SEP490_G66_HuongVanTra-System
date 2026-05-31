import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from '../layouts/AdminLayout.jsx'
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage.jsx'
import LoginPage from '../features/auth/pages/LoginPage.jsx'
import OtpVerificationPage from '../features/auth/pages/OtpVerificationPage.jsx'
import ContractsPage from '../features/contracts/pages/ContractsPage.jsx'
import CustomerFormPage from '../features/customers/pages/CustomerFormPage.jsx'
import CustomersPage from '../features/customers/pages/CustomersPage.jsx'
import DashboardPage from '../features/dashboard/pages/DashboardPage.jsx'
import IntegrationsPage from '../features/integrations/pages/IntegrationsPage.jsx'
import InventoryExportPage from '../features/inventory/pages/InventoryExportPage.jsx'
import InventoryBomPage from '../features/inventory/pages/InventoryBomPage.jsx'
import InventoryBomCreatePage from '../features/inventory/pages/InventoryBomCreatePage.jsx'
import InventoryPage from '../features/inventory/pages/InventoryPage.jsx'
import InventoryImportPage from '../features/inventory/pages/InventoryImportPage.jsx'
import InventoryStockPage from '../features/inventory/pages/InventoryStockPage.jsx'
import OrdersPage from '../features/orders/pages/OrdersPage.jsx'
import OrderDetailPage from '../features/orders/pages/OrderDetailPage.jsx'
import QuickOrderPage from '../features/orders/pages/QuickOrderPage.jsx'
import PosPage from '../features/pos/pages/PosPage.jsx'
import ProductFormPage from '../features/products/pages/ProductFormPage.jsx'
import ProductsListPage from '../features/products/pages/ProductsListPage.jsx'
import ProductsPricingPage from '../features/products/pages/ProductsPricingPage.jsx'
import ReportsCustomersPage from '../features/reports/pages/ReportsCustomersPage.jsx'
import ReportsOverviewPage from '../features/reports/pages/ReportsOverviewPage.jsx'
import StaffCreatePage from '../features/staff/pages/StaffCreatePage.jsx'
import StaffDetailPage from '../features/staff/pages/StaffDetailPage.jsx'
import StaffPage from '../features/staff/pages/StaffPage.jsx'

function App() {
  return (
    <Routes>
      <Route index element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/forgot-password/otp" element={<OtpVerificationPage />} />

      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/inventory" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/orders/create" element={<QuickOrderPage />} />
        <Route path="/products" element={<ProductsListPage />} />
        <Route path="/products/pricing" element={<ProductsPricingPage />} />
        <Route path="/products/create" element={<ProductFormPage mode="create" />} />
        <Route path="/products/:id/edit" element={<ProductFormPage mode="edit" />} />
        <Route path="/inventory" element={<InventoryStockPage />} />
        <Route path="/inventory/import" element={<InventoryImportPage />} />
        <Route path="/inventory/export" element={<InventoryExportPage />} />
        <Route path="/inventory/bom" element={<InventoryBomPage />} />
        <Route path="/inventory/bom/create" element={<InventoryBomCreatePage />} />
        <Route path="/inventory/bom/:bomId/edit" element={<InventoryBomCreatePage />} />
        <Route path="/inventory/deduction" element={<InventoryPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/create" element={<CustomerFormPage />} />
        <Route path="/customers/:customerId/edit" element={<CustomerFormPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/staff/create" element={<StaffCreatePage />} />
        <Route path="/staff/:id" element={<StaffDetailPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/reports" element={<ReportsOverviewPage />} />
        <Route path="/reports/customers" element={<ReportsCustomersPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App