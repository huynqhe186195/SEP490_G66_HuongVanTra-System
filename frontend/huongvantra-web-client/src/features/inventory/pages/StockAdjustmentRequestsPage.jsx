import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  canCancelStockReplenishmentRequest,
  canCreateStockReplenishmentRequest,
  canReviewStockReplenishmentRequest,
  isSystemAdmin,
} from '../../auth/utils/permissions.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import InventorySimulationBanner from '../components/InventorySimulationBanner.jsx'
import StockAdjustmentRequestDetailPanel from '../components/StockAdjustmentRequestDetailPanel.jsx'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import { notifyInventoryStockChanged } from '../utils/inventoryStockEvents.js'
import { fetchInventorySettings, fetchSkuStocks } from '../services/inventoryStockApi.js'
import {
  approveStockAdjustmentRequest,
  cancelStockAdjustmentRequest,
  createStockAdjustmentRequest,
  fetchStockAdjustmentRequestById,
  fetchStockAdjustmentRequests,
  getAdjustmentStatusClass,
  getAdjustmentStatusLabel,
  rejectStockAdjustmentRequest,
} from '../services/stockAdjustmentRequestApi.js'
import { fetchProducts } from '../../products/services/productsApi.js'
import { buildSkuSnapshotName } from '../../products/components/BatchStockAdjustmentModal.jsx'

const TABS = [
  { key: 'pending', label: 'Chờ duyệt', status: 'pending', mine: false },
  { key: 'mine', label: 'Yêu cầu của tôi', status: undefined, mine: true },
  { key: 'processed', label: 'Đã xử lý', status: undefined, mine: false, excludePending: true },
]

const REQUEST_TABS = TABS.map((tab) =>
  tab.key === 'processed'
    ? { ...tab, status: 'processed', excludePending: false }
    : tab,
)

function formatDelta(delta) {
  const value = Number(delta)
  if (!Number.isFinite(value)) return '—'
  if (value > 0) return `+${formatStockQuantity(value)}`
  return formatStockQuantity(value)
}

function getRequestMovementLabel(row) {
  if (row.hasIncrease && row.hasDecrease) return ' · bổ sung tồn quầy & giảm'
  if (row.hasIncrease) return ' · bổ sung tồn quầy'
  if (row.hasDecrease) return ' · giảm tồn'
  return ''
}

function flattenProductSkuOptions(products = [], stockBySkuId = new Map()) {
  return products.flatMap((product) => {
    const skus = product.variants?.length ? product.variants : (product.skus ?? [])
    return skus.map((sku) => ({
      sku,
      productName: product.name,
      skuSnapshotName: buildSkuSnapshotName(sku, product.name),
      warehouseQuantityOnHand: Number(stockBySkuId.get(sku.id)?.warehouseQuantityOnHand ?? 0),
      quantityOnHand: Number(stockBySkuId.get(sku.id)?.quantityOnHand ?? 0),
    }))
  })
}

