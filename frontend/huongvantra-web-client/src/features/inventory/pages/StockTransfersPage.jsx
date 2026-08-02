import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { promptDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canOperateStockTransfer, canViewStockTransfer } from '../../auth/utils/permissions.js'
import { getReasonSuggestions } from '../../shared/reasonSuggestions.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import { fetchSkuStocks } from '../services/inventoryStockApi.js'
import { fetchStockAdjustmentRequestById } from '../services/stockAdjustmentRequestApi.js'
import {
  getStockFlowErrorMessage,
  getStockFlowStatusClass,
  getStockTransferStatusLabel,
  STOCK_FLOW_TERMS,
} from '../utils/stockFlowLabels.js'
import {
  cancelStockTransfer,
  completeStockTransfer,
  createStockTransfer,
  fetchStockTransferById,
  fetchStockTransfers,
  updateStockTransfer,
} from '../services/stockTransferApi.js'

const EMPTY_LINE = () => ({
  key: crypto.randomUUID(),
  skuId: '',
  quantity: 1,
})

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'Draft', label: 'Nháp' },
  { value: 'Completed', label: 'Đã hoàn tất' },
  { value: 'Cancelled', label: 'Đã hủy' },
]

const TRANSFER_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả loại phiếu' },
  { value: 'fromRequest', label: 'Từ yêu cầu' },
  { value: 'direct', label: 'Trực tiếp' },
]

const SORT_OPTIONS = [
  { value: '', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'code_asc', label: 'Mã phiếu tăng dần' },
  { value: 'code_desc', label: 'Mã phiếu giảm dần' },
  { value: 'status', label: 'Theo trạng thái' },
]

function normalizeProductType(value) {
  return String(value ?? '').trim().toUpperCase()
}

/**
 * Modal chỉ dùng để sửa Phiếu Nháp. Luồng tạo mới đã tách sang trang riêng
 * /inventory/stock-transfers/create.
 */
