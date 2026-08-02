import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canOperateStockTransfer } from '../../auth/utils/permissions.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { fetchSkuStocks } from '../services/inventoryStockApi.js'
import {
  fetchStockAdjustmentRequestById,
  fetchStockAdjustmentRequests,
} from '../services/stockAdjustmentRequestApi.js'
import { createStockTransfer } from '../services/stockTransferApi.js'
import { fetchShelfReplenishmentSuggestionById } from '../services/shelfReplenishmentSuggestionApi.js'
import { getStockFlowErrorMessage, STOCK_FLOW_TERMS } from '../utils/stockFlowLabels.js'

const LABEL_CLASS = 'mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500'
const FIELD_CLASS =
  'min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#538463]'

/**
 * Điều kiện SKU được điều chuyển lên Kệ, bám đúng StockTransferLogic ở backend:
 * chỉ Thành phẩm đang hoạt động và được phép bán. Nguyên liệu và Bao bì luôn bị loại.
 */
function isShelfEligibleSku(sku) {
  return (
    Boolean(sku?.isActive)
    && Boolean(sku?.isSellable)
    && String(sku?.productType ?? '').trim().toUpperCase() === 'THANH_PHAM'
  )
}

function DirectModeSection({ catalog, stockBySkuId, lines, onAdd, onRemove, onQuantityChange, search, onSearchChange }) {
  const selectedIds = useMemo(() => new Set(lines.map((line) => line.skuId)), [lines])
  const normalizedSearch = search.trim().toLowerCase()
  const filteredCatalog = useMemo(() => {
    if (!normalizedSearch) return catalog.slice(0, 50)
    return catalog
      .filter((sku) => (
        String(sku.skuCode ?? '').toLowerCase().includes(normalizedSearch)
        || String(sku.productName ?? '').toLowerCase().includes(normalizedSearch)
        || String(sku.variantName ?? '').toLowerCase().includes(normalizedSearch)
      ))
      .slice(0, 50)
  }, [catalog, normalizedSearch])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm lg:col-span-5">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800">Danh mục sản phẩm</h2>
          <p className="mt-1 text-xs text-slate-500">
            Chỉ SKU Thành phẩm đang hoạt động và được phép tồn trên {STOCK_FLOW_TERMS.shelf}.
            Nguyên liệu và Bao bì không hiển thị ở đây — nhãn &ldquo;Danh mục&rdquo; bên dưới là danh mục
            phân loại của cửa hàng, không phải loại sản phẩm.
          </p>
        </div>
        <div className="px-5 py-4">
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm mã SKU hoặc tên sản phẩm"
            className={FIELD_CLASS}
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto custom-scrollbar border-t border-slate-100">
          {filteredCatalog.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">Không tìm thấy sản phẩm thành phẩm phù hợp.</p>
          ) : (
            filteredCatalog.map((sku) => {
              const stock = stockBySkuId.get(sku.id)
              const warehouseQuantity = Number(stock?.warehouseQuantityOnHand ?? 0)
              const selected = selectedIds.has(sku.id)
              return (
                <button
                  key={sku.id}
                  type="button"
                  disabled={selected}
                  onClick={() => onAdd(sku, warehouseQuantity)}
                  className={`flex w-full items-start justify-between gap-3 border-b border-slate-50 px-5 py-3 text-left text-sm hover:bg-[#fbf9f1] disabled:cursor-not-allowed ${
                    selected ? 'bg-[#e8f1eb] text-[#356647]' : 'text-slate-800'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-xs font-bold">{sku.skuCode}</span>
                    <span className="mt-0.5 block truncate font-semibold">
                      {sku.variantName || sku.productName || 'Thành phẩm'}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded-full bg-[#e8f1eb] px-2 py-0.5 font-semibold text-[#356647]">
                        Thành phẩm
                      </span>
                      {sku.categoryName ? (
                        <span className="truncate text-slate-500">Danh mục: {sku.categoryName}</span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-slate-600">
                    Tồn {STOCK_FLOW_TERMS.warehouse}: <strong>{formatStockQuantity(warehouseQuantity)}</strong>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm lg:col-span-7">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800">Sản phẩm</h2>
          <p className="mt-1 text-xs text-slate-500">
            Số lượng điều chuyển là số nguyên dương và không được vượt tồn {STOCK_FLOW_TERMS.warehouse} khả dụng.
          </p>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Mã SKU</th>
                <th className="whitespace-nowrap px-4 py-3">Tên sản phẩm</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Tồn {STOCK_FLOW_TERMS.warehouse}</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">{STOCK_FLOW_TERMS.transferQuantity}</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    Chưa chọn sản phẩm nào. Hãy chọn sản phẩm ở danh mục bên trái.
                  </td>
                </tr>
              ) : (
                lines.map((line) => {
                  const quantity = Number(line.quantity)
                  const isOverStock =
                    Number.isFinite(quantity) && quantity > 0 && quantity > line.warehouseQuantityOnHand
                  return (
                    <tr key={line.skuId} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-[#356647]">
                        {line.skuCode}
                      </td>
                      <td className="px-4 py-3 text-slate-800">{line.skuName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                        {formatStockQuantity(line.warehouseQuantityOnHand)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          max={line.warehouseQuantityOnHand || undefined}
                          value={line.quantity}
                          onChange={(event) => onQuantityChange(line.skuId, event.target.value)}
                          className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm outline-none focus:border-[#538463]"
                          placeholder="VD: 10"
                        />
                        {isOverStock ? (
                          <span className="mt-1 block text-[11px] font-semibold text-rose-600">
                            Vượt tồn {STOCK_FLOW_TERMS.warehouse} khả dụng.
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onRemove(line.skuId)}
                          title="Xóa sản phẩm khỏi phiếu"
                          className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function RequestModeSection({
  requests,
  isLoadingRequests,
  selectedRequest,
  onSelectRequest,
  lines,
  onQuantityChange,
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm lg:col-span-5">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800">{STOCK_FLOW_TERMS.request} đã duyệt</h2>
          <p className="mt-1 text-xs text-slate-500">
            Chỉ hiển thị các yêu cầu đã được duyệt và còn số lượng chưa nằm trong phiếu Nháp khác.
          </p>
        </div>
        <div className="max-h-[520px] overflow-y-auto custom-scrollbar">
          {isLoadingRequests ? (
            <p className="px-5 py-8 text-sm text-slate-500">Đang tải danh sách yêu cầu...</p>
          ) : requests.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">
              Không có yêu cầu nào đã được duyệt và còn số lượng có thể điều chuyển.
            </p>
          ) : (
            requests.map((request) => {
              const selected = selectedRequest?.id === request.id
              return (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => onSelectRequest(request.id)}
                  className={`block w-full border-b border-slate-50 px-5 py-3 text-left text-sm hover:bg-[#fbf9f1] ${
                    selected ? 'bg-[#e8f1eb]' : ''
                  }`}
                >
                  <span className="block font-mono text-xs font-bold text-[#356647]">{request.requestCode}</span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    {request.requestedByName || 'Chưa xác định'} · {formatVietnamDateTime(request.requestedAt)}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {request.transferableItemCount} sản phẩm có thể điều chuyển
                  </span>
                </button>
              )
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm lg:col-span-7">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800">
            {selectedRequest ? `Sản phẩm của ${selectedRequest.requestCode}` : 'Sản phẩm của yêu cầu'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Không được thêm SKU ngoài yêu cầu và không được vượt số lượng có thể điều chuyển.
          </p>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Sản phẩm</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Đã duyệt</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Đã chuyển</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Đang giữ trong Nháp</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Có thể điều chuyển</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Số lượng lần này</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!selectedRequest ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    Hãy chọn một yêu cầu ở danh sách bên trái.
                  </td>
                </tr>
              ) : lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    Yêu cầu này không còn sản phẩm nào có thể điều chuyển.
                  </td>
                </tr>
              ) : (
                lines.map((line) => {
                  const quantity = Number(line.quantity)
                  const isOverAvailable =
                    Number.isFinite(quantity) && quantity > 0 && quantity > line.availableToTransferQuantity
                  return (
                    <tr key={line.sourceRequestLineId} className="align-top">
                      <td className="px-4 py-3 text-slate-800">
                        <span className="block font-mono text-xs font-bold text-[#356647]">{line.skuCode}</span>
                        <span className="mt-0.5 block font-semibold">{line.skuName}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                        {formatStockQuantity(line.approvedQuantity)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                        {formatStockQuantity(line.fulfilledQuantity)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                        {formatStockQuantity(line.draftReservedQuantity)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#356647]">
                        {formatStockQuantity(line.availableToTransferQuantity)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          max={line.availableToTransferQuantity}
                          value={line.quantity}
                          onChange={(event) => onQuantityChange(line.sourceRequestLineId, event.target.value)}
                          className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm outline-none focus:border-[#538463]"
                        />
                        {isOverAvailable ? (
                          <span className="mt-1 block text-[11px] font-semibold text-rose-600">
                            Vượt số lượng có thể điều chuyển.
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default function StockTransferCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const session = loadAuthSession()
  const canOperate = canOperateStockTransfer(session)

  const isDirectMode = searchParams.get('mode') === 'direct'
  const presetRequestId = searchParams.get('sourceRequestId') || ''
  const presetSuggestionId = searchParams.get('sourceSuggestionId') || ''

  const [catalog, setCatalog] = useState([])
  const [stocks, setStocks] = useState([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [directLines, setDirectLines] = useState([])
  const [suggestion, setSuggestion] = useState(null)
  const hasPrefilledSuggestion = useRef(false)

  const [requests, setRequests] = useState([])
  const [isLoadingRequests, setIsLoadingRequests] = useState(!isDirectMode)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [requestLines, setRequestLines] = useState([])

  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const stockBySkuId = useMemo(() => new Map(stocks.map((stock) => [stock.skuId, stock])), [stocks])

  useEffect(() => {
    if (!canOperate || !isDirectMode) return undefined
    let mounted = true
    Promise.all([fetchAllActiveSkus(), fetchSkuStocks()])
      .then(([skus, stockRows]) => {
        if (!mounted) return
        setCatalog(skus.filter(isShelfEligibleSku))
        setStocks(stockRows)
      })
      .catch((error) => {
        if (!mounted) return
        setCatalog([])
        setStocks([])
        showError(getStockFlowErrorMessage(error, 'Không tải được danh mục sản phẩm.'))
      })
    return () => {
      mounted = false
    }
  }, [canOperate, isDirectMode])

  useEffect(() => {
    if (!canOperate || isDirectMode) return undefined
    let mounted = true
    setIsLoadingRequests(true)
    // Không lọc theo một trạng thái duy nhất: yêu cầu đã duyệt có thể đang ở Processing hoặc
    // PartiallyFulfilled mà vẫn còn dòng chưa điều chuyển. Điều kiện thật sự là
    // AvailableToTransferQuantity > 0 trên ít nhất một dòng.
    fetchStockAdjustmentRequests({ page: 1, pageSize: 100, sort: 'warehouse_priority' })
      .then((result) => {
        if (!mounted) return
        const eligible = result.items
          .map((request) => ({
            ...request,
            transferableItemCount: request.items.filter(
              (item) => Number(item.availableToTransferQuantity ?? 0) > 0,
            ).length,
          }))
          .filter((request) => request.transferableItemCount > 0)
        setRequests(eligible)
      })
      .catch((error) => {
        if (!mounted) return
        setRequests([])
        showError(getStockFlowErrorMessage(error, 'Không tải được danh sách yêu cầu đã duyệt.'))
      })
      .finally(() => {
        if (mounted) setIsLoadingRequests(false)
      })
    return () => {
      mounted = false
    }
  }, [canOperate, isDirectMode])

  useEffect(() => {
    if (!canOperate || !isDirectMode || !presetSuggestionId) return undefined
    let mounted = true
    fetchShelfReplenishmentSuggestionById(presetSuggestionId)
      .then((result) => {
        if (!mounted) return
        setSuggestion(result)
      })
      .catch((error) => {
        if (!mounted) return
        setSuggestion(null)
        showError(getStockFlowErrorMessage(error, 'Không tải được gợi ý bổ sung Kệ Hàng.'))
      })
    return () => {
      mounted = false
    }
  }, [canOperate, isDirectMode, presetSuggestionId])

  // Điền sẵn SKU từ gợi ý nhưng để trống số lượng: Thủ kho tự quyết số lượng điều chuyển.
  useEffect(() => {
    if (!suggestion || catalog.length === 0 || hasPrefilledSuggestion.current) return
    hasPrefilledSuggestion.current = true
    const eligibleIds = new Set(catalog.map((sku) => sku.id))
    const prefilled = suggestion.items
      .filter((item) => eligibleIds.has(item.skuId))
      .map((item) => ({
        skuId: item.skuId,
        skuCode: item.skuCode,
        skuName: item.skuSnapshotName || 'Thành phẩm',
        warehouseQuantityOnHand: Number(stockBySkuId.get(item.skuId)?.warehouseQuantityOnHand ?? 0),
        quantity: '',
      }))
    setDirectLines(prefilled)
    const skippedCount = suggestion.items.length - prefilled.length
    if (skippedCount > 0) {
      showError(`${skippedCount} sản phẩm trong gợi ý không còn đủ điều kiện điều chuyển lên Kệ Hàng.`)
    }
  }, [suggestion, catalog, stockBySkuId])

  const selectRequest = useCallback(async (requestId) => {
    try {
      const request = await fetchStockAdjustmentRequestById(requestId)
      setSelectedRequest(request)
      setRequestLines(
        request.items
          .filter((item) => Number(item.availableToTransferQuantity ?? 0) > 0)
          .map((item) => ({
            sourceRequestLineId: item.id,
            skuId: item.skuId,
            skuCode: item.skuCode,
            skuName: item.skuSnapshotName,
            approvedQuantity: Number(item.approvedQuantity ?? 0),
            fulfilledQuantity: Number(item.fulfilledQuantity ?? 0),
            draftReservedQuantity: Number(item.draftReservedQuantity ?? 0),
            availableToTransferQuantity: Number(item.availableToTransferQuantity ?? 0),
            quantity: String(Number(item.availableToTransferQuantity ?? 0)),
          })),
      )
    } catch (error) {
      showError(getStockFlowErrorMessage(error, 'Không tải được chi tiết yêu cầu.'))
    }
  }, [])

  useEffect(() => {
    if (!canOperate || isDirectMode || !presetRequestId) return
    selectRequest(presetRequestId)
  }, [canOperate, isDirectMode, presetRequestId, selectRequest])

  function addDirectLine(sku, warehouseQuantityOnHand) {
    setDirectLines((current) => {
      if (current.some((line) => line.skuId === sku.id)) return current
      return [
        ...current,
        {
          skuId: sku.id,
          skuCode: sku.skuCode ?? '',
          skuName: sku.variantName || sku.productName || 'Thành phẩm',
          warehouseQuantityOnHand,
          quantity: '',
        },
      ]
    })
  }

  function removeDirectLine(skuId) {
    setDirectLines((current) => current.filter((line) => line.skuId !== skuId))
  }

  function updateDirectQuantity(skuId, value) {
    setDirectLines((current) =>
      current.map((line) => (line.skuId === skuId ? { ...line, quantity: value } : line)),
    )
  }

  function updateRequestQuantity(sourceRequestLineId, value) {
    setRequestLines((current) =>
      current.map((line) =>
        line.sourceRequestLineId === sourceRequestLineId ? { ...line, quantity: value } : line,
      ),
    )
  }

  function buildDirectPayloadLines() {
    const payloadLines = []
    for (const line of directLines) {
      const quantity = Number(line.quantity)
      if (!Number.isInteger(quantity) || quantity <= 0) {
        showError(`${STOCK_FLOW_TERMS.transferQuantity} của ${line.skuCode} phải là số nguyên dương.`)
        return null
      }
      if (quantity > line.warehouseQuantityOnHand) {
        showError(
          `${line.skuCode}: cần ${quantity}, ${STOCK_FLOW_TERMS.warehouse} chỉ còn `
          + `${formatStockQuantity(line.warehouseQuantityOnHand)}.`,
        )
        return null
      }
      payloadLines.push({ skuId: line.skuId, skuCode: line.skuCode, quantity, sourceRequestLineId: null })
    }
    if (payloadLines.length === 0) {
      showError(`${STOCK_FLOW_TERMS.transfer} phải có ít nhất một sản phẩm với số lượng lớn hơn 0.`)
      return null
    }
    return payloadLines
  }

  function buildRequestPayloadLines() {
    const payloadLines = []
    for (const line of requestLines) {
      const quantity = Number(line.quantity)
      if (!line.quantity || quantity === 0) continue
      if (!Number.isInteger(quantity) || quantity < 0) {
        showError(`${STOCK_FLOW_TERMS.transferQuantity} của ${line.skuCode} phải là số nguyên dương.`)
        return null
      }
      if (quantity > line.availableToTransferQuantity) {
        showError(
          `${line.skuCode}: ${STOCK_FLOW_TERMS.transferQuantity} ${quantity} vượt số lượng còn có thể `
          + `điều chuyển (${line.availableToTransferQuantity}).`,
        )
        return null
      }
      payloadLines.push({
        skuId: line.skuId,
        skuCode: line.skuCode,
        quantity,
        sourceRequestLineId: line.sourceRequestLineId,
      })
    }
    if (payloadLines.length === 0) {
      showError(`${STOCK_FLOW_TERMS.transfer} phải có ít nhất một sản phẩm với số lượng lớn hơn 0.`)
      return null
    }
    return payloadLines
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSaving) return

    if (!isDirectMode && !selectedRequest) {
      showError(`Vui lòng chọn ${STOCK_FLOW_TERMS.request} nguồn.`)
      return
    }

    const payloadLines = isDirectMode ? buildDirectPayloadLines() : buildRequestPayloadLines()
    if (!payloadLines) return

    setIsSaving(true)
    try {
      const created = await createStockTransfer({
        note,
        sourceRequestId: isDirectMode ? null : selectedRequest.id,
        sourceSuggestionId: isDirectMode ? (suggestion?.id ?? null) : null,
        lines: payloadLines,
      })
      showSuccess(
        `Đã tạo ${STOCK_FLOW_TERMS.transfer} ${created.transferCode} ở trạng thái Nháp. `
        + 'Tồn kho chỉ thay đổi khi hoàn tất phiếu.',
      )
      navigate('/inventory/stock-transfers')
    } catch (error) {
      showError(getStockFlowErrorMessage(error, `Không tạo được ${STOCK_FLOW_TERMS.transfer}.`))
    } finally {
      setIsSaving(false)
    }
  }

  if (!canOperate) {
    return (
      <PageShell>
        <PageHeader
          title={`Tạo ${STOCK_FLOW_TERMS.transfer}`}
          description="Bạn không có quyền tạo phiếu điều chuyển."
        />
        <section className="rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Chỉ Thủ kho được tạo, sửa và hoàn tất {STOCK_FLOW_TERMS.transfer}.
          <button
            type="button"
            onClick={() => navigate('/inventory/stock-transfers')}
            className="ml-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Quay lại danh sách
          </button>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title={isDirectMode ? `Tạo ${STOCK_FLOW_TERMS.transfer} trực tiếp` : `Tạo ${STOCK_FLOW_TERMS.transfer} từ yêu cầu`}
        description={
          isDirectMode
            ? 'Chọn sản phẩm thành phẩm và số lượng cần điều chuyển. Phiếu được lưu ở trạng thái Nháp.'
            : 'Chỉ hiển thị các yêu cầu đã được duyệt và còn số lượng chưa nằm trong phiếu Nháp khác.'
        }
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {suggestion ? (
          <section className="rounded-2xl border border-[#cfe2d6] bg-[#f2f8f4] px-5 py-4">
            <p className="text-sm font-bold text-[#356647]">
              Tạo từ gợi ý {suggestion.suggestionCode}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Sinh từ phiếu kiểm kệ {suggestion.sourceStocktakeCode}. Sản phẩm đã được điền sẵn,
              số lượng điều chuyển do Thủ kho tự quyết định. Gợi ý sẽ tự động đóng khi phiếu hoàn tất.
            </p>
          </section>
        ) : null}

        {isDirectMode ? (
          <DirectModeSection
            catalog={catalog}
            stockBySkuId={stockBySkuId}
            lines={directLines}
            onAdd={addDirectLine}
            onRemove={removeDirectLine}
            onQuantityChange={updateDirectQuantity}
            search={catalogSearch}
            onSearchChange={setCatalogSearch}
          />
        ) : (
          <RequestModeSection
            requests={requests}
            isLoadingRequests={isLoadingRequests}
            selectedRequest={selectedRequest}
            onSelectRequest={selectRequest}
            lines={requestLines}
            onQuantityChange={updateRequestQuantity}
          />
        )}

        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="px-5 py-4">
            <label className="block">
              <span className={LABEL_CLASS}>Ghi chú</span>
              <textarea
                rows={3}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#538463]"
                placeholder="VD: Bổ sung hàng cho ca chiều"
              />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={() => navigate('/inventory/stock-transfers')}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu Nháp'}
            </button>
          </div>
        </section>
      </form>
    </PageShell>
  )
}
