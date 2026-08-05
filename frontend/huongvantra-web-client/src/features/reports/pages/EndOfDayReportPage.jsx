import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import { apiRequestAuth } from '../../../lib/apiClient.js'
import { reportsApi } from '../services/reportsApi'
import { printCashReconciliationReport } from '../utils/printCashReconciliationReport.js'
import { paymentMethodLabel, paymentPurposeLabel } from '../utils/cashReportLabels.js'
import { loadPosSeller } from '../../pos/utils/posSeller.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canViewAllOrders } from '../../auth/utils/permissions.js'
import { fetchCustomers } from '../../customers/services/customersApi.js'
import { formatVietnamDateTime, formatVietnamDateTimeMinute } from '../../../utils/vietnamDateTime.js'
import ReportFilterBar from '../components/ReportFilterBar.jsx'
import ReportKpiCards from '../components/ReportKpiCards.jsx'
import OverviewTab from '../components/tabs/OverviewTab.jsx'
import SalesTab from '../components/tabs/SalesTab.jsx'
import PaymentsTab from '../components/tabs/PaymentsTab.jsx'
import ProductsTab from '../components/tabs/ProductsTab.jsx'
import PlaceholderTab from '../components/tabs/PlaceholderTab.jsx'
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
import * as XLSX from 'xlsx'

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

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function EndOfDayReportPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Bộ lọc đang áp dụng đọc từ URL; bộ lọc nháp là thứ người dùng đang chỉnh.
  const appliedFilters = useMemo(() => parseFiltersFromSearchParams(searchParams), [searchParams])
  const activeTab = parseTabFromSearchParams(searchParams)
  const [draftFilters, setDraftFilters] = useState(appliedFilters)

  const [users, setUsers] = useState([])
  const [customers, setCustomers] = useState([])
  const [report, setReport] = useState(EMPTY_REPORT)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)

  const [sellerInfo, setSellerInfo] = useState({ name: '', role: '—' })
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
    if (!canFilterByEmployee) {
      setUsers([])
      return
    }

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
        setUsers(filtered)
      } catch (err) {
        console.error('Failed to load users:', err)
        setUsers([])
      }
    }

    loadUsers()
  }, [canFilterByEmployee])

  // Chỉ tải lại khi bộ lọc đã áp dụng thay đổi. Đổi tab không gọi lại API.
  const filterKey = JSON.stringify(appliedFilters)
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

  // Bộ lọc nháp bám theo URL khi người dùng bấm back/forward hoặc mở link có sẵn filter.
  useEffect(() => {
    setDraftFilters(appliedFilters)
  }, [appliedFilters])

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

  const handlePrint = async () => {
    await printCashReconciliationReport({
      dateStr: periodLabel,
      employeeName,
      report,
      paperSize: 'A4',
      creatorName,
      agencyName,
      filename: getExportFilename(),
    })
  }

  const handleExportExcel = () => {
    const wsData = [
      ['BÁO CÁO CUỐI NGÀY', null, null, null],
      ['Hệ thống Quản lý Hương Vân Trà', null, null, null],
      [`Kỳ báo cáo: ${periodLabel}`, null, null, null],
      [`Thời gian tạo: ${formatVietnamDateTime(new Date().toISOString())}`, null, `Người tạo: ${creatorName}`, null],
      [`Chi nhánh: ${agencyName}`, null, `Nhân viên: ${employeeName}`, null],
      [],
      ['1. DOANH THU GHI NHẬN', null, null, null],
      ['Doanh thu đơn hoàn tất', null, report.salesRevenue, null],
      ['Trừ hàng trả', null, report.returnedRevenue, null],
      ['Doanh thu ghi nhận thuần', null, report.netRecognizedRevenue, null],
      ['Đơn hoàn tất', report.completedOrders, null, null],
      ['Tổng dòng hàng', report.totalLineCount, null, null],
      ['Số SKU phát sinh', report.distinctSkuCount, null, null],
      [],
      ['2. TIỀN THU VÀO', null, null, null],
      ['Loại thu', 'Số lượt', 'Số tiền', null],
    ]
    ;(report.cashIn || []).forEach((l) => wsData.push([l.label, l.count, l.amount, null]))
    wsData.push(['Tổng thu vào', null, report.totalCashIn, null], [])

    wsData.push(['3. TIỀN CHI RA (HOÀN TRẢ HÀNG)', null, null, null], ['Phương thức hoàn', 'Số lượt', 'Số tiền', null])
    ;(report.cashOut || []).forEach((l) => wsData.push([l.label, l.count, l.amount, null]))
    wsData.push(['Tổng chi ra', null, report.totalCashOut, null], [])

    wsData.push(
      ['4. TỔNG HỢP DÒNG TIỀN THEO PHƯƠNG THỨC', null, null, null],
      ['Phương thức', 'Thu vào', 'Chi ra', 'Còn lại'],
    )
    ;(report.byPaymentMethod || []).forEach((l) =>
      wsData.push([`${l.label}${l.isCash ? ' (tiền két)' : ' (tài khoản)'}`, l.amountIn, l.amountOut, l.net]),
    )
    wsData.push([])

    const b = report.bridge || {}
    wsData.push(
      ['5. CẦU NỐI DOANH THU VÀ DÒNG TIỀN', null, null, null],
      ['Doanh thu ghi nhận', null, b.recognizedRevenue, null],
      ['(-) Doanh thu chưa thu tiền', null, b.unpaidRevenue, null],
      ['(+) Tiền thu của đơn kỳ trước', null, b.priorPeriodCollections, null],
      ['(+) Cọc bị giữ do hủy đơn', null, b.forfeitedDeposit, null],
      ['(-) Hoàn tiền trả hàng', null, b.refunds, null],
      ['= Tổng tiền thu vào', null, b.totalCashIn, null],
      [],
    )

    wsData.push(['6. HÀNG HÓA ĐÃ BÁN', null, null, null], ['Mã SKU / Tên', 'SL bán', 'SL trả', 'Doanh thu'])
    ;(report.products || []).forEach((p) =>
      wsData.push([`${p.skuCode} - ${p.skuName}`, p.quantity, p.returnedQuantity, p.revenue]),
    )
    wsData.push([])

    wsData.push(['7. CHI TIẾT CÁC KHOẢN THU', null, null, null], ['Mã đơn', 'Thời gian', 'Phương thức / Mục đích', 'Số tiền'])
    ;(report.receipts || []).forEach((r) =>
      wsData.push([
        r.orderCode,
        formatTime(r.paidAt),
        `${paymentMethodLabel(r.paymentMethod)} / ${paymentPurposeLabel(r.paymentPurpose)}`,
        r.amount,
      ]),
    )

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{ wch: 42 }, { wch: 16 }, { wch: 22 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo cuối ngày')
    XLSX.writeFile(wb, `${getExportFilename()}.xlsx`)
  }

  const renderTab = () => {
    if (!hasData && !isLoading && !error) {
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
        return (
          <PlaceholderTab
            title="Kho / Kệ hàng"
            description="Số liệu điều chuyển, sản xuất và tồn cuối kỳ sẽ được bổ sung ở đợt tiếp theo."
          />
        )
      case 'exceptions':
        return (
          <PlaceholderTab
            title="Ngoại lệ cần xử lý"
            description={`Hiện phát hiện ${exceptionCount} đơn chưa thu đủ tiền. Danh sách ngoại lệ đầy đủ sẽ được bổ sung ở đợt tiếp theo.`}
          />
        )
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
            onClick={handlePrint}
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
    </div>
  )
}

export default EndOfDayReportPage
