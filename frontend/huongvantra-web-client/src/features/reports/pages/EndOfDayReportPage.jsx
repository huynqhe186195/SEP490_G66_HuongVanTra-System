import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import { apiRequestAuth } from '../../../lib/apiClient.js'
import { endOfDayOrderApi, endOfDayInventoryApi, fetchAllPages } from '../services/endOfDayApi.js'
import { printEndOfDayReport, exportEndOfDayPdf, printEndOfDayK80 } from '../utils/printEndOfDayReport.js'
import { exportEndOfDayExcel } from '../utils/exportEndOfDayExcel.js'
import { loadPosSeller } from '../../pos/utils/posSeller.js'
import { useNetworkStatus } from '../../../hooks/useNetworkStatus.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canViewAllOrders } from '../../auth/utils/permissions.js'
import { fetchCustomers } from '../../customers/services/customersApi.js'
import { formatVietnamDateTimeMinute } from '../../../utils/vietnamDateTime.js'
import EndOfDayCriteriaPanel from '../components/EndOfDayCriteriaPanel.jsx'
import EndOfDayReportViewer from '../components/EndOfDayReportViewer.jsx'
import {
  DEFAULT_CONCERN,
  concernMeta,
  parseConcernFromSearchParams,
  parseLayoutFromSearchParams,
  layoutToOrientation,
  filtersForConcern,
  parseFiltersFromSearchParams,
  filtersToSearchParams,
  filtersToEodParams,
  isMultiDay,
  todayInputValue,
} from '../utils/endOfDayFilters.js'

const EMPTY_REPORT = {
  cashIn: [],
  cashOut: [],
  byPaymentMethod: [],
  receipts: [],
  products: [],
  productTotals: [],
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
  ordersTotalCount: 0,
  receiptsTotalCount: 0,
  productsTotalCount: 0,
}

/**
 * Màn hình Báo cáo cuối ngày dạng hai panel.
 *
 * Trái là panel tiêu chí (kiểu hiển thị, mối quan tâm, thời gian và các bộ lọc), phải là
 * khung xem tài liệu báo cáo. Đổi mối quan tâm là đổi tài liệu chứ không phải đổi tab, và
 * giá trị bộ lọc được giữ nguyên trong URL kể cả khi mối quan tâm đang xem không dùng tới.
 */
function EndOfDayReportPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const appliedFilters = useMemo(() => parseFiltersFromSearchParams(searchParams), [searchParams])
  const concern = parseConcernFromSearchParams(searchParams)
  const layout = parseLayoutFromSearchParams(searchParams)
  const meta = concernMeta(concern)

  const [users, setUsers] = useState([])
  const [customers, setCustomers] = useState([])
  const [report, setReport] = useState(EMPTY_REPORT)
  const [exceptions, setExceptions] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [isCriteriaOpen, setIsCriteriaOpen] = useState(false)

  const [sellerInfo, setSellerInfo] = useState({ name: '', role: '—' })
  const isOnline = useNetworkStatus()
  const session = loadAuthSession()
  const canFilterByEmployee = canViewAllOrders(session)
  const agencyName = session?.agency?.name || 'Chi nhánh chính'

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

  // Chỉ gửi lên API những bộ lọc mà mối quan tâm đang xem thực sự hỗ trợ.
  const eodParams = useMemo(
    () => filtersToEodParams(filtersForConcern(appliedFilters, concern)),
    [appliedFilters, concern],
  )
  const paramKey = JSON.stringify(eodParams)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    const params = JSON.parse(paramKey)

    const loadReport = async () => {
      try {
        setIsLoading(true)
        setError(null)
        // Bản in và Excel cần dòng chi tiết, nên lấy kèm một lát đầu của ba danh sách.
        // DETAIL_SLICE bằng trần trang phía server; phần vượt được báo trong DataGaps.
        const DETAIL_SLICE = 200
        const detail = { ...params, page: 1, pageSize: DETAIL_SLICE }
        const [summary, exc, sales, payments, products] = await Promise.all([
          endOfDayOrderApi.getSummary(params, { signal }),
          endOfDayOrderApi.getExceptions({ ...params, page: 1, pageSize: 20 }, { signal }),
          endOfDayOrderApi.getSales(detail, { signal }),
          endOfDayOrderApi.getPayments(detail, { signal }),
          endOfDayOrderApi.getProducts(detail, { signal }),
        ])
        if (signal.aborted) return
        setExceptions(exc)
        setReport({
          ...EMPTY_REPORT,
          ...(summary || {}),
          orders: sales?.items || [],
          receipts: payments?.items || [],
          products: products?.items || [],
          productTotals: products?.totals || [],
          // Số tổng toàn kỳ do backend trả về; tài liệu dùng nó thay vì đếm dòng đang xem.
          ordersTotalCount: sales?.totalCount || 0,
          receiptsTotalCount: payments?.totalCount || 0,
          productsTotalCount: products?.totalCount || 0,
          ordersTotalFinalAmount: sales?.totalFinalAmount || 0,
          ordersTotalDiscountAmount: sales?.totalDiscountAmount || 0,
          ordersTotalPaidAmount: sales?.totalPaidAmount || 0,
          receiptsTotalAmount: payments?.totalAmount || 0,
        })
        setLoadedAt(new Date().toISOString())
      } catch (err) {
        if (signal.aborted || err.name === 'AbortError') return
        setError('Không thể tải dữ liệu báo cáo: ' + err.message)
        setReport(EMPTY_REPORT)
        setExceptions(null)
      } finally {
        if (!signal.aborted) setIsLoading(false)
      }
    }
    loadReport()
    return () => controller.abort()
  }, [paramKey, reloadNonce])

  const handleRetry = useCallback(() => setReloadNonce((n) => n + 1), [])

  // Bộ lọc áp dụng ngay khi đổi, không có nút Áp dụng riêng.
  const handleFiltersChange = useCallback(
    (next) => setSearchParams(filtersToSearchParams(next, searchParams), { replace: true }),
    [searchParams, setSearchParams],
  )

  const handleConcernChange = useCallback(
    (key) => {
      const next = new URLSearchParams(searchParams)
      if (key === DEFAULT_CONCERN) next.delete('concern')
      else next.set('concern', key)
      setSearchParams(next, { replace: true })
      setIsCriteriaOpen(false)
    },
    [searchParams, setSearchParams],
  )

  const handleLayoutChange = useCallback(
    (key) => {
      const next = new URLSearchParams(searchParams)
      if (key === 'report') next.delete('layout')
      else next.set('layout', key)
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const handleReset = useCallback(() => {
    const next = new URLSearchParams()
    if (concern !== DEFAULT_CONCERN) next.set('concern', concern)
    if (layout !== 'report') next.set('layout', layout)
    setSearchParams(next)
  }, [concern, layout, setSearchParams])

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

  const customerName = appliedFilters.customerId
    ? customers.find((c) => c.customerId === appliedFilters.customerId)?.fullName || 'Khách đã chọn'
    : 'Tất cả khách hàng'

  // Phần đầu tài liệu ghi lại đúng tiêu chí đã áp dụng cho báo cáo đang xem.
  const criteriaLines = useMemo(() => {
    const effective = filtersForConcern(appliedFilters, concern)
    const lines = [
      { label: 'Kỳ báo cáo', value: periodLabel },
      { label: 'Chi nhánh', value: agencyName },
    ]
    if (effective.employeeId || !canFilterByEmployee) lines.push({ label: 'Nhân viên', value: employeeName })
    if (effective.customerId) lines.push({ label: 'Khách hàng', value: customerName })
    if (effective.channel) lines.push({ label: 'Kênh bán', value: effective.channel })
    if (effective.paymentMethod) lines.push({ label: 'PT thanh toán', value: effective.paymentMethod })
    if (effective.salesMode) lines.push({ label: 'PT bán hàng', value: effective.salesMode })
    if (effective.orderStatus) lines.push({ label: 'Trạng thái đơn', value: effective.orderStatus })
    lines.push({ label: 'Người kết xuất', value: creatorName })
    return lines
  }, [
    appliedFilters,
    concern,
    periodLabel,
    agencyName,
    canFilterByEmployee,
    employeeName,
    customerName,
    creatorName,
  ])

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

  // Bảng trên màn hình chỉ tải một lát đầu để mở tài liệu cho nhanh. Excel và bản in thì
  // phải đủ dòng, nên trước khi xuất sẽ tải nốt các trang còn lại. Nếu kỳ báo cáo vượt trần
  // an toàn thì đánh dấu để file ghi rõ, không cắt bớt trong im lặng.
  const [isPreparingFullData, setIsPreparingFullData] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [exportError, setExportError] = useState(null)

  const loadFullDetail = useCallback(async () => {
    const needsMore =
      (report.ordersTotalCount || 0) > (report.orders?.length || 0) ||
      (report.receiptsTotalCount || 0) > (report.receipts?.length || 0) ||
      (report.productsTotalCount || 0) > (report.products?.length || 0)
    if (!needsMore) return { report, truncationNotes: [] }

    setIsPreparingFullData(true)
    try {
      const [sales, payments, products] = await Promise.all([
        fetchAllPages(endOfDayOrderApi.getSales, eodParams),
        fetchAllPages(endOfDayOrderApi.getPayments, eodParams),
        fetchAllPages(endOfDayOrderApi.getProducts, eodParams),
      ])
      const truncationNotes = []
      if (sales.truncated)
        truncationNotes.push(`Danh sách đơn chỉ in ${sales.items.length}/${report.ordersTotalCount} dòng.`)
      if (payments.truncated)
        truncationNotes.push(`Danh sách khoản thu chỉ in ${payments.items.length}/${report.receiptsTotalCount} dòng.`)
      if (products.truncated)
        truncationNotes.push(`Danh sách hàng hóa chỉ in ${products.items.length}/${report.productsTotalCount} dòng.`)

      return {
        report: {
          ...report,
          orders: sales.items,
          receipts: payments.items,
          products: products.items,
        },
        truncationNotes,
      }
    } catch {
      // Tải bổ sung hỏng thì vẫn xuất được bằng lát dữ liệu đang có, kèm ghi chú.
      return {
        report,
        truncationNotes: ['Không tải được toàn bộ dòng chi tiết; file chỉ chứa phần đã tải trên màn hình.'],
      }
    } finally {
      setIsPreparingFullData(false)
    }
  }, [report, eodParams])

  // Cùng một payload nuôi cả bản in và file PDF, nên hai đường không thể lệch nội dung nhau.
  const documentPayload = useMemo(
    () => ({
      periodLabel,
      employeeName,
      report,
      exceptions,
      creatorName,
      agencyName,
      isMultiDay: multiDay,
    }),
    [periodLabel, employeeName, report, exceptions, creatorName, agencyName, multiDay],
  )

  const handleExport = useCallback(
    async (output) => {
      const full = await loadFullDetail()
      const payload = {
        ...documentPayload,
        report: full.report,
        truncationNotes: full.truncationNotes,
        orientation: layoutToOrientation(layout),
        filename: getExportFilename(),
      }
      if (output === 'pdf') await exportEndOfDayPdf(payload)
      else if (output === 'k80') await printEndOfDayK80(payload)
      else await printEndOfDayReport(payload)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentPayload, loadFullDetail, layout, periodLabel],
  )

  // Sheet Kho/Kệ thuộc InventoryService nên chỉ tải lúc bấm xuất Excel. Thiếu quyền xem
  // tồn kho thì vẫn xuất file, sheet đó ghi rõ lý do thay vì để trống gây hiểu nhầm.
  const handleExportExcel = useCallback(async () => {
    setExportError(null)
    setIsExportingExcel(true)
    let inventory
    try {
      inventory = await endOfDayInventoryApi.getSummary(eodParams)
    } catch {
      inventory = null
    }
    try {
      const full = await loadFullDetail()
      await exportEndOfDayExcel({
        report: full.report,
        exceptions,
        inventory,
        meta: { ...exportMeta, truncationNotes: full.truncationNotes },
        filename: getExportFilename(),
      })
    } catch (err) {
      // Không dùng `error` chung vì state đó thay thế cả nội dung báo cáo đang xem.
      setExportError(err.message || 'Không xuất được file Excel.')
    } finally {
      setIsExportingExcel(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eodParams, exceptions, loadFullDetail, periodLabel, creatorName, agencyName, employeeName])

  const criteriaPanel = (
    <EndOfDayCriteriaPanel
      filters={appliedFilters}
      onFiltersChange={handleFiltersChange}
      concern={concern}
      onConcernChange={handleConcernChange}
      layout={layout}
      onLayoutChange={handleLayoutChange}
      users={users}
      customers={customers}
      canFilterByEmployee={canFilterByEmployee}
      onReset={handleReset}
      isLoading={isLoading}
    />
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 [font-family:'Manrope',sans-serif]">
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

      {exportError && (
        <div className="flex items-start gap-2 rounded-2xl border border-[#7e5700]/40 bg-[#fec25b]/15 p-3">
          <span className="material-symbols-outlined text-[18px] text-[#7e5700]">warning</span>
          <p className="flex-1 text-sm text-[#7e5700]">{exportError}</p>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="rounded-lg p-1 text-[#7e5700] hover:bg-[#fec25b]/25"
            aria-label="Đóng thông báo"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="hidden w-[268px] shrink-0 overflow-auto rounded-2xl border border-[#c1c9c0]/60 bg-white lg:block">
          {criteriaPanel}
        </aside>

        <EndOfDayReportViewer
          concern={concern}
          concernTitle={meta.title}
          layout={layout}
          onLayoutChange={handleLayoutChange}
          report={report}
          exceptions={exceptions}
          params={eodParams}
          periodLabel={periodLabel}
          criteriaLines={criteriaLines}
          printedAtLabel={loadedAt ? formatVietnamDateTimeMinute(loadedAt) : null}
          loadedAtLabel={loadedAt ? formatVietnamDateTimeMinute(loadedAt) : null}
          isLoading={isLoading}
          isBusy={isPreparingFullData || isExportingExcel}
          error={error}
          hasData={hasData}
          onReload={handleRetry}
          onExportExcel={handleExportExcel}
          onPrintA4={() => handleExport('a4')}
          onPrintK80={() => handleExport('k80')}
          onExportPdf={() => handleExport('pdf')}
          onOpenCriteria={() => setIsCriteriaOpen(true)}
        />
      </div>

      {isCriteriaOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            aria-label="Đóng bảng tiêu chí"
            onClick={() => setIsCriteriaOpen(false)}
            className="flex-1 bg-black/40"
          />
          <div className="w-[292px] max-w-[85vw] overflow-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#c1c9c0]/60 px-3 py-2">
              <span className="text-sm font-bold text-[#1b1c17]">Tiêu chí báo cáo</span>
              <button
                type="button"
                onClick={() => setIsCriteriaOpen(false)}
                className="rounded-lg p-1 text-[#414942] hover:bg-[#f6f4ec]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {criteriaPanel}
          </div>
        </div>
      )}
    </div>
  )
}

export default EndOfDayReportPage