function TransferFormModal({
  transfer,
  sourceRequest,
  catalog,
  stockBySkuId,
  onClose,
  onSaved,
}) {
  const isRequestMode = Boolean(transfer?.sourceRequestId)

  const [note, setNote] = useState(transfer?.note ?? '')
  const [lines, setLines] = useState(() => {
    if (transfer?.lines?.length) {
      return transfer.lines.map((line) => ({
        key: line.id || crypto.randomUUID(),
        skuId: line.skuId,
        skuCode: line.skuCode,
        skuName: line.skuNameSnapshot,
        sourceRequestLineId: line.sourceRequestLineId ?? null,
        quantity: line.quantity,
      }))
    }
    return [EMPTY_LINE()]
  })
  const [isSaving, setIsSaving] = useState(false)

  // Số lượng tối đa khi sửa Nháp gắn yêu cầu:
  // AvailableFromOtherTransfers + CurrentLineQuantity.
  const maxByRequestLineId = useMemo(() => {
    const map = new Map()
    for (const item of sourceRequest?.items ?? []) {
      map.set(item.id, Number(item.availableToTransferQuantity ?? 0))
    }
    return map
  }, [sourceRequest])

  function editableMax(line) {
    if (!isRequestMode || !line.sourceRequestLineId) return undefined
    const original = transfer?.lines?.find((row) => row.sourceRequestLineId === line.sourceRequestLineId)
    const available = maxByRequestLineId.get(line.sourceRequestLineId) ?? 0
    return available + Number(original?.quantity ?? 0)
  }

  // §11: chỉ được thêm dòng thuộc đúng yêu cầu nguồn, đã duyệt và còn số lượng khả dụng.
  const addableRequestLines = useMemo(() => {
    if (!isRequestMode) return []
    const used = new Set(lines.map((line) => line.sourceRequestLineId).filter(Boolean))
    return (sourceRequest?.items ?? []).filter(
      (item) => !used.has(item.id) && Number(item.availableToTransferQuantity ?? 0) > 0,
    )
  }, [isRequestMode, lines, sourceRequest])

  function updateLine(key, field, value) {
    setLines((current) => current.map((line) => (
      line.key === key ? { ...line, [field]: value } : line
    )))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const selected = lines.filter((line) => line.skuId && Number(line.quantity) > 0)
    if (selected.length === 0) {
      showError(`${STOCK_FLOW_TERMS.transfer} phải có ít nhất một SKU với số lượng lớn hơn 0.`)
      return
    }
    if (new Set(selected.map((line) => line.skuId)).size !== selected.length) {
      showError(`Mỗi SKU chỉ được chọn một lần trong ${STOCK_FLOW_TERMS.transfer}.`)
      return
    }

    const payloadLines = []
    for (const line of selected) {
      const quantity = Number(line.quantity)
      const sku = catalog.find((item) => item.id === line.skuId)
      const skuCode = line.skuCode || sku?.skuCode || ''
      const warehouseQuantity = Number(stockBySkuId.get(line.skuId)?.warehouseQuantityOnHand ?? 0)
      if (!Number.isInteger(quantity) || quantity <= 0) {
        showError(`${STOCK_FLOW_TERMS.transferQuantity} của SKU ${skuCode} phải là số nguyên dương.`)
        return
      }
      const limit = editableMax(line)
      if (limit != null && quantity > limit) {
        showError(
          `${skuCode}: ${STOCK_FLOW_TERMS.transferQuantity} ${quantity} vượt số lượng còn có thể `
          + `điều chuyển (${limit}).`,
        )
        return
      }
      if (quantity > warehouseQuantity) {
        showError(
          `SKU ${skuCode}: cần ${quantity}, ${STOCK_FLOW_TERMS.warehouse} chỉ còn `
          + `${formatStockQuantity(warehouseQuantity)}.`,
        )
        return
      }
      payloadLines.push({
        skuId: line.skuId,
        skuCode,
        quantity,
        sourceRequestLineId: line.sourceRequestLineId ?? null,
      })
    }

    setIsSaving(true)
    try {
      const payload = {
        note,
        lines: payloadLines,
        sourceRequestId: transfer?.sourceRequestId ?? null,
      }
      if (transfer?.id) {
        await updateStockTransfer(transfer.id, payload)
        showSuccess(`Đã cập nhật ${STOCK_FLOW_TERMS.transfer}.`)
      } else {
        await createStockTransfer(payload)
        showSuccess(`Đã tạo ${STOCK_FLOW_TERMS.transfer} ở trạng thái Nháp. Tồn kho chỉ đổi khi hoàn tất.`)
      }
      await onSaved()
      onClose()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {transfer ? `Sửa ${transfer.transferCode}` : `Tạo ${STOCK_FLOW_TERMS.transfer}`}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isRequestMode
                  ? `Phiếu tạo từ ${STOCK_FLOW_TERMS.request} ${transfer?.sourceRequestCode || ''}. `
                    + 'Chỉ được sửa số lượng, xóa dòng hoặc thêm sản phẩm thuộc chính yêu cầu này.'
                  : 'Phiếu trực tiếp: chọn sản phẩm và số lượng trong giới hạn tồn Kho khả dụng.'}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="space-y-3">
              {lines.map((line, index) => {
                const stock = stockBySkuId.get(line.skuId)
                const warehouseQuantity = Number(stock?.warehouseQuantityOnHand ?? 0)
                const shelfQuantity = Number(stock?.quantityOnHand ?? 0)
                const lineMax = editableMax(line)
                const isLockedSku = isRequestMode && Boolean(line.sourceRequestLineId)
                return (
                  <div key={line.key} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_180px_44px]">
                    {isLockedSku ? (
                      <div className="space-y-1 text-sm">
                        <p className="font-mono font-bold text-[#356647]">{line.skuCode}</p>
                        <p className="text-xs text-slate-500">{line.skuName || '—'}</p>
                        <p className="text-xs text-slate-500">
                          Tồn {STOCK_FLOW_TERMS.warehouse}: {formatStockQuantity(warehouseQuantity)}
                          {' · '}
                          Tồn {STOCK_FLOW_TERMS.shelf}: {formatStockQuantity(shelfQuantity)}
                          {lineMax != null ? ` · Tối đa: ${formatStockQuantity(lineMax)}` : ''}
                        </p>
                      </div>
                    ) : (
                      <label className="space-y-1 text-sm font-semibold text-slate-700">
                        Sản phẩm
                        <select
                          value={line.skuId}
                          onChange={(event) => updateLine(line.key, 'skuId', event.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
                        >
                          <option value="">Chọn sản phẩm</option>
                          {catalog.map((sku) => (
                            <option key={sku.id} value={sku.id}>
                              {sku.skuCode} — {sku.variantName || sku.productName || 'Thành phẩm'}
                            </option>
                          ))}
                        </select>
                        {line.skuId ? (
                          <span className="block text-xs font-normal text-slate-500">
                            Tồn {STOCK_FLOW_TERMS.warehouse}: {formatStockQuantity(warehouseQuantity)}
                            {' · '}
                            Tồn {STOCK_FLOW_TERMS.shelf}: {formatStockQuantity(shelfQuantity)}
                          </span>
                        ) : null}
                      </label>
                    )}
                    <label className="space-y-1 text-sm font-semibold text-slate-700">
                      {STOCK_FLOW_TERMS.transferQuantity}
                      <input
                        type="number"
                        min="0"
                        step="1"
                        max={lineMax}
                        value={line.quantity}
                        onChange={(event) => updateLine(line.key, 'quantity', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Xóa dòng ${index + 1}`}
                      disabled={lines.length === 1}
                      onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                      className="mt-6 inline-flex h-11 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                )
              })}
              {isRequestMode ? (
                addableRequestLines.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {addableRequestLines.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLines((current) => [...current, {
                          key: item.id,
                          skuId: item.skuId,
                          skuCode: item.skuCode,
                          skuName: item.skuSnapshotName,
                          sourceRequestLineId: item.id,
                          quantity: Number(item.availableToTransferQuantity ?? 0),
                        }])}
                        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#538463] px-4 py-2.5 text-sm font-bold text-[#356647]"
                      >
                        <span className="material-symbols-outlined text-[19px]">add</span>
                        {item.skuCode}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Không còn sản phẩm nào của {STOCK_FLOW_TERMS.request} này có thể thêm vào phiếu.
                  </p>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => setLines((current) => [...current, EMPTY_LINE()])}
                  className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#538463] px-4 py-2.5 text-sm font-bold text-[#356647]"
                >
                  <span className="material-symbols-outlined text-[19px]">add</span>
                  Thêm sản phẩm
                </button>
              )}
            </div>

            <label className="block space-y-1 text-sm font-semibold text-slate-700">
              Ghi chú
              <textarea
                rows="3"
                maxLength="500"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 font-semibold text-slate-700">
              Đóng
            </button>
            <button disabled={isSaving} className="rounded-xl bg-[#356647] px-5 py-2.5 font-bold text-white disabled:opacity-50">
              {isSaving ? 'Đang lưu...' : 'Lưu Nháp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TransferDetailModal({ transfer, canOperate, isCompleting, onClose, onEdit, onComplete, onCancel }) {
  if (!transfer) return null
  const isDraft = transfer.status === 'draft'
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-mono text-xl font-bold text-slate-900">{transfer.transferCode}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStockFlowStatusClass(transfer.status)}`}>
                {getStockTransferStatusLabel(transfer.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {STOCK_FLOW_TERMS.warehouse} → {STOCK_FLOW_TERMS.shelf}
              {transfer.sourceRequestCode ? ` · ${STOCK_FLOW_TERMS.request}: ${transfer.sourceRequestCode}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <dl className="grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-3">
            <div><dt className="text-slate-500">Người tạo</dt><dd className="font-semibold">{transfer.createdByName || '—'}</dd></div>
            <div><dt className="text-slate-500">Thời gian tạo</dt><dd className="font-semibold">{formatVietnamDateTime(transfer.createdAt)}</dd></div>
            <div><dt className="text-slate-500">Tổng số lượng</dt><dd className="font-semibold">{formatStockQuantity(transfer.totalQuantity)}</dd></div>
            <div><dt className="text-slate-500">Phiếu xuất</dt><dd className="font-mono font-semibold">{transfer.exportSlipCode || '—'}</dd></div>
            <div><dt className="text-slate-500">Phiếu nhập</dt><dd className="font-mono font-semibold">{transfer.importSlipCode || '—'}</dd></div>
            <div><dt className="text-slate-500">Hoàn tất lúc</dt><dd className="font-semibold">{formatVietnamDateTime(transfer.completedAt)}</dd></div>
          </dl>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">{STOCK_FLOW_TERMS.transferQuantity}</th>
                  <th className="px-4 py-3 text-right">Phân bổ lô</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfer.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-[#356647]">{line.skuCode}</p>
                      <p className="text-xs text-slate-500">{line.skuNameSnapshot}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatStockQuantity(line.quantity)}</td>
                    <td className="px-4 py-3 text-right">{line.batchAllocations.length || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {transfer.note ? <p className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">{transfer.note}</p> : null}
          {transfer.cancellationReason ? (
            <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
              <span className="font-semibold">Lý do hủy:</span> {transfer.cancellationReason}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-6 py-4">
          {canOperate && isDraft ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                disabled={isCompleting}
                className="rounded-xl border border-rose-200 px-4 py-2.5 font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hủy phiếu
              </button>
              <button
                type="button"
                onClick={onEdit}
                disabled={isCompleting}
                className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sửa Nháp
              </button>
              <button
                type="button"
                onClick={onComplete}
                disabled={isCompleting}
                className="rounded-xl bg-[#356647] px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCompleting ? 'Đang hoàn tất...' : 'Hoàn tất điều chuyển'}
              </button>
            </>
          ) : null}
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

function StockTransfersPage() {
  const session = loadAuthSession()
  const canOperate = canOperateStockTransfer(session)
  const canView = canViewStockTransfer(session)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const sourceRequestId = searchParams.get('sourceRequestId') || ''
  const [filterRequestCode, setFilterRequestCode] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [transferType, setTransferType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sort, setSort] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [data, setData] = useState({ items: [], totalCount: 0 })
  const [catalog, setCatalog] = useState([])
  const [stocks, setStocks] = useState([])
  const [selected, setSelected] = useState(null)
  const [formTransfer, setFormTransfer] = useState(null)
  const [formSourceRequest, setFormSourceRequest] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  const stockBySkuId = useMemo(
    () => new Map(stocks.map((stock) => [stock.skuId, stock])),
    [stocks],
  )

  const loadTransfers = useCallback(async () => {
    if (!canView) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setLoadError(null)
    try {
      const result = await fetchStockTransfers({
        status,
        search,
        page,
        pageSize,
        sourceRequestId: sourceRequestId || undefined,
        transferType: transferType || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        sort: sort || undefined,
      })
      setData(result)
    } catch (error) {
      setData({ items: [], totalCount: 0 })
      setLoadError('Không thể tải danh sách phiếu điều chuyển. Vui lòng thử lại.')
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [canView, fromDate, page, pageSize, search, sort, sourceRequestId, status, toDate, transferType])

  useEffect(() => {
    const timer = window.setTimeout(loadTransfers, 250)
    return () => window.clearTimeout(timer)
  }, [loadTransfers])

  function resetFilters() {
    setSearch('')
    setStatus('')
    setTransferType('')
    setFromDate('')
    setToDate('')
    setSort('')
    setPage(1)
  }

  const loadCatalog = useCallback(async () => {
    if (!canOperate || catalog.length > 0 || isCatalogLoading) return
    setIsCatalogLoading(true)
    try {
      const [skus, stockRows] = await Promise.all([fetchAllActiveSkus(), fetchSkuStocks()])
      setCatalog(
        skus.filter((sku) => (
          sku.isActive
          && normalizeProductType(sku.productType) === 'THANH_PHAM'
          && sku.isSellable
        )),
      )
      setStocks(stockRows)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsCatalogLoading(false)
    }
  }, [canOperate, catalog.length, isCatalogLoading])

  useEffect(() => {
    let mounted = true
    if (!sourceRequestId) {
      setFilterRequestCode('')
      return undefined
    }
    fetchStockAdjustmentRequestById(sourceRequestId)
      .then((req) => { if (mounted) setFilterRequestCode(req.requestCode || sourceRequestId) })
      .catch(() => { if (mounted) setFilterRequestCode(sourceRequestId) })
    return () => { mounted = false }
  }, [sourceRequestId])

  function clearSourceRequestFilter() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('sourceRequestId')
      return next
    }, { replace: true })
    setPage(1)
  }

  async function openDetail(id) {
    try {
      setSelected(await fetchStockTransferById(id))
    } catch (error) {
      showError(error.message)
    }
  }

  /** Chỉ dùng để sửa Phiếu Nháp; tạo mới đi qua trang /inventory/stock-transfers/create. */
  async function openEditForm(transfer) {
    await loadCatalog()
    setFormTransfer(transfer)
    setFormSourceRequest(
      transfer?.sourceRequestId
        ? await fetchStockAdjustmentRequestById(transfer.sourceRequestId).catch(() => null)
        : null,
    )
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setFormTransfer(null)
    setFormSourceRequest(null)
  }

  async function reloadSelected(id) {
    await loadTransfers()
    if (id) setSelected(await fetchStockTransferById(id))
  }

  async function handleComplete() {
    // Chặn double-click: lần bấm thứ hai bị bỏ qua ngay tại đây, ngoài ra nút cũng bị disable.
    if (isCompleting || !selected) return
    const transferId = selected.id
    if (!window.confirm(`Hoàn tất ${selected.transferCode}? Tồn Kho sẽ giảm và tồn Kệ sẽ tăng ngay.`)) return
    setIsCompleting(true)
    try {
      const completed = await completeStockTransfer(transferId)
      setSelected(completed)
      showSuccess('Đã hoàn tất điều chuyển Kho → Kệ.')
      await loadTransfers()
    } catch (error) {
      showError(getStockFlowErrorMessage(error, 'Không hoàn tất được Phiếu điều chuyển. Vui lòng thử lại.'))
      // Lỗi có thể xảy ra trước hoặc sau khi backend đổi trạng thái, nên đọc lại phiếu
      // để modal phản ánh đúng trạng thái thực tế thay vì giữ dữ liệu cũ.
      try {
        setSelected(await fetchStockTransferById(transferId))
        await loadTransfers()
      } catch (reloadError) {
        showError(getStockFlowErrorMessage(reloadError, 'Không tải lại được Phiếu điều chuyển. Vui lòng tải lại trang.'))
      }
    } finally {
      setIsCompleting(false)
    }
  }

  async function handleCancel() {
    if (isCompleting || !selected) return
    const reason = await promptDialog({
      title: 'Hủy phiếu điều chuyển',
      message: `Nhập lý do hủy ${selected.transferCode}:`,
      required: true,
      tone: 'danger',
      suggestions: getReasonSuggestions('stockTransferCancel'),
    })
    if (reason == null) return
    try {
      const cancelled = await cancelStockTransfer(selected.id, reason)
      showSuccess('Đã hủy Phiếu điều chuyển.')
      setSelected(cancelled)
      await loadTransfers()
    } catch (error) {
      showError(getStockFlowErrorMessage(error, 'Không hủy được Phiếu điều chuyển. Vui lòng thử lại.'))
    }
  }

  if (!canView) {
    return (
      <PageShell>
        <InventoryNavTabs />
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Bạn không có quyền xem {STOCK_FLOW_TERMS.transfer}.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <InventoryNavTabs />
      <PageHeader
        title={STOCK_FLOW_TERMS.transfer}
        description="Thủ kho tạo, sửa và hoàn tất trực tiếp. Quản lý và Admin chỉ xem, giám sát."
        titleInfo={`Hoàn tất sẽ trừ ${STOCK_FLOW_TERMS.warehouse} theo FEFO, cộng ${STOCK_FLOW_TERMS.shelf} và tạo đầy đủ lineage, Phiếu xuất, Phiếu nhập, Inventory Ledger trong cùng transaction.`}
        searchPlaceholder="Tìm mã phiếu, mã yêu cầu nguồn, sản phẩm hoặc người tạo..."
        searchValue={search}
        onSearchChange={(value) => { setSearch(value); setPage(1) }}
        rightContent={canOperate ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/inventory/stock-transfers/create')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#538463] px-4 py-2.5 font-bold text-[#356647]"
            >
              <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
              Tạo từ yêu cầu
            </button>
            <button
              type="button"
              onClick={() => navigate('/inventory/stock-transfers/create?mode=direct')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#356647] px-4 py-2.5 font-bold text-white"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Tạo phiếu trực tiếp
            </button>
          </div>
        ) : null}
      />

      <div className="my-4 flex flex-wrap items-center gap-3">
        {sourceRequestId ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            <span className="material-symbols-outlined text-[18px]">filter_alt</span>
            <span>Đang lọc theo yêu cầu <span className="font-mono font-semibold">{filterRequestCode || sourceRequestId}</span></span>
            <button
              type="button"
              onClick={clearSourceRequestFilter}
              className="ml-2 rounded-lg px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              Bỏ lọc
            </button>
          </div>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1) }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
          >
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select
            value={transferType}
            onChange={(event) => { setTransferType(event.target.value); setPage(1) }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
          >
            {TRANSFER_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Từ ngày
            <input
              type="date"
              value={fromDate}
              onChange={(event) => { setFromDate(event.target.value); setPage(1) }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Đến ngày
            <input
              type="date"
              value={toDate}
              onChange={(event) => { setToDate(event.target.value); setPage(1) }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <select
            value={sort}
            onChange={(event) => { setSort(event.target.value); setPage(1) }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
          >
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Xóa bộ lọc
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Mã phiếu</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Loại phiếu</th>
                <th className="px-4 py-3">Yêu cầu nguồn</th>
                <th className="px-4 py-3">Người tạo</th>
                <th className="px-4 py-3">Thời gian tạo</th>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3">Hoàn tất lúc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-slate-500">Đang tải...</td></tr>
              ) : loadError ? (
                <tr><td colSpan={8} className="px-6 py-8 text-rose-600">{loadError}</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-slate-500">
                  {sourceRequestId
                    ? 'Chưa có phiếu điều chuyển nào từ yêu cầu này.'
                    : 'Chưa có phiếu điều chuyển phù hợp.'}
                </td></tr>
              ) : data.items.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => openDetail(transfer.id)}
                      className="font-mono font-semibold text-[#356647] hover:underline"
                    >
                      {transfer.transferCode}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStockFlowStatusClass(transfer.status)}`}>
                      {getStockTransferStatusLabel(transfer.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {transfer.sourceRequestId ? 'Từ yêu cầu' : 'Trực tiếp'}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-600">{transfer.sourceRequestCode || '—'}</td>
                  <td className="px-4 py-4">{transfer.createdByName || '—'}</td>
                  <td className="px-4 py-4 text-slate-600">{formatVietnamDateTime(transfer.createdAt)}</td>
                  <td className="px-4 py-4 text-slate-600">{transfer.itemCount} sản phẩm</td>
                  <td className="px-4 py-4 text-slate-600">
                    {transfer.completedAt ? formatVietnamDateTime(transfer.completedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={data.totalCount}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          disabled={isLoading}
          itemLabel="phiếu điều chuyển"
        />
      </section>

      <TransferDetailModal
        transfer={selected}
        canOperate={canOperate}
        isCompleting={isCompleting}
        onClose={() => { if (!isCompleting) setSelected(null) }}
        onEdit={() => openEditForm(selected)}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />

      {showForm ? (
        <TransferFormModal
          transfer={formTransfer}
          sourceRequest={formSourceRequest}
          catalog={catalog}
          stockBySkuId={stockBySkuId}
          onClose={closeForm}
          onSaved={() => reloadSelected(formTransfer?.id)}
        />
      ) : null}
    </PageShell>
  )
}

export default StockTransfersPage
