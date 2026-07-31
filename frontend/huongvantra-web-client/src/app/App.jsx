import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from '../layouts/AdminLayout.jsx'
import HomeRedirect from './HomeRedirect.jsx'
import RootRedirect from './RootRedirect.jsx'
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage.jsx'
import LoginPage from '../features/auth/pages/LoginPage.jsx'
import OtpVerificationPage from '../features/auth/pages/OtpVerificationPage.jsx'
import ContractsPage from '../features/contracts/pages/ContractsPage.jsx'
import ContractFormPage from '../features/contracts/pages/ContractFormPage.jsx'
import ContractDetailPage from '../features/contracts/pages/ContractDetailPage.jsx'
import CustomerFormPage from '../features/customers/pages/CustomerFormPage.jsx'
import CustomerAddressesPage from '../features/customers/pages/CustomerAddressesPage.jsx'
import CustomersPage from '../features/customers/pages/CustomersPage.jsx'
import DashboardPage from '../features/dashboard/pages/DashboardPage.jsx'
import CostProfitReportPage from '../features/accounting/pages/CostProfitReportPage.jsx'
import IntegrationsPage from '../features/integrations/pages/IntegrationsPage.jsx'
import InventorySyncMonitorPage from '../features/integrations/pages/InventorySyncMonitorPage.jsx'
import InventoryExportPage from '../features/inventory/pages/InventoryExportPage.jsx'
import InventoryBomPage from '../features/inventory/pages/InventoryBomPage.jsx'
import InventoryBomCreatePage from '../features/inventory/pages/InventoryBomCreatePage.jsx'
import InventoryPage from '../features/inventory/pages/InventoryPage.jsx'
import InventoryBatchesPage from '../features/inventory/pages/InventoryBatchesPage.jsx'
import InventoryImportCreatePage from '../features/inventory/pages/InventoryImportCreatePage.jsx'
import InventoryImportPage from '../features/inventory/pages/InventoryImportPage.jsx'
import InventoryLedgerPage from '../features/inventory/pages/InventoryLedgerPage.jsx'
import InventoryReportsPage from '../features/inventory/pages/InventoryReportsPage.jsx'
import InventoryReturnsPage from '../features/inventory/pages/InventoryReturnsPage.jsx'
import InventoryStockPage from '../features/inventory/pages/InventoryStockPage.jsx'
import InventoryStocktakePage from '../features/inventory/pages/InventoryStocktakePage.jsx'
import InventoryStatisticsPage from '../features/inventory/pages/InventoryStatisticsPage.jsx'
import ProfilePage from '../features/profile/pages/ProfilePage.jsx'
import OrdersPage from '../features/orders/pages/OrdersPage.jsx'
import ExchangeOrdersPage from '../features/orders/pages/ExchangeOrdersPage.jsx'
import ReturnOrderDetailPage from '../features/orders/pages/ReturnOrderDetailPage.jsx'
import CodOrdersPage from '../features/orders/pages/CodOrdersPage.jsx'
import B2BDebtsPage from '../features/orders/pages/B2BDebtsPage.jsx'
import StockDeductQueuePage from '../features/inventory/pages/StockDeductQueuePage.jsx'
import ReturnInspectionsPage from '../features/inventory/pages/ReturnInspectionsPage.jsx'
import StockAdjustmentRequestsPage from '../features/inventory/pages/StockAdjustmentRequestsPage.jsx'
import SupplierReceiptsPage from '../features/inventory/pages/SupplierReceiptsPage.jsx'
import ProductionOrdersPage from '../features/inventory/pages/ProductionOrdersPage.jsx'
import CustomBundlesPage from '../features/inventory/pages/CustomBundlesPage.jsx'
import SuppliersPage from '../features/inventory/pages/SuppliersPage.jsx'
import SupplierProductsPage from '../features/inventory/pages/SupplierProductsPage.jsx'
import OrderDetailPage from '../features/orders/pages/OrderDetailPage.jsx'
import CustomerDisplayPage from '../features/pos/pages/CustomerDisplayPage.jsx'
import PosPage from '../features/pos/pages/PosPage.jsx'
import PosCashSessionsPage from '../features/pos/pages/PosCashSessionsPage.jsx'
import PosTransferQrPage from '../features/pos/pages/PosTransferQrPage.jsx'
import ReturnOrderPage from '../features/pos/pages/ReturnOrderPage.jsx'
import ProductApprovalsPage from '../features/products/pages/ProductApprovalsPage.jsx'
import ProductDeletionRequestsPage from '../features/products/pages/ProductDeletionRequestsPage.jsx'
import ProductsListPage from '../features/products/pages/ProductsListPage.jsx'
import ProductsCategoriesPage from '../features/products/pages/ProductsCategoriesPage.jsx'
import ProductsPricingPage from '../features/products/pages/ProductsPricingPage.jsx'
import ReportsCustomersPage from '../features/reports/pages/ReportsCustomersPage.jsx'
import ReportsOverviewPage from '../features/reports/pages/ReportsOverviewPage.jsx'
import StaffCreatePage from '../features/staff/pages/StaffCreatePage.jsx'
import StaffDetailPage from '../features/staff/pages/StaffDetailPage.jsx'
import StaffPage from '../features/staff/pages/StaffPage.jsx'
import ShiftManagePage from '../features/shifts/pages/ShiftManagePage.jsx'
import MyShiftsPage from '../features/shifts/pages/MyShiftsPage.jsx'
import MembershipTiersPage from '../features/admin/pages/MembershipTiersPage.jsx'
import PromotionsPage from '../features/admin/pages/PromotionsPage.jsx'
import SystemActivityLogPage from '../features/admin/pages/SystemActivityLogPage.jsx'
import AccessControlPage from '../features/iam/pages/AccessControlPage.jsx'
import UsersPage from '../features/iam/pages/UsersPage.jsx'

