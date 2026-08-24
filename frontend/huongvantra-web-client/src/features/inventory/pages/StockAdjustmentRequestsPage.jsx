import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  listFilterControlClass,
  listFilterSelectClass,
} from '../../../components/shared/ListFilterToolbar.jsx'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import ReasonSuggestionChips from '../../../components/shared/ReasonSuggestionChips.jsx'
import StatusFilterChips from '../../../components/shared/StatusFilterChips.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  canCancelStockReplenishmentRequest,
  canCreateStockReplenishmentRequest,
  canReviewStockReplenishmentRequest,
  isAuditOnlyAdmin,
} from '../../auth/utils/permissions.js'
import { getReasonSuggestions } from '../../shared/reasonSuggestions.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { applyStatusCounts } from '../../../utils/statusFilterCounts.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import InventorySimulationBanner from '../components/InventorySimulationBanner.jsx'
import StockAdjustmentRequestAuditView from '../components/StockAdjustmentRequestAuditView.jsx'
import StockAdjustmentRequestDetailPanel from '../components/StockAdjustmentRequestDetailPanel.jsx'
import { formatCreatorRole } from '../utils/inventoryCreatorDisplay.js'
import { fetchInventorySettings, fetchSkuStocks } from '../services/inventoryStockApi.js'
import {
  approveStockAdjustmentRequest,
  cancelStockAdjustmentRequest,
  confirmStockAdjustmentRequestTransfer,
  fetchStockAdjustmentRequestById,
  fetchStockAdjustmentRequests,
  getAdjustmentRequestStatusPresentation,
  processStockAdjustmentRequestItem,
  rejectStockAdjustmentRequest,
} from '../services/stockAdjustmentRequestApi.js'
import {
  getStockFlowErrorMessage,
  STOCK_FLOW_TERMS,
} from '../utils/stockFlowLabels.js'

/**
 * Bộ lọc nhanh của Quản lý. Mỗi mục chỉ đặt tham số truy vấn phía máy chủ,
 * không lọc lại trên trang hiện tại để tránh phân trang giả.
 */
const QUICK_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'remaining', label: 'Cần xử lý', onlyRemaining: true },
  { key: 'processed', label: 'Đã xử lý', status: 'processed' },
]

const EMPTY_FILTERS = {
  fromDate: '',
  toDate: '',
}

const SORT_OPTIONS = [
  { value: '', label: 'Mới nhất trước' },
  { value: 'oldest', label: 'Cũ nhất trước' },
  { value: 'warehouse_priority', label: 'Ưu tiên xử lý của Nhân viên kho' },
  { value: 'code_asc', label: 'Mã yêu cầu tăng dần' },
  { value: 'code_desc', label: 'Mã yêu cầu giảm dần' },
  { value: 'status', label: 'Theo trạng thái' },
]

async function fetchRequestDetailWithWarehouseStock(id, isWarehouse) {
  const [request, stocks] = await Promise.all([
    fetchStockAdjustmentRequestById(id),
    (isWarehouse ? fetchSkuStocks() : Promise.resolve([])).catch(() => []),
  ])
  const stockBySkuId = new Map(stocks.map((stock) => [stock.skuId, stock.warehouseQuantityOnHand]))
  return {
    ...request,
    items: request.items.map((item) => ({
      ...item,
      warehouseQuantityOnHand: stockBySkuId.get(item.skuId) ?? null,
    })),
  }
}

function textOrDash(value) {
  const normalized = String(value ?? '').trim()
  return normalized || '—'
}

