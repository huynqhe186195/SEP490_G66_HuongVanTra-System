import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from '../layouts/AdminLayout.jsx'
import ContractsPage from '../features/contracts/pages/ContractsPage.jsx'
import CustomersPage from '../features/customers/pages/CustomersPage.jsx'
import DashboardPage from '../features/dashboard/pages/DashboardPage.jsx'
import IntegrationsPage from '../features/integrations/pages/IntegrationsPage.jsx'
import InventoryExportPage from '../features/inventory/pages/InventoryExportPage.jsx'
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
import ReportsPage from '../features/reports/pages/ReportsPage.jsx'
import StaffPage from '../features/staff/pages/StaffPage.jsx'

function App() {
  return (
    <Routes>
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
        <Route path="/inventory/deduction" element={<InventoryPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/inventory" replace />} />
    </Routes>
  )
}

export default App