function App() {
  return (
    <Routes>
      <Route index element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/forgot-password/otp" element={<OtpVerificationPage />} />
      <Route path="/customer-display" element={<CustomerDisplayPage />} />

      <Route element={<AdminLayout />}>
        <Route index element={<HomeRedirect />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/accounting/cost-profit" element={<CostProfitReportPage />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/pos/cash-sessions" element={<PosCashSessionsPage />} />
        <Route path="/pos/receipt/print" element={<Navigate to="/pos" replace />} />
        <Route path="/pos/payment/qr" element={<PosTransferQrPage />} />
        <Route path="/pos/returns/:orderId" element={<ReturnOrderPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/exchange" element={<ExchangeOrdersPage />} />
        <Route path="/orders/returns" element={<Navigate to="/orders/exchange?tab=returns" replace />} />
        <Route path="/orders/returns/:id" element={<ReturnOrderDetailPage />} />
        <Route path="/orders/cod" element={<CodOrdersPage />} />
        <Route path="/orders/b2b-debts" element={<B2BDebtsPage />} />
        <Route path="/orders/stock-deduct" element={<StockDeductQueuePage />} />
        <Route path="/orders/create" element={<Navigate to="/pos" replace />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/inventory/products" element={<ProductsListPage />} />
        <Route path="/products/pricing" element={<ProductsPricingPage />} />
        <Route path="/products/categories" element={<ProductsCategoriesPage />} />
        <Route path="/inventory/products/create" element={<ProductApprovalsPage />} />
        <Route path="/inventory/product-approvals" element={<ProductApprovalsPage />} />
        <Route path="/inventory/product-deletion-requests" element={<ProductDeletionRequestsPage />} />
        <Route path="/products/:id/edit" element={<Navigate to="/inventory/products" replace />} />
        <Route path="/inventory" element={<InventoryStockPage />} />
        <Route path="/inventory/statistics" element={<InventoryStatisticsPage />} />
        <Route path="/inventory/stock-requests" element={<StockAdjustmentRequestsPage />} />
        <Route path="/inventory/batches" element={<InventoryBatchesPage />} />
        <Route path="/inventory/supplier-receipts" element={<SupplierReceiptsPage />} />
        <Route path="/inventory/supplier-receipts/:receiptId" element={<SupplierReceiptsPage />} />
        <Route path="/inventory/import" element={<InventoryImportPage />} />
        <Route path="/inventory/import/create" element={<InventoryImportCreatePage />} />
        <Route path="/inventory/returns" element={<InventoryReturnsPage />} />
        <Route path="/inventory/return-inspections" element={<ReturnInspectionsPage />} />
        <Route path="/inventory/stocktake" element={<InventoryStocktakePage />} />
        <Route path="/inventory/reports" element={<InventoryReportsPage />} />
        <Route path="/inventory/ledger" element={<InventoryLedgerPage />} />
        <Route path="/inventory/export" element={<InventoryExportPage />} />
        <Route path="/inventory/production" element={<Navigate to="/inventory/production-orders" replace />} />
        <Route path="/inventory/production-orders" element={<ProductionOrdersPage />} />
        <Route path="/inventory/custom-bundles" element={<CustomBundlesPage />} />
        <Route path="/inventory/suppliers" element={<SuppliersPage />} />
        <Route path="/inventory/supplier-products" element={<SupplierProductsPage />} />
        <Route path="/inventory/bom" element={<Navigate to="/inventory/boms" replace />} />
        <Route path="/inventory/boms" element={<InventoryBomPage />} />
        <Route path="/inventory/bom/create" element={<InventoryBomCreatePage />} />
        <Route path="/inventory/bom/:bomId/edit" element={<InventoryBomCreatePage />} />
        <Route path="/inventory/deduction" element={<InventoryPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/addresses" element={<CustomerAddressesPage />} />
        <Route path="/customers/create" element={<CustomerFormPage />} />
        <Route path="/customers/:customerId/addresses" element={<CustomerAddressesPage />} />
        <Route path="/customers/:customerId/edit" element={<CustomerFormPage />} />
        <Route path="/customer-addresses" element={<Navigate to="/customers/addresses" replace />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/staff/create" element={<StaffCreatePage />} />
        <Route path="/staff/:id" element={<StaffDetailPage />} />
        <Route path="/shifts" element={<ShiftManagePage />} />
        <Route path="/my-shifts" element={<MyShiftsPage />} />
        <Route path="/admin/membership-tiers" element={<MembershipTiersPage />} />
        <Route path="/admin/promotions" element={<PromotionsPage />} />
        <Route path="/admin/system-activities" element={<SystemActivityLogPage />} />
        <Route path="/admin/inventory-sync" element={<InventorySyncMonitorPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/phan-quyen" element={<AccessControlPage />} />
        <Route path="/admin/roles" element={<Navigate to="/admin/phan-quyen?tab=vai-tro" replace />} />
        <Route path="/admin/permissions" element={<Navigate to="/admin/phan-quyen?tab=quyen" replace />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/contracts/new" element={<ContractFormPage />} />
        <Route path="/contracts/:id" element={<ContractDetailPage />} />
        <Route path="/contracts/:id/edit" element={<ContractFormPage />} />
        <Route path="/reports" element={<ReportsOverviewPage />} />
        <Route path="/reports/customers" element={<ReportsCustomersPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