function ShelfReplenishmentProcessResultModal({ result, onClose }) {
  if (!result) return null
  const checks = Array.isArray(result.materialChecks) ? result.materialChecks : []
  const isRejected = String(result.outcome).toLowerCase().includes('từ chối')
  const hasCreatedProductionOrder = Boolean(result.productionOrderCode)

  return (
    <div className="inventory-modal fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {hasCreatedProductionOrder ? 'Lệnh sản xuất đã được tạo' : 'Kết quả xử lý yêu cầu bổ sung'}
            </h3>
            <p className="mt-1 font-mono text-sm font-semibold text-[#356647]">{result.requestCode}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${isRejected ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {result.outcome || 'Đã xử lý'}
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-700">{result.message}</p>
        {result.productionOrderCode ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Lệnh sản xuất đã được tạo và lưu: <strong>{result.productionOrderCode}</strong>.
          </p>
        ) : null}

        {checks.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nguyên liệu/Bao bì</th>
                  <th className="px-4 py-3 text-right">Cần</th>
                  <th className="px-4 py-3 text-right">Có trong Kho</th>
                  <th className="px-4 py-3 text-right">Thiếu</th>
                  <th className="px-4 py-3">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checks.map((check) => (
                  <tr key={`${check.skuId}-${check.skuCode}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{check.materialName || '—'}</p>
                      <p className="font-mono text-xs text-[#356647]">{check.skuCode || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">{formatStockQuantity(check.requiredQuantity)}</td>
                    <td className="px-4 py-3 text-right">{formatStockQuantity(check.availableQuantity)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-700">
                      {formatStockQuantity(check.shortageQuantity)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${Number(check.shortageQuantity) > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {check.status || (Number(check.shortageQuantity) > 0 ? 'Thiếu' : 'Đủ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

function StockAdjustmentRequestOperationsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const session = loadAuthSession()
  const canReview = canReviewStockReplenishmentRequest(session)
  const canCreateRequest = canCreateStockReplenishmentRequest(session)
  const canCancelRequest = canCancelStockReplenishmentRequest(session)
  const canCancelAnyRequest = canCancelRequest && canReview
  const currentUserId = session?.userId ? String(session.userId) : ''

  const quickFilters = QUICK_FILTERS
  const [activeTab, setActiveTab] = useState(canReview ? 'remaining' : 'all')
  const [searchValue, setSearchValue] = useState(() => location.state?.search ?? '')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState(canReview ? 'warehouse_priority' : '')
  const [requests, setRequests] = useState([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [statusCounts, setStatusCounts] = useState(null)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])
  const [detailId, setDetailId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [actingId, setActingId] = useState(null)
  const [processingItemId, setProcessingItemId] = useState(null)
  const [processResult, setProcessResult] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [simulateWarehouse, setSimulateWarehouse] = useState(true)

  const activeQuickFilter = quickFilters.find((tab) => tab.key === activeTab) ?? quickFilters[0]
  const quickFilterChipOptions = useMemo(
    () => applyStatusCounts(quickFilters.map((tab) => ({ value: tab.key, label: tab.label })), statusCounts),
    [quickFilters, statusCounts],
  )

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchStockAdjustmentRequests({
        // Bộ lọc chi tiết được ưu tiên hơn bộ lọc nhanh khi người dùng chọn cụ thể.
        status: activeQuickFilter?.status || undefined,
        onlyRemaining: Boolean(activeQuickFilter?.onlyRemaining),
        search: searchValue.trim() || undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        sort: sort || undefined,
        page,
        pageSize,
      })
      setRequests(data.items)
      setTotalCount(data.totalCount)
      if (data.statusCounts && Object.keys(data.statusCounts).length > 0) {
        setStatusCounts(data.statusCounts)
      } else {
        // Tương thích server chưa được khởi động lại sau khi bổ sung StatusCounts:
        // vẫn lấy đúng tổng theo từng chip từ API danh sách hiện có.
        try {
          const countResults = await Promise.all(
            quickFilters.map(async (tab) => {
              const result = await fetchStockAdjustmentRequests({
                status: tab.status || undefined,
                onlyRemaining: Boolean(tab.onlyRemaining),
                search: searchValue.trim() || undefined,
                fromDate: filters.fromDate || undefined,
                toDate: filters.toDate || undefined,
                page: 1,
                pageSize: 1,
              })
              return [tab.key, result.totalCount]
            }),
          )
          setStatusCounts(Object.fromEntries(countResults))
        } catch {
          setStatusCounts(null)
        }
      }
    } catch (error) {
      setRequests([])
      setTotalCount(0)
      setStatusCounts(null)
      showError(getStockFlowErrorMessage(error, 'Không tải được danh sách yêu cầu.'))
    } finally {
      setIsLoading(false)
    }
  }, [activeQuickFilter, filters, searchValue, sort, page, pageSize])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  useEffect(() => {
    fetchInventorySettings().then((s) => setSimulateWarehouse(s.simulateWarehouse)).catch(() => {})
  }, [])

  useEffect(() => {
    const nextSearch = location.state?.search
    if (!nextSearch) return
    setSearchValue(nextSearch)
    setActiveTab(canReview ? 'remaining' : 'all')
    setPage(1)
  }, [canReview, location.key, location.state])

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      return undefined
    }

    let mounted = true
    setIsLoadingDetail(true)
    fetchRequestDetailWithWarehouseStock(detailId, canReview)
      .then((request) => {
        if (!mounted) return
        setDetail(request)
      })
      .catch((error) => {
        if (!mounted) return
        setDetail(null)
        showError(getStockFlowErrorMessage(error, 'Không tải được chi tiết yêu cầu.'))
      })
      .finally(() => {
        if (mounted) setIsLoadingDetail(false)
      })

    return () => {
      mounted = false
    }
  }, [detailId, canReview])

  const hasActiveFilters = useMemo(
    () =>
      ['fromDate', 'toDate'].some(
        (key) => String(filters[key] ?? '').trim() !== '',
      )
      || searchValue.trim() !== '',
    [filters, searchValue],
  )

  function updateDraft(patch) {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  function handleClearFilters() {
    setFilters(EMPTY_FILTERS)
    setSearchValue('')
    setSort(canReview ? 'warehouse_priority' : '')
    setActiveTab(canReview ? 'remaining' : 'all')
    setPage(1)
  }

  async function refreshDetail(id) {
    if (!id) return
    try {
      const request = await fetchRequestDetailWithWarehouseStock(id, canReview)
      setDetail(request)
    } catch {
      // Danh sách đã được tải lại; lỗi tải chi tiết không chặn luồng thao tác.
    }
  }

  /** Xử lý trọn một sản phẩm theo nhánh cấp đủ, tự sản xuất hoặc từ chối do thiếu vật tư. */
  async function handleProcessItem(request, item) {
    if (!request?.id || !item?.id) {
      showError('Không xác định được sản phẩm cần xử lý.')
      return
    }

    setProcessingItemId(item.id)
    try {
      const result = await processStockAdjustmentRequestItem(request.id, item.id)
      setProcessResult(result)
      showSuccess(
        result.message
        || `Đã xử lý ${item.skuCode || 'sản phẩm'} trong yêu cầu ${request.requestCode}.`,
      )
      await loadData()
      await refreshDetail(request.id)
    } catch (error) {
      showError(getStockFlowErrorMessage(error, 'Không xử lý được sản phẩm trong yêu cầu.'))
    } finally {
      setProcessingItemId(null)
    }
  }

  async function handleConfirmTransfer(request, item) {
    if (!request?.id || !item?.id) {
      showError('Không xác định được sản phẩm cần xác nhận chuyển lên Kệ.')
      return
    }

    setProcessingItemId(item.id)
    try {
      const result = await confirmStockAdjustmentRequestTransfer(request.id, item.id)
      showSuccess(result.message || 'Đã xác nhận chuyển đủ hàng lên Kệ.')
      await loadData()
      await refreshDetail(request.id)
    } catch (error) {
      showError(getStockFlowErrorMessage(error, 'Không thể xác nhận chuyển hàng lên Kệ.'))
    } finally {
      setProcessingItemId(null)
    }
  }

  async function handleApprove(request) {
    if (!request?.id) {
      showError('Không xác định được yêu cầu cần duyệt.')
      return
    }
    setIsApproving(true)
    try {
      await approveStockAdjustmentRequest(request.id)
      showSuccess(`Đã duyệt và chuyển hàng lên Kệ cho ${request.requestCode}.`)
      await loadData()
      await refreshDetail(request.id)
    } catch (error) {
      showError(getStockFlowErrorMessage(error, 'Không duyệt được yêu cầu.'))
    } finally {
      setIsApproving(false)
    }
  }

  async function handleReject(id) {
    if (!rejectReason.trim()) {
      showError('Vui lòng nhập lý do từ chối.')
      return
    }
    setActingId(id)
    try {
      await rejectStockAdjustmentRequest(id, rejectReason)
      showSuccess('Đã từ chối yêu cầu.')
      setRejectTarget(null)
      setRejectReason('')
      await loadData()
      await refreshDetail(id)
    } catch (error) {
      showError(getStockFlowErrorMessage(error, 'Không từ chối được yêu cầu.'))
    } finally {
      setActingId(null)
    }
  }

  async function handleCancel(id) {
    if (!cancelReason.trim()) {
      showError('Vui lòng nhập lý do hủy.')
      return
    }
    setActingId(id)
    try {
      await cancelStockAdjustmentRequest(id, cancelReason)
      showSuccess('Đã hủy yêu cầu.')
      setCancelTarget(null)
      setCancelReason('')
      await loadData()
      await refreshDetail(id)
    } catch (error) {
      showError(getStockFlowErrorMessage(error))
    } finally {
      setActingId(null)
    }
  }

  const creatorColumnLabel = canReview ? 'Người yêu cầu' : 'Người tạo'
  return (
    <PageShell className="-mt-2 !gap-1 sm:-mt-3 sm:!gap-1.5 lg:-mt-4 xl:-mt-5">
      <PageHeader
        compact
        searchCompact
        title={STOCK_FLOW_TERMS.request}
        titleInfo={
          canReview
            ? 'Nhân viên kho xử lý trọn từng sản phẩm. Đủ Thành phẩm thì hệ thống chuẩn bị chuyển lên Kệ; thiếu thì kiểm tra BOM và tự tạo Lệnh sản xuất nếu đủ Nguyên liệu/Bao bì.'
            : `Gửi yêu cầu bổ sung hàng thành phẩm từ ${STOCK_FLOW_TERMS.warehouse} sang ${STOCK_FLOW_TERMS.shelf}.`
        }
        searchPlaceholder="Tìm mã yêu cầu, mã SKU, tên sản phẩm..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
        rightContent={canCreateRequest ? (
          <button
            type="button"
            onClick={() => navigate('/inventory/stock-requests/create')}
            className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Tạo yêu cầu
          </button>
        ) : null}
      />

      <InventorySimulationBanner simulateWarehouse={simulateWarehouse} warehouseView={canReview} />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusFilterChips
            dense
            options={quickFilterChipOptions}
            value={activeTab}
            onChange={(value) => {
              setActiveTab(value)
              setPage(1)
            }}
          />
          <label>
            <span className="sr-only">Từ ngày</span>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) => updateDraft({ fromDate: event.target.value })}
              className={listFilterControlClass}
            />
          </label>

          <label>
            <span className="sr-only">Đến ngày</span>
            <input
              type="date"
              value={filters.toDate}
              onChange={(event) => updateDraft({ toDate: event.target.value })}
              className={listFilterControlClass}
            />
          </label>

          <label>
            <span className="sr-only">Sắp xếp</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value)
                setPage(1)
              }}
              className={`${listFilterSelectClass} min-w-[9.5rem]`}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value || 'default'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleClearFilters}
              className={`${listFilterControlClass} font-semibold hover:bg-slate-50`}
            >
              Xóa lọc
            </button>
          ) : null}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-[1120px] w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-[11%] whitespace-nowrap px-4 py-3">Mã yêu cầu</th>
                <th className="w-[11%] whitespace-nowrap px-4 py-3">Trạng thái</th>
                <th className="w-[14%] whitespace-nowrap px-4 py-3">{creatorColumnLabel}</th>
                <th className="w-[16%] whitespace-nowrap px-4 py-3">Thời gian gửi</th>
                <th className="w-[6%] whitespace-nowrap px-4 py-3 text-center">Sản phẩm</th>
                <th className="w-[7%] whitespace-nowrap px-4 py-3 text-center">Tiến độ</th>
                <th className="w-[9%] whitespace-nowrap px-4 py-3 text-center">Còn thiếu</th>
                <th className="w-[15%] whitespace-nowrap px-4 py-3">Xử lý gần nhất</th>
                <th className="w-[11%] whitespace-nowrap px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                      Đang tải yêu cầu...
                    </span>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <p className="font-semibold text-slate-800">
                      {searchValue.trim() || activeTab !== (canReview ? 'remaining' : 'all')
                        ? 'Không có yêu cầu khớp bộ lọc'
                        : 'Chưa có yêu cầu bổ sung tồn'}
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                      {searchValue.trim() || activeTab !== (canReview ? 'remaining' : 'all')
                        ? 'Thử đổi tab hoặc xóa từ khóa tìm kiếm.'
                        : 'Tạo yêu cầu khi Kệ Hàng thiếu hàng. Nhân viên kho sẽ xử lý đủ từng sản phẩm.'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {searchValue.trim() || activeTab !== (canReview ? 'remaining' : 'all') ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchValue('')
                            setActiveTab(canReview ? 'remaining' : 'all')
                            setPage(1)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                          Xóa bộ lọc
                        </button>
                      ) : null}
                      {canCreateRequest ? (
                        <button
                          type="button"
                          onClick={() => navigate('/inventory/stock-requests/create')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                          Tạo yêu cầu
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((row) => {
                  // Đếm theo dòng sản phẩm; không cộng số lượng giữa các SKU khác đơn vị.
                  const itemCount = Number(row.itemCount ?? 0)
                  const processedItemCount = Number(row.processedItemCount ?? 0)
                  const remainingItemCount = Number(row.remainingItemCount ?? 0)
                  const isOwnRequest = currentUserId
                    && String(row.requestedBy ?? '').toLowerCase() === currentUserId.toLowerCase()
                  const canCancelRow = row.status === 'pending'
                    && canCancelRequest
                    && (canCancelAnyRequest || isOwnRequest)
                  return (
                    <tr key={row.id} className="hover:bg-[#fbf9f1]/50">
                      <td className="whitespace-nowrap px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setDetailId(row.id)}
                          title="Xem chi tiết yêu cầu"
                          className="font-mono text-xs font-bold text-[#356647] underline-offset-2 hover:underline"
                        >
                          {row.requestCode || '—'}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {(() => {
                          const statusPresentation = getAdjustmentRequestStatusPresentation(row)
                          const rejectedQuantity = Number(row.totalRejectedQuantity ?? 0)

                          return (
                            <>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPresentation.className}`}
                        >
                          {statusPresentation.label}
                        </span>
                              {rejectedQuantity > 0 ? (
                                <span className="mt-1 block text-xs font-semibold text-rose-700">
                                  Từ chối: {formatStockQuantity(rejectedQuantity)}
                                </span>
                              ) : null}
                            </>
                          )
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-800">
                        <span className="block font-medium">{textOrDash(row.requestedByName)}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {formatCreatorRole(row.requestedByRoleName)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                        {formatVietnamDateTime(row.requestedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-slate-700">
                        {itemCount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-xs font-semibold text-slate-700">
                        {processedItemCount}/{itemCount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center">
                        <span
                          className={
                            remainingItemCount > 0
                              ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800'
                              : 'text-xs font-semibold text-slate-400'
                          }
                        >
                          {remainingItemCount} sản phẩm
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                        <span className="block font-medium">{textOrDash(row.reviewedByName)}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {row.reviewedAt ? formatVietnamDateTime(row.reviewedAt) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailId(row.id)}
                            title="Xem chi tiết yêu cầu"
                            aria-label={`Xem chi tiết ${row.requestCode || 'yêu cầu'}`}
                            className="rounded-lg p-2 text-[#356647] hover:bg-[#eef6f0]"
                          >
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                          {canCancelRow ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelTarget(row)
                                setCancelReason('')
                              }}
                              title="Hủy yêu cầu"
                              aria-label={`Hủy ${row.requestCode || 'yêu cầu'}`}
                              className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                            >
                              <span className="material-symbols-outlined text-[20px]">cancel</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalCount={totalCount}
          itemLabel="yêu cầu"
          disabled={isLoading}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </section>

      {detailId ? (
        <div className="inventory-modal fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
          <div className="my-auto w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-800">Chi tiết {STOCK_FLOW_TERMS.request}</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDetailId(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>

            {isLoadingDetail && !detail ? (
              <p className="text-sm text-slate-500">Đang tải chi tiết...</p>
            ) : detail ? (
              <StockAdjustmentRequestDetailPanel
                request={detail}
                canReview={canReview}
                canCancel={canCancelRequest}
                canCancelAny={canCancelAnyRequest}
                currentUserId={currentUserId}
                activeTab={activeTab}
                processingItemId={processingItemId}
                isApproving={isApproving}
                onProcessItem={handleProcessItem}
                onConfirmTransfer={handleConfirmTransfer}
                onApprove={handleApprove}
                onReject={setRejectTarget}
                onCancel={setCancelTarget}
              />
            ) : (
              <p className="text-sm text-slate-500">
                Không tải được chi tiết yêu cầu. Vui lòng đóng và thử lại.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {cancelTarget ? (
        <div className="inventory-modal fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Hủy yêu cầu {cancelTarget.requestCode}</h3>
            <p className="mt-2 text-sm text-slate-600">Hủy yêu cầu đang chờ tiếp nhận, không thay đổi tồn kho.</p>
            <label className="mt-4 block space-y-2">
              <span className="text-xs font-semibold text-slate-500">Lý do hủy *</span>
              <ReasonSuggestionChips
                suggestions={getReasonSuggestions('stockAdjustmentCancel')}
                value={cancelReason}
                onSelect={setCancelReason}
              />
              <textarea
                rows={3}
                required
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                className="w-full resize-none rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null)
                  setCancelReason('')
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={actingId === cancelTarget.id}
                onClick={() => handleCancel(cancelTarget.id)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectTarget ? (
        <div className="inventory-modal fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Từ chối yêu cầu {rejectTarget.requestCode}</h3>
            <p className="mt-2 text-sm text-slate-600">Từ chối toàn bộ yêu cầu đang chờ — không thay đổi tồn kho.</p>
            <label className="mt-4 block space-y-2">
              <span className="text-xs font-semibold text-slate-500">Lý do từ chối *</span>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                className="w-full resize-none rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null)
                  setRejectReason('')
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={actingId === rejectTarget.id}
                onClick={() => handleReject(rejectTarget.id)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ShelfReplenishmentProcessResultModal
        result={processResult}
        onClose={() => setProcessResult(null)}
      />

    </PageShell>
  )
}

/**
 * Admin có độ ưu tiên cao nhất kể cả khi kiêm nhiệm Sale/Manager/Warehouse:
 * luôn nhận giao diện tra soát chỉ đọc, không có tab và không có thao tác nghiệp vụ.
 * Tách thành hai component để thứ tự hook của mỗi nhánh luôn ổn định.
 */
function StockAdjustmentRequestsPage() {
  if (isAuditOnlyAdmin(loadAuthSession())) {
    return <StockAdjustmentRequestAuditView />
  }
  return <StockAdjustmentRequestOperationsPage />
}

export default StockAdjustmentRequestsPage
