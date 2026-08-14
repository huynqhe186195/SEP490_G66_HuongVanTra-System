import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import ReasonSuggestionChips from '../../../components/shared/ReasonSuggestionChips.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  canCancelStockReplenishmentRequest,
  canCreateStockReplenishmentRequest,
  canFilterStockReplenishmentByCreator,
  canReviewStockReplenishmentRequest,
  isAuditOnlyAdmin,
  isWarehouseRole,
  canViewStockTransfer,
} from '../../auth/utils/permissions.js'
import { getReasonSuggestions } from '../../shared/reasonSuggestions.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import InventorySimulationBanner from '../components/InventorySimulationBanner.jsx'
import StockAdjustmentRequestAuditView from '../components/StockAdjustmentRequestAuditView.jsx'
import StockAdjustmentRequestDetailPanel from '../components/StockAdjustmentRequestDetailPanel.jsx'
import { SlipActionButtons, SlipPrintStyles, StockTransferDocument } from '../components/InventorySlipDocument.jsx'
import { formatCreatorRole, UNKNOWN_CREATOR_VALUE } from '../utils/inventoryCreatorDisplay.js'
import { fetchInventorySettings, fetchSkuStocks, fetchStoreSkuStocks } from '../services/inventoryStockApi.js'
import {
  cancelStockAdjustmentRequest,
  closeStockAdjustmentRemaining,
  fetchStockAdjustmentRequestById,
  fetchStockAdjustmentRequestFilterOptions,
  fetchStockAdjustmentRequestTransfers,
  fetchStockAdjustmentRequests,
  getAdjustmentStatusClass,
  getAdjustmentStatusLabel,
  rejectStockAdjustmentRequest,
  reviewStockAdjustmentRequest,
} from '../services/stockAdjustmentRequestApi.js'
import {
  getStockFlowErrorMessage,
  getStockFlowStatusClass,
  getStockTransferStatusLabel,
  STOCK_FLOW_TERMS,
  STOCK_REQUEST_STATUS_OPTIONS,
} from '../utils/stockFlowLabels.js'
import { fetchStockTransferById } from '../services/stockTransferApi.js'

/** Trạng thái yêu cầu còn cho phép Thủ kho tạo phiếu điều chuyển từ chi tiết. */
const TRANSFERABLE_STATUSES = ['approved', 'processing', 'partiallyfulfilled']

/**
 * Bộ lọc nhanh của Quản lý. Mỗi mục chỉ đặt tham số truy vấn phía máy chủ,
 * không lọc lại trên trang hiện tại để tránh phân trang giả.
 */
const MANAGER_QUICK_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'mine', label: 'Yêu cầu của tôi', mine: true },
  { key: 'pending', label: 'Chờ tiếp nhận', status: 'Pending' },
  { key: 'processing', label: 'Đang xử lý', status: 'Processing' },
  { key: 'remaining', label: 'Còn thiếu', onlyRemaining: true },
  { key: 'processed', label: 'Đã xử lý', status: 'processed' },
]

/** Thủ kho không tạo yêu cầu nên không có mục "Yêu cầu của tôi". */
const WAREHOUSE_QUICK_FILTERS = MANAGER_QUICK_FILTERS.filter((tab) => tab.key !== 'mine')

const EMPTY_FILTERS = {
  status: '',
  createdBy: '',
  creatorRole: '',
  fromDate: '',
  toDate: '',
  onlyRemaining: false,
}

const SORT_OPTIONS = [
  { value: '', label: 'Mới nhất trước' },
  { value: 'oldest', label: 'Cũ nhất trước' },
  { value: 'warehouse_priority', label: 'Ưu tiên xử lý của Thủ kho' },
  { value: 'code_asc', label: 'Mã yêu cầu tăng dần' },
  { value: 'code_desc', label: 'Mã yêu cầu giảm dần' },
  { value: 'status', label: 'Theo trạng thái' },
]

const FIELD_CLASS =
  'min-h-[40px] w-full rounded-xl border border-slate-200 bg-[#fbf9f1] px-4 py-2.5 text-sm outline-none focus:border-[#538463]'
const LABEL_CLASS = 'mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'

