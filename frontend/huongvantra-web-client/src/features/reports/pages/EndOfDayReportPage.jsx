import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import { apiRequestAuth } from '../../../lib/apiClient.js'
import { reportsApi } from '../services/reportsApi'
import { printEndOfDayReport, exportEndOfDayPdf } from '../utils/printEndOfDayReport.js'
import { exportEndOfDayExcel } from '../utils/exportEndOfDayExcel.js'
import { loadPosSeller } from '../../pos/utils/posSeller.js'
import { useNetworkStatus } from '../../../hooks/useNetworkStatus.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canViewAllOrders } from '../../auth/utils/permissions.js'
import { fetchCustomers } from '../../customers/services/customersApi.js'
import { formatVietnamDateTimeMinute } from '../../../utils/vietnamDateTime.js'
import ReportFilterBar from '../components/ReportFilterBar.jsx'
import ReportKpiCards from '../components/ReportKpiCards.jsx'
import OverviewTab from '../components/tabs/OverviewTab.jsx'
import SalesTab from '../components/tabs/SalesTab.jsx'
import PaymentsTab from '../components/tabs/PaymentsTab.jsx'
import ProductsTab from '../components/tabs/ProductsTab.jsx'
import InventoryTab from '../components/tabs/InventoryTab.jsx'
import ExceptionsTab from '../components/tabs/ExceptionsTab.jsx'
import ExportReportDialog from '../components/ExportReportDialog.jsx'
import { EmptyState } from '../components/reportUi.jsx'
import {
  TABS,
  DEFAULT_TAB,
  parseFiltersFromSearchParams,
  parseTabFromSearchParams,
  filtersToSearchParams,
  filtersToApiParams,
  isMultiDay,
  todayInputValue,
  countAdvancedFilters,
  quickRangeToDates,
} from '../utils/endOfDayFilters.js'

const EMPTY_REPORT = {
  cashIn: [],
  cashOut: [],
  byPaymentMethod: [],
  receipts: [],
  products: [],
  bySalesMode: [],
  hourlyRevenue: [],
  byEmployee: [],
  byChannel: [],
  orders: [],
  bridge: {},
  totalCashIn: 0,
  totalCashOut: 0,
  netCashFlow: 0,
  forfeitedDepositIncome: 0,
  forfeitedDepositOrders: 0,
  salesRevenue: 0,
  salesDiscount: 0,
  completedOrders: 0,
  returnedRevenue: 0,
  netRecognizedRevenue: 0,
  totalLineCount: 0,
  distinctSkuCount: 0,
  cancelledOrders: 0,
  refundedOrders: 0,
}

function EndOfDayReportPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Bộ lọc đang áp dụng đọc từ URL; bộ lọc nháp là thứ người dùng đang chỉnh.
  const appliedFilters = useMemo(() => parseFiltersFromSearchParams(searchParams), [searchParams])
  const activeTab = parseTabFromSearchParams(searchParams)
  const filterKey = JSON.stringify(appliedFilters)
  const [draftFilters, setDraftFilters] = useState(appliedFilters)
  const [syncedFilterKey, setSyncedFilterKey] = useState(filterKey)

  // Bộ lọc nháp bám theo URL khi người dùng bấm back/forward hoặc mở link có sẵn filter.
  if (syncedFilterKey !== filterKey) {
    setSyncedFilterKey(filterKey)
    setDraftFilters(appliedFilters)
  }

  const [users, setUsers] = useState([])
  const [customers, setCustomers] = useState([])
  const [report, setReport] = useState(EMPTY_REPORT)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)

  const [sellerInfo, setSellerInfo] = useState({ name: '', role: '—' })
  const [showExportDialog, setShowExportDialog] = useState(false)
  const isOnline = useNetworkStatus()
  const session = loadAuthSession()
  const canFilterByEmployee = canViewAllOrders(session)
  const agencyName = session?.agency?.name || 'Chi nhánh chính'

  const isDirty = useMemo(
    () => JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters),
    [draftFilters, appliedFilters],
  )

  useEffect(() => {
    loadPosSeller().then(setSellerInfo)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchCustomers()
      .then((items) => {
        if (!cancelled) setCustomers(items || [])
      })
      .catch(() => {
        if (!cancelled) setCustomers([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // Không có quyền xem toàn cửa hàng thì bỏ qua, danh sách nhân viên giữ nguyên mảng rỗng.
    if (!canFilterByEmployee) return

    let cancelled = false
    const loadUsers = async () => {
      try {
        const res = await apiRequestAuth('/api/users?pageSize=100', { method: 'GET', silentAuthErrors: true })
        const allowedRoles = ['Sale', 'SalePos', 'SaleCod', 'Manager', 'AgencyManager']
        const normalizeRole = (value) => String(value || '').trim().toLowerCase().replace(/[\s._-]+/g, '')
        const allowedCompact = new Set(allowedRoles.map(normalizeRole))
        const filtered = (res?.items || []).filter((u) => {
          const uRoles = Array.isArray(u.roles) ? u.roles : [u.role].filter(Boolean)
          return uRoles.some((r) => allowedCompact.has(normalizeRole(typeof r === 'string' ? r : r?.name)))
        })
        if (!cancelled) setUsers(filtered)
      } catch (err) {
        console.error('Failed to load users:', err)
        if (!cancelled) setUsers([])
      }
    }

    loadUsers()
    return () => {
      cancelled = true
    }
  }, [canFilterByEmployee])

  // Chỉ tải lại khi bộ lọc đã áp dụng thay đổi. Đổi tab không gọi lại API.
  const apiParams = useMemo(() => filtersToApiParams(JSON.parse(filterKey)), [filterKey])
  useEffect(() => {
    let cancelled = false
    const loadReport = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await reportsApi.getDailyCashReconciliation(filtersToApiParams(JSON.parse(filterKey)))
        if (cancelled) return
        setReport({ ...EMPTY_REPORT, ...(res || {}) })
        setLoadedAt(new Date().toISOString())
      } catch (err) {
        if (cancelled) return
        setError('Không thể tải dữ liệu báo cáo: ' + err.message)
        setReport(EMPTY_REPORT)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadReport()
    return () => {
      cancelled = true
    }
  }, [filterKey])

  const handleApply = () => {
    setSearchParams(filtersToSearchParams(draftFilters, searchParams))
  }

  const handleReset = () => {
    const next = new URLSearchParams()
    if (activeTab !== DEFAULT_TAB) next.set('tab', activeTab)
    setSearchParams(next)
  }

  const handleTabChange = (tab) => {
    const next = new URLSearchParams(searchParams)
    if (tab === DEFAULT_TAB) next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  // Lối thoát khi kỳ đang xem không có dữ liệu — thường gặp lúc vừa qua nửa đêm.
  const handleWidenToLast7 = () => {
    setSearchParams(filtersToSearchParams({ ...appliedFilters, ...quickRangeToDates('last7') }, searchParams))
  }

  const employeeName = !canFilterByEmployee
    ? sellerInfo.username
      ? `${sellerInfo.username} - ${sellerInfo.fullName || 'Chưa cập nhật'}`
      : 'Bản thân'
    : appliedFilters.employeeId
      ? `${users.find((u) => u.id === appliedFilters.employeeId)?.username || ''} - ${
          users.find((u) => u.id === appliedFilters.employeeId)?.employee?.fullName || 'Chưa cập nhật'
        }`
      : 'Tất cả nhân viên'

  const creatorName = sellerInfo.username
    ? `${sellerInfo.username} - ${sellerInfo.fullName || 'Chưa cập nhật'}`
    : sellerInfo.role

  const multiDay = isMultiDay(appliedFilters)
  const periodLabel = multiDay
    ? `${appliedFilters.date} → ${appliedFilters.dateTo}`
    : appliedFilters.date || todayInputValue()

  // Ngoại lệ: đơn chưa thu đủ tiền. Tab Ngoại lệ đầy đủ sẽ bổ sung ở đợt sau.
  const exceptionCount = useMemo(
    () => (report.orders || []).filter((o) => (o.paidAmount || 0) < (o.finalAmount || 0)).length,
    [report.orders],
  )

  const hasData =
    (report.receipts?.length || 0) > 0 ||
    (report.orders?.length || 0) > 0 ||
    (report.cashOut?.length || 0) > 0 ||
    report.forfeitedDepositOrders > 0

  const getExportFilename = () => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const timeStr = `${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}`
    return `Bao_cao_cuoi_ngay_${periodLabel.replace(/[^0-9]/g, '_')}_${timeStr}`
  }

  const exportMeta = { periodLabel, creatorName, agencyName, employeeName }

  const handleExport = async ({ output, orientation }) => {
    const payload = {
      periodLabel,
      employeeName,
      report,
      creatorName,
      agencyName,
      periodStartUtc: apiParams.fromDate,
      isMultiDay: multiDay,
      orientation,
      filename: getExportFilename(),
    }
    if (output === 'pdf') await exportEndOfDayPdf(payload)
    else await printEndOfDayReport(payload)
  }

  const handleExportExcel = () => {
    exportEndOfDayExcel({
      report,
      meta: exportMeta,
      periodStartUtc: apiParams.fromDate,
      filename: getExportFilename(),
    })
  }

  const renderTab = () => {
    // Tab Kho/Kệ đọc dữ liệu riêng từ InventoryService nên vẫn có thể có số liệu
    // dù kỳ này không phát sinh đơn hàng nào.
    if (!hasData && !isLoading && !error && activeTab !== 'inventory') {
      return (
        <EmptyState
          text={`Không có giao dịch nào trong kỳ ${periodLabel}${
            countAdvancedFilters(appliedFilters) > 0 ? ' với bộ lọc đã chọn' : ''
          }.`}
          hint="Kỳ báo cáo tính theo ngày dương lịch giờ Việt Nam. Nếu vừa sang ngày mới, số liệu ca bán hàng đêm qua nằm ở ngày hôm trước."
          action={
            <button
              type="button"
              onClick={handleWidenToLast7}
              className="mt-1 rounded-lg border border-[#356647] px-4 py-2 text-sm font-medium text-[#356647] hover:bg-[#356647]/10"
            >
              Xem 7 ngày gần nhất
            </button>
          }
        />
      )
    }
    switch (activeTab) {
      case 'sales':
        return <SalesTab report={report} mode={appliedFilters.mode} />
      case 'payments':
        return <PaymentsTab report={report} mode={appliedFilters.mode} />
      case 'products':
        return <ProductsTab report={report} />
      case 'inventory':
        return <InventoryTab fromUtc={apiParams.fromDate} toUtc={apiParams.toDate} />
      case 'exceptions':
        return <ExceptionsTab report={report} periodStartUtc={apiParams.fromDate} />
      default:
        return <OverviewTab report={report} />
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 [font-family:'Manrope',sans-serif]">
      <PageHeader
        compact
        title={multiDay ? 'Báo cáo bán hàng theo kỳ' : 'Báo cáo cuối ngày'}
        titleInfo="Chốt số liệu bán hàng, thu chi và hàng hóa trong kỳ"
      />

      {!isOnline && (
        <div className="flex items-start gap-2 rounded-2xl border border-[#7e5700]/40 bg-[#fec25b]/15 p-3">
          <span className="material-symbols-outlined text-[18px] text-[#7e5700]">cloud_off</span>
          <p className="text-sm text-[#7e5700]">
            Đang mất kết nối mạng. Số liệu hiển thị là bản tải gần nhất và có thể chưa đầy đủ — không nên dùng để chốt
            sổ cho tới khi kết nối trở lại.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#717971]">
          Dữ liệu cập nhật gần nhất: {loadedAt ? formatVietnamDateTimeMinute(loadedAt) : '—'} · Múi giờ: GMT+7
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-lg border border-[#c1c9c0] bg-white px-3 py-2 text-sm font-medium text-[#414942] hover:bg-[#f6f4ec]"
          >
            <span className="material-symbols-outlined text-[18px] text-[#356647]">table_view</span>
            Xuất Excel
          </button>
          <button
            type="button"
            onClick={() => setShowExportDialog(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#c1c9c0] bg-white px-3 py-2 text-sm font-medium text-[#414942] hover:bg-[#f6f4ec]"
          >
            <span className="material-symbols-outlined text-[18px] text-[#356647]">print</span>
            In báo cáo
          </button>
        </div>
      </div>

      <ReportFilterBar
        draft={draftFilters}
        onChange={setDraftFilters}
        onApply={handleApply}
        onReset={handleReset}
        isDirty={isDirty}
        isLoading={isLoading}
        users={users}
        customers={customers}
        canFilterByEmployee={canFilterByEmployee}
        agencyName={agencyName}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#b42318]/40 bg-[#b42318]/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-[#b42318]">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </p>
          <button
            type="button"
            onClick={() => setSearchParams(new URLSearchParams(searchParams))}
            className="rounded-lg border border-[#b42318] px-3 py-1.5 text-sm font-medium text-[#b42318] hover:bg-[#b42318]/10"
          >
            Thử lại
          </button>
        </div>
      )}

      <ReportKpiCards
        report={report}
        exceptionCount={exceptionCount}
        onOpenExceptions={() => handleTabChange('exceptions')}
        showStoreWideCash={canFilterByEmployee}
      />

      <div className="flex flex-wrap gap-1 border-b border-[#c1c9c0]/60">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => handleTabChange(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === t.key
                ? 'border-[#356647] text-[#356647]'
                : 'border-transparent text-[#717971] hover:text-[#414942]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-4">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#f6f4ec]" />
            ))}
          </div>
        ) : (
          renderTab()
        )}
      </div>

      {showExportDialog && (
        <ExportReportDialog
          periodLabel={periodLabel}
          onClose={() => setShowExportDialog(false)}
          onConfirm={handleExport}
        />
      )}
    </div>
  )
}

export default EndOfDayReportPage