function CreateStockRequestModal({ onClose, onSubmitted }) {
  const [search, setSearch] = useState('')
  const [skuOptions, setSkuOptions] = useState([])
  const [selectedOption, setSelectedOption] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('Bổ sung tồn quầy POS mặc định từ Kho tổng')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      try {
        const [products, stocks] = await Promise.all([
          fetchProducts({
            search: search.trim() || undefined,
            page: 1,
            pageSize: 20,
            isDeleted: false,
          }),
          fetchSkuStocks(),
        ])
        if (!mounted) return
        const stockBySkuId = new Map(stocks.map((stock) => [stock.skuId, stock]))
        setSkuOptions(flattenProductSkuOptions(products.items ?? [], stockBySkuId))
      } catch (error) {
        if (mounted) {
          setSkuOptions([])
          showError(error.message)
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }, 250)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [search])

  const parsedQuantity = Number(quantity)
  const canSubmit = selectedOption?.sku?.id && Number.isFinite(parsedQuantity) && parsedQuantity > 0

  async function handleSubmit(event) {
    event.preventDefault()

    if (!selectedOption?.sku?.id) {
      showError('Vui lòng chọn SKU cần bổ sung tồn quầy.')
      return
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      showError('Số lượng bổ sung tồn quầy phải lớn hơn 0.')
      return
    }
    if (!Number.isInteger(parsedQuantity)) {
      showError('Số lượng bổ sung tồn quầy phải là số nguyên.')
      return
    }
    if (parsedQuantity > Number(selectedOption.warehouseQuantityOnHand ?? 0)) {
      showError('Kho tổng không đủ tồn để bổ sung tồn quầy.')
      return
    }

    setIsSaving(true)
    try {
      const created = await createStockAdjustmentRequest({
        reason: reason.trim() || null,
        items: [
          {
            skuId: selectedOption.sku.id,
            skuCode: selectedOption.sku.skuCode,
            skuSnapshotName: selectedOption.skuSnapshotName,
            quantityDelta: parsedQuantity,
          },
        ],
      })
      showSuccess(`Đã gửi yêu cầu bổ sung tồn quầy ${created.requestCode}.`)
      onSubmitted?.(created)
      onClose?.()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[min(90dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Tạo yêu cầu bổ sung tồn quầy</h2>
            <p className="mt-1 text-sm text-slate-500">Kho tổng cấp hàng cho Tồn quầy POS mặc định. Không chọn chi nhánh/cửa hàng.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tìm SKU / sản phẩm</span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setSelectedOption(null)
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#538463]"
                placeholder="VD: FG-TRA-NHAI-50G hoặc tên sản phẩm"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Kho xuất</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Kho tổng</p>
                <p className="mt-1 text-xs text-slate-500">WarehouseQuantityOnHand</p>
              </div>
              <div className="hidden items-center justify-center px-1 text-slate-400 sm:flex">
                <span className="material-symbols-outlined text-[24px]">arrow_forward</span>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700">Kho nhận</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Tồn quầy POS mặc định</p>
                <p className="mt-1 text-xs text-slate-500">QuantityOnHand</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                SKU có thể yêu cầu
              </div>
              <div className="max-h-56 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                  <p className="px-4 py-6 text-sm text-slate-500">Đang tải SKU...</p>
                ) : skuOptions.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500">Không tìm thấy SKU phù hợp.</p>
                ) : (
                  skuOptions.map((option) => {
                    const selected = selectedOption?.sku?.id === option.sku.id
                    return (
                      <button
                        key={option.sku.id}
                        type="button"
                        onClick={() => setSelectedOption(option)}
                        className={`flex w-full items-start justify-between gap-3 border-b border-slate-50 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-[#fbf9f1] ${
                          selected ? 'bg-[#e8f1eb] text-[#356647]' : 'text-slate-700'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-xs font-bold">{option.sku.skuCode}</span>
                          <span className="mt-0.5 block truncate font-semibold">{option.skuSnapshotName}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{option.productName}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-slate-500">
                          Kho tổng: <strong>{formatStockQuantity(option.warehouseQuantityOnHand)}</strong>
                          <br />
                          Tồn quầy POS: <strong>{formatStockQuantity(option.quantityOnHand)}</strong>
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số lượng bổ sung *</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#538463]"
                  placeholder="VD: 10"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú</span>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#538463]"
                />
              </label>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving || !canSubmit}
              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ApproveStockRequestModal({ request, onClose, onConfirm, isSaving }) {
  const [stockBySkuId, setStockBySkuId] = useState(new Map())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetchSkuStocks()
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[min(90dvh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Duyệt yêu cầu bổ sung tồn quầy</h3>
            <p className="mt-1 font-mono text-sm font-semibold text-[#356647]">{requestCode}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Kho xuất</p>
              <p className="mt-1 text-sm font-bold text-slate-800">Kho tổng</p>
            </div>
            <div className="hidden items-center justify-center px-1 text-slate-400 sm:flex">
              <span className="material-symbols-outlined text-[24px]">arrow_forward</span>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700">Kho nhận</p>
              <p className="mt-1 text-sm font-bold text-slate-800">Tồn quầy POS mặc định</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">SL yêu cầu</th>
                  <th className="px-4 py-3 text-right">Kho tổng trước {'->'} sau</th>
                  <th className="px-4 py-3 text-right">Tồn quầy POS trước {'->'} sau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length > 0 ? (
                  items.map((item) => {
                    const stock = stockBySkuId.get(item.skuId)
                    const warehouseBefore = Number(stock?.warehouseQuantityOnHand ?? 0)
                    const counterBefore = Number(stock?.quantityOnHand ?? item.quantityOnHandSnapshot ?? 0)
                    const quantity = Number(item.quantityDelta ?? 0)
                    const insufficient = warehouseBefore < quantity
                    return (
                      <tr key={item.id ?? item.skuId ?? item.skuCode}>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-bold text-[#356647]">{item.skuCode || '—'}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{item.skuSnapshotName || '—'}</p>
                          {insufficient ? <p className="mt-1 text-xs font-semibold text-rose-600">Kho tổng không đủ tồn.</p> : null}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatStockQuantity(quantity)}</td>
                        <td className={`px-4 py-3 text-right ${insufficient ? 'font-semibold text-rose-700' : 'text-slate-600'}`}>
                          {isLoading ? 'Đang tải...' : `${formatStockQuantity(warehouseBefore)} -> ${formatStockQuantity(Math.max(0, warehouseBefore - quantity))}`}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {isLoading ? 'Đang tải...' : `${formatStockQuantity(counterBefore)} -> ${formatStockQuantity(counterBefore + quantity)}`}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                      Chưa có dòng SKU để duyệt.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Đóng
          </button>
          <button
            type="button"
            disabled={isSaving || isLoading || items.length === 0 || !request.id}
            onClick={() => onConfirm?.(request.id)}
            className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
          >
            {isSaving ? 'Đang duyệt...' : 'Xác nhận duyệt'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StockAdjustmentRequestsPage() {
  const location = useLocation()
  const session = loadAuthSession()
  const canReview = canReviewStockReplenishmentRequest(session)
  const canCreateRequest = canCreateStockReplenishmentRequest(session)
  const canCancelRequest = canCancelStockReplenishmentRequest(session)
  const canCancelAnyRequest = isSystemAdmin(session)
  const currentUserId = session?.userId ? String(session.userId) : ''
  const [activeTab, setActiveTab] = useState(canReview ? 'pending' : 'mine')
  const [searchValue, setSearchValue] = useState(() => location.state?.search ?? '')
  const [requests, setRequests] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [actingId, setActingId] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [approveTarget, setApproveTarget] = useState(null)
  const [simulateWarehouse, setSimulateWarehouse] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const tab = REQUEST_TABS.find((t) => t.key === activeTab) ?? REQUEST_TABS[0]
      const data = await fetchStockAdjustmentRequests({
        status: tab.status,
        mine: tab.mine,
        search: searchValue.trim() || undefined,
        page,
        pageSize,
      })
      const filtered = tab.excludePending ? data.items.filter((row) => row.status !== 'pending') : data.items
      setRequests(filtered)
      setTotalCount(data.totalCount)
      setSelectedId((prev) => {
        if (prev && filtered.some((row) => row.id === prev)) return prev
        return filtered[0]?.id ?? null
      })
    } catch (error) {
      setRequests([])
      setTotalCount(0)
      setSelectedId(null)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, searchValue, page, pageSize])

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
    setActiveTab(canReview ? 'pending' : 'mine')
    setPage(1)
  }, [canReview, location.key, location.state])

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null)
      return undefined
    }

    const cached = requests.find((row) => row.id === selectedId)
    if (cached) setSelectedDetail(cached)

    let mounted = true
    async function loadDetail() {
      setIsLoadingDetail(true)
      try {
        const detail = await fetchStockAdjustmentRequestById(selectedId)
        if (mounted) setSelectedDetail(detail)
      } catch (error) {
        if (mounted && cached) setSelectedDetail(cached)
        else if (mounted) {
          setSelectedDetail(null)
          showError(error.message)
        }
      } finally {
        if (mounted) setIsLoadingDetail(false)
      }
    }

    loadDetail()
    return () => {
      mounted = false
    }
  }, [selectedId, requests])

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'pending').length
    const approved = requests.filter((r) => r.status === 'approved').length
    return [
      { label: 'Chờ duyệt', value: String(pending), note: 'Trong danh sách hiện tại' },
      { label: 'Đã duyệt', value: String(approved), note: 'Trong danh sách hiện tại' },
      { label: 'Tổng hiển thị', value: String(requests.length), note: 'Theo bộ lọc' },
    ]
  }, [requests])

  async function handleApprove(id) {
    if (!id) {
      showError('Không xác định được yêu cầu cần duyệt.')
      return
    }

    setActingId(id)
    try {
      const result = await approveStockAdjustmentRequest(id)
      const slips = result?.exportSlips ?? []
      if (slips.length === 1) {
        showSuccess(`Đã duyệt yêu cầu bổ sung tồn quầy. Đã tạo phiếu xuất kho ${slips[0].exportSlipCode}.`)
      } else if (slips.length > 1) {
        showSuccess(`Đã duyệt yêu cầu bổ sung tồn quầy. Đã tạo ${slips.length} phiếu xuất kho.`)
      } else {
        showSuccess('Đã duyệt yêu cầu và cập nhật Tồn quầy POS mặc định.')
      }
      setApproveTarget(null)
      notifyInventoryStockChanged()

      if (activeTab === 'pending') {
        setActiveTab('processed')
        setPage(1)
        setSelectedId(id)
      } else {
        await loadData()
        setSelectedId(id)
      }

      try {
        const detail = await fetchStockAdjustmentRequestById(id)
        setSelectedDetail(detail)
      } catch (detailError) {
        showError(detailError.message)
        setSelectedDetail(null)
      }
    } catch (error) {
      showError(error.message)
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
      setRejectTarget(null)
      setRejectReason('')
      await loadData()
    } catch (error) {
      showError(error.message)
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
    } catch (error) {
      showError(error.message)
    } finally {
      setActingId(null)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Yêu cầu bổ sung tồn quầy"
        description={
          canReview
            ? 'Thủ kho Kho tổng hoặc Admin duyệt yêu cầu điều chuyển từ Kho tổng sang Tồn quầy POS mặc định.'
            : 'Manager gửi yêu cầu bổ sung tồn quầy POS mặc định từ Kho tổng.'
        }
        searchPlaceholder="Tìm mã yêu cầu, SKU..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
        rightContent={<InventoryNavTabs />}
      />

      <InventorySimulationBanner simulateWarehouse={simulateWarehouse} warehouseView={canReview} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {TABS.map((tab) => (
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
            onClick={() => setShowCreateModal(true)}
            className="ml-auto rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Yêu cầu tồn
          </button>
        ) : <span className="ml-auto" />}
        <Link
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          to="/inventory/products"
        >
          Sản phẩm &amp; số lượng
        </Link>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-400">{stat.note}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm lg:col-span-5">
          <div className="border-b border-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-800">
              {REQUEST_TABS.find((t) => t.key === activeTab)?.label}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Bấm thẻ để xem chi tiết lô</p>
          </div>

          <div className="min-h-[280px] flex-1 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <p className="px-6 py-8 text-sm text-slate-500">Đang tải...</p>
            ) : requests.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500">Không có yêu cầu trong mục này.</p>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-1">
                {requests.map((row) => {
                  const preview = row.items[0]
                  const isSelected = selectedId === row.id
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                        isSelected
                          ? 'border-[#356647]/40 bg-[#f0f7f2] shadow-sm ring-1 ring-[#356647]/20'
                          : 'border-slate-100 bg-white hover:border-[#356647]/20 hover:bg-[#fbf9f1]/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-sm font-bold text-[#356647]">{row.requestCode}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getAdjustmentStatusClass(row.status)}`}
                        >
                          {getAdjustmentStatusLabel(row.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-800">
                        {row.itemCount} SKU
                        {getRequestMovementLabel(row)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Kho tổng {'->'} Tồn quầy POS mặc định</p>
                      {preview ? (
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {preview.skuCode}
                          {row.itemCount > 1 ? ` +${row.itemCount - 1} SKU` : ''}
                          {' · '}
                          {formatDelta(preview.quantityDelta)}
                        </p>
                      ) : null}
                      {row.reason ? (
                        <p className="mt-2 line-clamp-2 text-xs text-slate-600">Lý do: {row.reason}</p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-slate-400">
                        {formatVietnamDateTime(row.requestedAt)}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-50 px-4 py-3">
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              itemLabel="yêu cầu"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 lg:col-span-7">
          <h2 className="mb-6 text-lg font-bold text-slate-800">Chi tiết yêu cầu</h2>
          {isLoadingDetail && selectedId ? (
            <p className="text-sm text-slate-500">Đang tải chi tiết...</p>
          ) : (
            <StockAdjustmentRequestDetailPanel
              request={selectedDetail}
              canReview={canReview}
              canCancel={canCancelRequest}
              canCancelAny={canCancelAnyRequest}
              currentUserId={currentUserId}
              activeTab={activeTab}
              actingId={actingId}
              onApprove={setApproveTarget}
              onReject={setRejectTarget}
              onCancel={setCancelTarget}
            />
          )}
        </section>
      </div>

      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Từ chối yêu cầu {rejectTarget.requestCode}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {rejectTarget.itemCount} SKU trong lô
              {rejectTarget.hasIncrease && rejectTarget.hasDecrease
                ? ' (có bổ sung tồn quầy và giảm tồn)'
                : rejectTarget.hasIncrease
                  ? ' (bổ sung tồn quầy)'
                  : rejectTarget.hasDecrease
                    ? ' (giảm tồn)'
                    : ''}
            </p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Hủy yêu cầu {cancelTarget.requestCode}</h3>
            <p className="mt-2 text-sm text-slate-600">Hủy yêu cầu đang chờ duyệt, không thay đổi tồn kho.</p>
            <label className="mt-4 block space-y-2">
              <span className="text-xs font-semibold text-slate-500">Lý do hủy *</span>
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

      {approveTarget ? (
        <ApproveStockRequestModal
          request={approveTarget}
          isSaving={actingId === approveTarget?.id}
          onClose={() => setApproveTarget(null)}
          onConfirm={handleApprove}
        />
      ) : null}

      {showCreateModal ? (
        <CreateStockRequestModal
          onClose={() => setShowCreateModal(false)}
          onSubmitted={(created) => {
            setActiveTab('mine')
            setSearchValue(created?.requestCode ?? '')
            setPage(1)
            setSelectedId(created?.id ?? null)
          }}
        />
      ) : null}
    </PageShell>
  )
}

export default StockAdjustmentRequestsPage