/** Lý do từ chối gợi ý cho Thủ kho, bấm để điền nhanh vào ô lý do. */
const REJECT_REASON_PRESETS = [
  'Kho không đủ tồn để đáp ứng yêu cầu.',
  'Sản phẩm yêu cầu đã hết hàng tại Kho.',
  'Số lượng yêu cầu vượt quá nhu cầu thực tế của Kệ.',
  'Sai sản phẩm hoặc sai đơn vị tính trong yêu cầu.',
  'Trùng với yêu cầu bổ sung đã được duyệt trước đó.',
  'Hàng đang chờ kiểm tra chất lượng, chưa thể xuất Kho.',
]

function textOrDash(value) {
  const trimmed = String(value ?? '').trim()
  return trimmed || UNKNOWN_CREATOR_VALUE
}

function StockTransferPreviewModal({ transfer, isLoading, onClose }) {
  const documentRef = useRef(null)
  if (!transfer && !isLoading) return null

  const statusLabel = transfer ? getStockTransferStatusLabel(transfer.status) : ''
  return (
    <div className="inventory-modal fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
      <SlipPrintStyles />
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            <span className="inline-flex items-center gap-2 font-semibold">
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              Đang tải Phiếu Điều Chuyển...
            </span>
          </div>
        ) : (
          <>
            <div className="no-print flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-mono text-xl font-bold text-slate-900">{transfer.transferCode}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStockFlowStatusClass(transfer.status)}`}>
                    {statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {STOCK_FLOW_TERMS.warehouse} → {STOCK_FLOW_TERMS.shelf}
                  {transfer.sourceRequestCode ? ` · ${STOCK_FLOW_TERMS.request}: ${transfer.sourceRequestCode}` : ''}
                </p>
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng Phiếu Điều Chuyển">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="px-6 py-5">
              <SlipActionButtons documentRef={documentRef} filename={`${transfer.transferCode || 'phieu-dieu-chuyen'}.pdf`} />
              <div ref={documentRef}>
                <StockTransferDocument transfer={transfer} statusLabel={statusLabel} />
              </div>
            </div>
          </>
        )}

        <div className="no-print flex justify-end border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Duyệt theo từng dòng. Duyệt KHÔNG làm thay đổi tồn kho — tồn chỉ đổi khi
 * Phiếu điều chuyển Kho → Kệ được hoàn tất.
 */
function ReviewStockRequestModal({ request, onClose, onConfirm, isSaving }) {
  const [stockBySkuId, setStockBySkuId] = useState(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [reviewNote, setReviewNote] = useState('')
  const [lineState, setLineState] = useState(() => {
    const initial = {}
    for (const item of request?.items ?? []) {
      initial[item.id] = {
        approved: true,
        approvedQuantity: String(item.remainingQuantity || item.requestedQuantity || 0),
        note: '',
      }
    }
    return initial
  })

  useEffect(() => {
    let mounted = true
    const fetchFn = isWarehouseRole(loadAuthSession()) ? fetchSkuStocks : fetchStoreSkuStocks
    fetchFn()
      .then((stocks) => {
        if (!mounted) return
        setStockBySkuId(new Map(stocks.map((stock) => [stock.skuId, stock])))
      })
      .catch((error) => showError(error.message))
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (!request) return null

  const items = Array.isArray(request.items) ? request.items : []
  const requestCode = request.requestCode || '—'

  function patchLine(itemId, patch) {
    setLineState((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } }))
  }

  function handleConfirm() {
    const lines = []
    for (const item of items) {
      const state = lineState[item.id] ?? {}
      if (!state.approved) {
        lines.push({ itemId: item.id, approved: false, approvedQuantity: null, note: state.note })
        continue
      }
      const parsed = Number(state.approvedQuantity)
      if (!Number.isInteger(parsed) || parsed <= 0) {
        showError(`${STOCK_FLOW_TERMS.approvedQuantity} của ${item.skuCode} phải là số nguyên lớn hơn 0.`)
        return
      }
      if (parsed > Number(item.requestedQuantity ?? 0)) {
        showError(`${STOCK_FLOW_TERMS.approvedQuantity} của ${item.skuCode} không được vượt ${STOCK_FLOW_TERMS.requestedQuantity}.`)
        return
      }
      lines.push({ itemId: item.id, approved: true, approvedQuantity: parsed, note: state.note })
    }
    if (lines.length === 0) {
      showError('Yêu cầu không có dòng SKU nào để duyệt.')
      return
    }
    onConfirm?.(request.id, { reviewNote, lines })
  }

  return (
    <div className="inventory-modal fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[min(90dvh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Duyệt {STOCK_FLOW_TERMS.request}</h3>
            <p className="mt-1 font-mono text-sm font-semibold text-[#356647]">{requestCode}</p>
            <p className="mt-1 text-xs text-slate-600">
              Duyệt không làm thay đổi tồn kho. Tồn chỉ thay đổi khi {STOCK_FLOW_TERMS.transfer} được hoàn tất.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3 text-right">{STOCK_FLOW_TERMS.requestedQuantity}</th>
                  <th className="px-4 py-3 text-right">Tồn {STOCK_FLOW_TERMS.warehouse}</th>
                  <th className="px-4 py-3">Xác nhận</th>
                  <th className="px-4 py-3 text-right">{STOCK_FLOW_TERMS.approvedQuantity}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length > 0 ? (
                  items.map((item) => {
                    const stock = stockBySkuId.get(item.skuId)
                    const warehouseOnHand = Number(stock?.warehouseQuantityOnHand ?? 0)
                    const requested = Number(item.requestedQuantity ?? 0)
                    const state = lineState[item.id] ?? {}
                    const insufficient = warehouseOnHand < Number(state.approvedQuantity ?? 0)
                    return (
                      <tr key={item.id ?? item.skuId ?? item.skuCode}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{item.skuSnapshotName || '—'}</p>
                          <p className="mt-0.5 font-mono text-xs font-bold text-[#356647]">{item.skuCode || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatStockQuantity(requested)}</td>
                        <td className={`px-4 py-3 text-right ${insufficient ? 'font-semibold text-rose-700' : 'text-slate-600'}`}>
                          {isLoading ? 'Đang tải...' : formatStockQuantity(warehouseOnHand)}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Xác nhận duyệt ${item.skuSnapshotName || item.skuCode || 'dòng này'}`}
                            checked={Boolean(state.approved)}
                            onChange={(event) => patchLine(item.id, { approved: event.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-[#538463] focus:ring-[#538463]"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max={requested}
                            step="1"
                            disabled={!state.approved}
                            value={state.approvedQuantity ?? ''}
                            onChange={(event) => patchLine(item.id, { approvedQuantity: event.target.value })}
                            className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-right text-sm text-slate-900 outline-none focus:border-[#538463] disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                      Chưa có dòng SKU để duyệt.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">Ghi chú duyệt</span>
            <textarea
              rows={2}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#538463]"
              placeholder="VD: Duyệt một phần do Kho chưa đủ hàng."
            />
          </label>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Đóng
          </button>
          <button
            type="button"
            disabled={isSaving || items.length === 0 || !request.id}
            onClick={handleConfirm}
            className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
          >
            {isSaving ? 'Đang duyệt...' : 'Xác nhận duyệt'}
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
  const canFilterByCreator = canFilterStockReplenishmentByCreator(session)
  const canViewTransfer = canViewStockTransfer(session)
  const currentUserId = session?.userId ? String(session.userId) : ''

  const quickFilters = canReview ? WAREHOUSE_QUICK_FILTERS : MANAGER_QUICK_FILTERS
  const [activeTab, setActiveTab] = useState(canReview ? 'pending' : 'all')
  const [searchValue, setSearchValue] = useState(() => location.state?.search ?? '')
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState(canReview ? 'warehouse_priority' : '')
  const [requests, setRequests] = useState([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])
  const [creatorOptions, setCreatorOptions] = useState([])
  const [creatorRoleOptions, setCreatorRoleOptions] = useState([])
  const [detailId, setDetailId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [relatedTransfers, setRelatedTransfers] = useState([])
  const [selectedTransfer, setSelectedTransfer] = useState(null)
  const [isLoadingTransfer, setIsLoadingTransfer] = useState(false)
  const [actingId, setActingId] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [reviewTarget, setReviewTarget] = useState(null)
  const [closeTarget, setCloseTarget] = useState(null)
  const [closeReason, setCloseReason] = useState('')
  const [simulateWarehouse, setSimulateWarehouse] = useState(true)

  const activeQuickFilter = quickFilters.find((tab) => tab.key === activeTab) ?? quickFilters[0]

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchStockAdjustmentRequests({
        // Bộ lọc chi tiết được ưu tiên hơn bộ lọc nhanh khi người dùng chọn cụ thể.
        status: appliedFilters.status || activeQuickFilter?.status || undefined,
        mine: Boolean(activeQuickFilter?.mine),
        onlyRemaining: appliedFilters.onlyRemaining || Boolean(activeQuickFilter?.onlyRemaining),
        search: searchValue.trim() || undefined,
        createdBy: appliedFilters.createdBy || undefined,
        creatorRole: appliedFilters.creatorRole || undefined,
        fromDate: appliedFilters.fromDate || undefined,
        toDate: appliedFilters.toDate || undefined,
        sort: sort || undefined,
        page,
        pageSize,
      })
      setRequests(data.items)
      setTotalCount(data.totalCount)
    } catch (error) {
      setRequests([])
      setTotalCount(0)
      showError(getStockFlowErrorMessage(error, 'Không tải được danh sách yêu cầu.'))
    } finally {
      setIsLoading(false)
    }
  }, [activeQuickFilter, appliedFilters, searchValue, sort, page, pageSize])

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
    // Sale thuần chỉ xem yêu cầu của chính mình nên không có bộ lọc người tạo;
    // backend cũng chặn endpoint filter-options với vai trò này.
    if (!canFilterByCreator) return undefined
    let mounted = true
    fetchStockAdjustmentRequestFilterOptions()
      .then((options) => {
        if (!mounted) return
        setCreatorOptions(options.creators)
        setCreatorRoleOptions(options.creatorRoles)
      })
      .catch(() => {
        if (!mounted) return
        setCreatorOptions([])
        setCreatorRoleOptions([])
      })
    return () => {
      mounted = false
    }
  }, [canFilterByCreator])

  useEffect(() => {
    const nextSearch = location.state?.search
    if (!nextSearch) return
    setSearchValue(nextSearch)
    setActiveTab(canReview ? 'pending' : 'all')
    setPage(1)
  }, [canReview, location.key, location.state])

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      setRelatedTransfers([])
      return undefined
    }

    let mounted = true
    setIsLoadingDetail(true)
    Promise.all([
      fetchStockAdjustmentRequestById(detailId),
      fetchStockAdjustmentRequestTransfers(detailId).catch(() => []),
    ])
      .then(([request, transfers]) => {
        if (!mounted) return
        setDetail(request)
        setRelatedTransfers(transfers)
      })
      .catch((error) => {
        if (!mounted) return
        setDetail(null)
        setRelatedTransfers([])
        showError(getStockFlowErrorMessage(error, 'Không tải được chi tiết yêu cầu.'))
      })
      .finally(() => {
        if (mounted) setIsLoadingDetail(false)
      })

    return () => {
      mounted = false
    }
  }, [detailId])

  const hasActiveFilters = useMemo(
    () =>
      Boolean(appliedFilters.onlyRemaining)
      || ['status', 'createdBy', 'creatorRole', 'fromDate', 'toDate'].some(
        (key) => String(appliedFilters[key] ?? '').trim() !== '',
      )
      || searchValue.trim() !== '',
    [appliedFilters, searchValue],
  )

  function updateDraft(patch) {
    setDraftFilters((prev) => ({ ...prev, ...patch }))
  }

  function handleSubmitFilters(event) {
    event.preventDefault()
    if (draftFilters.fromDate && draftFilters.toDate && draftFilters.toDate < draftFilters.fromDate) {
      showError('Khoảng thời gian không hợp lệ: ngày kết thúc phải sau hoặc bằng ngày bắt đầu.')
      return
    }
    setAppliedFilters(draftFilters)
    setPage(1)
  }

  function handleClearFilters() {
    setDraftFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setSearchValue('')
    setSort(canReview ? 'warehouse_priority' : '')
    setActiveTab(canReview ? 'pending' : 'all')
    setPage(1)
  }

  async function refreshDetail(id) {
    if (!id) return
    try {
      const [request, transfers] = await Promise.all([
        fetchStockAdjustmentRequestById(id),
        fetchStockAdjustmentRequestTransfers(id).catch(() => []),
      ])
      setDetail(request)
      setRelatedTransfers(transfers)
    } catch {
      // Danh sách đã được tải lại; lỗi tải chi tiết không chặn luồng thao tác.
    }
  }

  /** Duyệt theo dòng — không chạm tồn kho, nên không phát sự kiện đổi tồn. */
  async function handleReview(id, payload) {
    if (!id) {
      showError('Không xác định được yêu cầu cần duyệt.')
      return
    }

    setActingId(id)
    try {
      const updated = await reviewStockAdjustmentRequest(id, payload)
      showSuccess(
        `Đã duyệt ${STOCK_FLOW_TERMS.request} ${updated.requestCode}. Trạng thái: ${getAdjustmentStatusLabel(updated.status)}. `
        + `Tồn kho chưa thay đổi — hãy tạo ${STOCK_FLOW_TERMS.transfer} để thực hiện.`,
      )
      setReviewTarget(null)
      await loadData()
      await refreshDetail(id)
    } catch (error) {
      showError(getStockFlowErrorMessage(error))
    } finally {
      setActingId(null)
    }
  }

  async function handleCloseRemaining(id) {
    if (!closeReason.trim()) {
      showError('Vui lòng nhập lý do đóng phần còn lại.')
      return
    }
    setActingId(id)
    try {
      const updated = await closeStockAdjustmentRemaining(id, closeReason)
      showSuccess(`Đã đóng phần còn lại. Trạng thái: ${getAdjustmentStatusLabel(updated.status)}.`)
      setCloseTarget(null)
      setCloseReason('')
      await loadData()
      await refreshDetail(id)
    } catch (error) {
      showError(getStockFlowErrorMessage(error))
    } finally {
      setActingId(null)
    }
  }

  async function handleReject() {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      showError('Vui lòng nhập lý do từ chối.')
      return
    }
    setActingId(rejectTarget.id)
    try {
      await rejectStockAdjustmentRequest(rejectTarget.id, rejectReason)
      showSuccess('Đã từ chối yêu cầu.')
      const rejectedId = rejectTarget.id
      setRejectTarget(null)
      setRejectReason('')
      await loadData()
      await refreshDetail(rejectedId)
    } catch (error) {
      showError(getStockFlowErrorMessage(error))
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

  async function handleViewTransfer(transferId) {
    if (!transferId) return
    setIsLoadingTransfer(true)
    try {
      const transfer = await fetchStockTransferById(transferId)
      setSelectedTransfer({
        ...transfer,
        sourceRequestedByName: transfer.sourceRequestedByName || detail?.requestedByName || '',
      })
    } catch (error) {
      showError(getStockFlowErrorMessage(error, 'Không tải được Phiếu Điều Chuyển.'))
    } finally {
      setIsLoadingTransfer(false)
    }
  }

  const creatorColumnLabel = canReview ? 'Người yêu cầu' : 'Người tạo'
  const canCreateTransferFromDetail =
    canReview && detail && TRANSFERABLE_STATUSES.includes(String(detail.status ?? '').toLowerCase())
  const latestRelatedTransfer = relatedTransfers[0] ?? null

  return (
    <PageShell>
      <PageHeader
        compact
        title={STOCK_FLOW_TERMS.request}
        titleInfo={
          canReview
            ? `Thủ kho duyệt từng dòng SKU. Duyệt không đổi tồn — tồn chỉ đổi khi ${STOCK_FLOW_TERMS.transfer} hoàn tất.`
            : `Gửi yêu cầu bổ sung hàng thành phẩm từ ${STOCK_FLOW_TERMS.warehouse} sang ${STOCK_FLOW_TERMS.shelf}.`
        }
        description="Bấm vào mã yêu cầu để xem chi tiết và thao tác."
        searchPlaceholder="Tìm mã yêu cầu, mã SKU, tên sản phẩm..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
      />

      <InventorySimulationBanner simulateWarehouse={simulateWarehouse} warehouseView={canReview} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {quickFilters.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key)
              setPage(1)
            }}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-[#538463] text-white shadow-md shadow-[#538463]/20'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {canCreateRequest ? (
          <button
            type="button"
            onClick={() => navigate('/inventory/stock-requests/create')}
            className="ml-auto rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Tạo yêu cầu
          </button>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmitFilters}
        className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px]">
            <span className={LABEL_CLASS}>Trạng thái</span>
            <select
              value={draftFilters.status}
              onChange={(event) => updateDraft({ status: event.target.value })}
              className={FIELD_CLASS}
            >
              <option value="">Tất cả trạng thái</option>
              {STOCK_REQUEST_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {canFilterByCreator ? (
            <>
              <label className="min-w-[200px]">
                <span className={LABEL_CLASS}>{creatorColumnLabel}</span>
                <select
                  value={draftFilters.createdBy}
                  onChange={(event) => updateDraft({ createdBy: event.target.value })}
                  className={FIELD_CLASS}
                >
                  <option value="">Tất cả</option>
                  {creatorOptions.map((creator) => (
                    <option key={creator.id} value={creator.id}>
                      {textOrDash(creator.name)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-[180px]">
                <span className={LABEL_CLASS}>Chức vụ người tạo</span>
                <select
                  value={draftFilters.creatorRole}
                  onChange={(event) => updateDraft({ creatorRole: event.target.value })}
                  className={FIELD_CLASS}
                >
                  <option value="">Tất cả chức vụ</option>
                  {creatorRoleOptions.map((role) => (
                    <option key={role} value={role}>
                      {formatCreatorRole(role)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className="min-w-[150px]">
            <span className={LABEL_CLASS}>Từ ngày</span>
            <input
              type="date"
              value={draftFilters.fromDate}
              onChange={(event) => updateDraft({ fromDate: event.target.value })}
              className={FIELD_CLASS}
            />
          </label>

          <label className="min-w-[150px]">
            <span className={LABEL_CLASS}>Đến ngày</span>
            <input
              type="date"
              value={draftFilters.toDate}
              onChange={(event) => updateDraft({ toDate: event.target.value })}
              className={FIELD_CLASS}
            />
          </label>

          <label className="min-w-[200px]">
            <span className={LABEL_CLASS}>Sắp xếp</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value)
                setPage(1)
              }}
              className={FIELD_CLASS}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value || 'default'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={draftFilters.onlyRemaining}
              onChange={(event) => updateDraft({ onlyRemaining: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-[#538463] focus:ring-[#538463]"
            />
            Chỉ còn thiếu
          </label>

          <button
            type="submit"
            className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Áp dụng bộ lọc
          </button>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Xóa bộ lọc
            </button>
          ) : null}
        </div>
      </form>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-[1120px] w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-[10%] whitespace-nowrap px-4 py-3">Mã yêu cầu</th>
                <th className="w-[10%] whitespace-nowrap px-4 py-3">Trạng thái</th>
                <th className="w-[14%] whitespace-nowrap px-4 py-3">{creatorColumnLabel}</th>
                <th className="w-[13%] whitespace-nowrap px-4 py-3">Thời gian gửi</th>
                <th className="w-[9%] whitespace-nowrap px-4 py-3 text-right">Sản phẩm</th>
                <th className="w-[13%] whitespace-nowrap px-4 py-3">Tiến độ</th>
                <th className="w-[9%] whitespace-nowrap px-4 py-3 text-right">Còn thiếu</th>
                <th className="w-[13%] whitespace-nowrap px-4 py-3">Xử lý gần nhất</th>
                <th className="w-[9%] whitespace-nowrap px-4 py-3 text-center">Thao tác</th>
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
                      {searchValue.trim() || activeTab !== (canReview ? 'pending' : 'all')
                        ? 'Không có yêu cầu khớp bộ lọc'
                        : 'Chưa có yêu cầu bổ sung tồn'}
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                      {searchValue.trim() || activeTab !== (canReview ? 'pending' : 'all')
                        ? 'Thử đổi tab hoặc xóa từ khóa tìm kiếm.'
                        : 'Tạo yêu cầu khi Kệ thiếu hàng. Thủ kho sẽ điều chuyển từ Kho sang Kệ.'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {searchValue.trim() || activeTab !== (canReview ? 'pending' : 'all') ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchValue('')
                            setActiveTab(canReview ? 'pending' : 'all')
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
                      <button
                        type="button"
                        onClick={() => navigate('/inventory/stock-transfers')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                        Xem điều chuyển
                      </button>
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
                    && (canCancelAnyRequest || isOwnRequest || activeTab === 'mine')
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
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getAdjustmentStatusClass(row.status)}`}
                        >
                          {getAdjustmentStatusLabel(row.status)}
                        </span>
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
                      <td className="whitespace-nowrap px-4 py-4 text-right text-slate-700">
                        {itemCount} sản phẩm
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs font-semibold text-slate-700">
                        {processedItemCount}/{itemCount} sản phẩm hoàn tất
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right">
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
                {canViewTransfer && latestRelatedTransfer ? (
                  <button
                    type="button"
                    onClick={() => handleViewTransfer(latestRelatedTransfer.transferId)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    title={relatedTransfers.length > 1 ? 'Xem Phiếu Điều Chuyển mới nhất' : 'Xem Phiếu Điều Chuyển'}
                  >
                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                    Xem Phiếu
                  </button>
                ) : null}
                {canCreateTransferFromDetail ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/inventory/stock-transfers/create?sourceRequestId=${detail.id}`)}
                    className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053]"
                  >
                    Tạo {STOCK_FLOW_TERMS.transfer}
                  </button>
                ) : null}
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
                relatedTransfers={relatedTransfers}
                canReview={canReview}
                canCancel={canCancelRequest}
                canCancelAny={canCancelAnyRequest}
                currentUserId={currentUserId}
                activeTab={activeTab}
                actingId={actingId}
                onReview={setReviewTarget}
                onReject={setRejectTarget}
                onCancel={setCancelTarget}
                onCloseRemaining={setCloseTarget}
              />
            ) : (
              <p className="text-sm text-slate-500">
                Không tải được chi tiết yêu cầu. Vui lòng đóng và thử lại.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {rejectTarget ? (
        <div className="inventory-modal fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Từ chối yêu cầu {rejectTarget.requestCode}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {rejectTarget.itemCount} sản phẩm trong yêu cầu. Từ chối không làm thay đổi tồn kho.
            </p>
            <div className="mt-4 space-y-2">
              <span className="text-xs font-semibold text-slate-500">Lý do thường gặp</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {REJECT_REASON_PRESETS.map((preset) => {
                  const selected = rejectReason.trim() === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRejectReason(preset)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                        selected
                          ? 'border-[#356647] bg-[#356647]/10 text-[#356647]'
                          : 'border-slate-200 bg-[#fbf9f1] text-slate-600 hover:border-[#356647]/40'
                      }`}
                    >
                      {preset}
                    </button>
                  )
                })}
              </div>
            </div>
            <label className="mt-4 block space-y-2">
              <span className="text-xs font-semibold text-slate-500">Lý do từ chối *</span>
              <ReasonSuggestionChips
                suggestions={getReasonSuggestions('stockAdjustmentReject')}
                value={rejectReason}
                onSelect={setRejectReason}
              />
              <textarea
                rows={5}
                required
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Chọn lý do gợi ý phía trên hoặc nhập lý do khác..."
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
                onClick={handleReject}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Xác nhận từ chối
              </button>
            </div>
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

      {closeTarget ? (
        <div className="inventory-modal fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Đóng phần còn lại {closeTarget.requestCode}</h3>
            <p className="mt-2 text-sm text-slate-600">
              Đóng {STOCK_FLOW_TERMS.remainingQuantity} khi {STOCK_FLOW_TERMS.warehouse} không thể cấp thêm.
              Thao tác này không thay đổi tồn kho và không hủy phần đã chuyển.
            </p>
            <label className="mt-4 block space-y-2">
              <span className="text-xs font-semibold text-slate-500">Lý do đóng *</span>
              <ReasonSuggestionChips
                suggestions={getReasonSuggestions('stockAdjustmentCloseRemaining')}
                value={closeReason}
                onSelect={setCloseReason}
              />
              <textarea
                rows={3}
                required
                value={closeReason}
                onChange={(event) => setCloseReason(event.target.value)}
                className="w-full resize-none rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCloseTarget(null)
                  setCloseReason('')
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={actingId === closeTarget.id}
                onClick={() => handleCloseRemaining(closeTarget.id)}
                className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
              >
                Xác nhận đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewTarget ? (
        <ReviewStockRequestModal
          request={reviewTarget}
          isSaving={actingId === reviewTarget?.id}
          onClose={() => setReviewTarget(null)}
          onConfirm={handleReview}
        />
      ) : null}

      <StockTransferPreviewModal
        transfer={selectedTransfer}
        isLoading={isLoadingTransfer}
        onClose={() => {
          if (!isLoadingTransfer) setSelectedTransfer(null)
        }}
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
