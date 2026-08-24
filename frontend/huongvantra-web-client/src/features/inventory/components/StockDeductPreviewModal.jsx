import { useEffect, useState } from 'react'
import ReasonSuggestionChips from '../../../components/shared/ReasonSuggestionChips.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVnd, getQueueStatusLabel, getStockStatusLabel, resolveStockDeductOrderStatusMeta } from '../../orders/utils/orderDisplay.js'
import { getReasonSuggestions } from '../../shared/reasonSuggestions.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import {
  cancelStockDeductQueue,
  confirmStockDeductQueue,
  previewStockDeductQueue,
} from '../services/stockDeductQueueApi.js'
import { confirmPacking } from '../../orders/services/customBundleApi.js'
import { PERSONAL_PRODUCT_LABEL } from '../../orders/utils/personalProductLabels.js'
import {
  buildWarehouseStockBySkuIdMap,
  fetchSkuStocks,
  fetchStoreSkuStocks,
} from '../services/inventoryStockApi.js'

function WorkSection({ title, badge, badgeOk, className = '', children }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-100 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {badge ? (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              badgeOk ? 'bg-[#b9d4b0]/40 text-[#356647]' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function StockDeductPreviewModal({
  queueId,
  orderCode,
  orderPaymentStatus,
  queueStatus,
  totalAmount,
  createdAt,
  canConfirm = false,
  canCancel = false,
  customBundles = [],
  onClose,
  onConfirmed,
}) {
  const [preview, setPreview] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmShortages, setConfirmShortages] = useState(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [customMaterialRows, setCustomMaterialRows] = useState([])
  const [isLoadingCustomStock, setIsLoadingCustomStock] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadPreview() {
      setIsLoading(true)
      setConfirmShortages(null)
      setShowConfirmDialog(false)
      setIsCancelOpen(false)
      setCancelReason('')
      try {
        const data = await previewStockDeductQueue(queueId)
        if (!cancelled) setPreview(data)
      } catch (error) {
        if (!cancelled) {
          setPreview(null)
          showError(error.message)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (queueId) loadPreview()
    return () => {
      cancelled = true
    }
  }, [queueId])

  useEffect(() => {
    let cancelled = false
    const bundles = customBundles || []

    async function loadCustomStock() {
      if (!bundles.length) {
        setCustomMaterialRows([])
        return
      }
      setIsLoadingCustomStock(true)
      try {
        const stocks = await fetchSkuStocks().catch(() => fetchStoreSkuStocks().catch(() => []))
        if (cancelled) return
        const stockBySkuId = buildWarehouseStockBySkuIdMap(stocks)
        const rows = []
        for (const bundle of bundles) {
          const packed = String(bundle.queueStatus || '').toLowerCase() === 'confirmed'
          const lines = bundle.lines || []
          for (const line of lines) {
            const skuId = line.skuId
            const required = Number(line.orderedQuantity) || 0
            const available = Number(stockBySkuId.get(skuId) ?? 0)
            const shortage = packed ? 0 : Math.max(0, required - available)
            rows.push({
              key: `${bundle.bundleId || bundle.queueId}:${skuId || line.skuCode}`,
              bundleId: bundle.bundleId || bundle.id,
              bundleLabel: bundle.label || PERSONAL_PRODUCT_LABEL,
              packed,
              materialId: skuId,
              materialCode: line.skuCode || '',
              materialName: line.skuName || '',
              requiredQuantity: required,
              availableQuantity: available,
              shortageQuantity: shortage,
            })
          }
        }
        setCustomMaterialRows(rows)
      } catch {
        if (!cancelled) setCustomMaterialRows([])
      } finally {
        if (!cancelled) setIsLoadingCustomStock(false)
      }
    }

    loadCustomStock()
    return () => {
      cancelled = true
    }
  }, [customBundles])

  const pendingCustomBundles = (customBundles || []).filter(
    (bundle) => String(bundle.queueStatus || '').toLowerCase() !== 'confirmed',
  )
  const hasCustomBundles = (customBundles || []).length > 0
  const customShortageTotal = customMaterialRows.reduce(
    (sum, row) => sum + (Number(row.shortageQuantity) || 0),
    0,
  )
  const catalogQueueId = String(preview?.queueId || queueId || '')
  const catalogNeedsConfirm =
    Boolean(preview) &&
    (preview.queueStatus === 'waiting' || preview.queueStatus === 'insufficient')
  const isCancellationRequested = preview?.orderStockStatus?.toLowerCase() === 'cancellation_requested'
  const isBomReconciliation = Boolean(preview?.isBomReconciliation)
  const willCreateProductionOrder = Boolean(preview?.willCreateProductionOrder)
  const willCreateStockTransfer = Boolean(preview?.willCreateStockTransfer)
  const isBackorder = preview?.lines?.some((line) => {
    const mode = String(line.stockHandlingMode || '')
    const hasWarehouseWork = Number(line.warehouseTransferQuantity) > 0 || Number(line.pendingBomQuantity) > 0
    return mode.includes('backorder') && !hasWarehouseWork
  })
  const hasWarehouseTransfer = preview?.lines?.some((line) => line.warehouseTransferQuantity > 0)
  const canConfirmQueue =
    canConfirm &&
    catalogNeedsConfirm &&
    !isCancellationRequested &&
    (!isBackorder || hasCustomBundles)
  const catalogReady = canConfirmQueue && Boolean(preview?.canDeduct)
  const customReady =
    canConfirm &&
    pendingCustomBundles.length > 0 &&
    !isLoadingCustomStock &&
    customShortageTotal <= 0
  const retryCatalogOnly = canConfirmQueue && !catalogReady && !customReady

  const handleConfirm = async () => {
    setIsConfirming(true)
    setConfirmShortages(null)
    setShowConfirmDialog(false)
    const shouldConfirmCatalog = catalogReady || retryCatalogOnly
    const shouldPackCustom = customReady
    try {
      let catalogOk = !shouldConfirmCatalog
      if (shouldConfirmCatalog) {
        if (!catalogQueueId || catalogQueueId.startsWith('order:')) {
          showError('Không xác định được phiếu thành phẩm để trừ tồn.')
        } else {
          try {
            const result = await confirmStockDeductQueue(catalogQueueId)
            if (result.canDeduct === false) {
              setConfirmShortages(result.shortages || [])
              setPreview((prev) =>
                prev
                  ? { ...prev, queueStatus: result.queueStatus, orderStockStatus: result.orderStockStatus, canDeduct: false }
                  : prev,
              )
              showError('Thành phẩm chưa đủ — giữ Chờ hàng. Phần còn lại không bị trừ.')
            } else {
              catalogOk = true
            }
          } catch (error) {
            if (error.code === 'INSUFFICIENT_STOCK' && error.shortages?.length) {
              setConfirmShortages(error.shortages)
            }
            showError(error.message || 'Không xác nhận được thành phẩm.')
          }
        }
      }

      const packedIds = []
      const packErrors = []
      if (shouldPackCustom) {
        for (const bundle of pendingCustomBundles) {
          const bundleId = bundle.bundleId || bundle.id
          if (!bundleId) continue
          try {
            await confirmPacking(bundleId)
            packedIds.push(bundleId)
          } catch (error) {
            packErrors.push(error?.message || `Không đóng gói được ${PERSONAL_PRODUCT_LABEL.toLowerCase()}.`)
          }
        }
      }

      if (packedIds.length) {
        showSuccess(`Đã đóng gói ${PERSONAL_PRODUCT_LABEL.toLowerCase()} và trừ nguyên liệu Kho.`)
      }
      if (catalogOk && shouldConfirmCatalog) {
        showSuccess(
          preview?.willCreateProductionOrder
            ? 'Đã xác nhận thành phẩm: sinh lệnh sản xuất / điều chuyển (nếu cần) và trừ tồn.'
            : preview?.willCreateStockTransfer
              ? 'Đã xác nhận thành phẩm: điều chuyển Kho → Kệ và trừ tồn.'
              : 'Đã xác nhận trừ tồn thành phẩm.',
        )
      }
      if (packErrors.length) showError(packErrors[0])

      onConfirmed?.()
      if ((catalogOk || !shouldConfirmCatalog) && packErrors.length === 0) onClose?.()
    } catch (error) {
      if (error.code === 'INSUFFICIENT_STOCK' && error.shortages?.length) {
        setConfirmShortages(error.shortages)
        showError('Vẫn thiếu tồn — cần bổ sung trước khi thử lại.')
        onConfirmed?.()
      } else {
        showError(error.message)
      }
    } finally {
      setIsConfirming(false)
    }
  }

  const handleCancel = async () => {
    const reason = cancelReason.trim()
    if (!reason) {
      showError('Vui lòng nhập lý do hủy.')
      return
    }

    setIsCancelling(true)
    try {
      await cancelStockDeductQueue(queueId, reason)
      showSuccess('Đã hủy yêu cầu trừ tồn.')
      onConfirmed?.()
      onClose?.()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsCancelling(false)
    }
  }

  const canCancelQueue =
    canCancel &&
    preview &&
    (preview.queueStatus === 'waiting' || preview.queueStatus === 'insufficient')
  const generatedDocuments = [
    willCreateProductionOrder ? 'Lệnh sản xuất (SX-…)' : null,
    willCreateStockTransfer ? 'Phiếu điều chuyển Kho → Kệ Hàng (DC-…)' : null,
  ].filter(Boolean)
  const operationLabel = isBackorder
    ? 'tình trạng Hẹn Giao Sau'
    : willCreateProductionOrder
      ? 'sản xuất, điều chuyển và trừ đơn'
      : hasWarehouseTransfer
        ? 'điều chuyển và trừ đơn'
        : 'trừ tồn Kệ Hàng'
  const stockAvailabilityLabel = isBackorder
    ? 'Có phần Hẹn Giao Sau'
    : isBomReconciliation
      ? (preview?.canDeduct ? 'Đủ Nguyên liệu/Bao bì tại Kho — có thể xử lý' : 'Thiếu Nguyên liệu/Bao bì tại Kho')
      : hasWarehouseTransfer
        ? (preview?.canDeduct ? 'Đủ Thành phẩm tại Kho — có thể điều chuyển' : 'Thiếu Thành phẩm tại Kho')
        : (preview?.canDeduct ? 'Đủ tồn Kệ Hàng — có thể xử lý' : 'Thiếu tồn Kệ Hàng')
  const detailSectionTitle = isBomReconciliation
    ? 'Nguyên liệu/Bao bì cần để sản xuất'
    : hasWarehouseTransfer
      ? 'Thành phẩm cần điều chuyển từ Kho'
      : 'Tồn cần xử lý'
  const catalogBadge = catalogReady
    ? 'Đủ — sẽ xử lý khi xác nhận'
    : catalogNeedsConfirm
      ? (preview?.canDeduct ? stockAvailabilityLabel : `Chưa đủ — giữ chờ`)
      : stockAvailabilityLabel
  const customBadge = pendingCustomBundles.length === 0 && hasCustomBundles
    ? 'Đã đóng gói'
    : customReady
      ? 'Đủ — sẽ đóng gói khi xác nhận'
      : customShortageTotal > 0
        ? `Thiếu tổng ${customShortageTotal} — chưa đóng gói`
        : 'Đang kiểm tra tồn'
  const orderStatusMeta = preview
    ? resolveStockDeductOrderStatusMeta(orderPaymentStatus ?? preview.orderPaymentStatus, preview.orderStockStatus)
    : null
  const stockStatusLabel = preview?.orderStockStatus === 'pending_warehouse_transfer'
    ? 'Chờ xuất Kho điều chuyển Kệ'
    : getStockStatusLabel(preview?.orderStockStatus)

  return (
    <div className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-deduct-preview-title"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="stock-deduct-preview-title" className="text-lg font-bold text-slate-800">
              Xem trước {operationLabel}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {orderCode || preview?.orderCode ? (
                <>
                  Đơn{' '}
                  <span className="font-semibold">{orderCode || preview?.orderCode}</span>
                </>
              ) : (
                'Đang tải...'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="custom-scrollbar max-h-[calc(90vh-140px)] overflow-y-auto px-6 py-4">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Đang tải preview...</p>
          ) : null}

          {!isLoading && preview ? (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Trạng thái yêu cầu: {getQueueStatusLabel(queueStatus ?? preview.queueStatus)}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    preview.canDeduct ? 'bg-[#b9d4b0]/30 text-[#538463]' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {stockAvailabilityLabel}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Trạng thái xử lý Kho: {stockStatusLabel}
                </span>
                {orderStatusMeta ? (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${orderStatusMeta.className}`}>
                    Trạng thái đơn: {orderStatusMeta.label}
                  </span>
                ) : null}
              </div>

              {isBackorder ? (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Đơn có phần Hẹn Giao Sau; chưa phát sinh trừ tồn cho phần chưa đáp ứng.
                </p>
              ) : null}

              {isCancellationRequested ? (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[20px] text-rose-600">block</span>
                    <div>
                      <p className="font-semibold">Đơn đang chờ duyệt hủy/hoàn tiền</p>
                      <p className="mt-1">
                        Không được xác nhận trừ kho trong lúc này. Vui lòng chờ Manager hoàn tất duyệt hủy đơn hoặc từ chối yêu cầu hủy.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <dl className="mb-4 grid grid-cols-1 overflow-hidden rounded-xl border border-slate-100 text-sm sm:grid-cols-2">
                <div className="border-b border-slate-100 px-4 py-3 sm:border-b-0 sm:border-r">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ngày tạo yêu cầu</dt>
                  <dd className="mt-1 font-semibold text-slate-800">{formatVietnamDateTime(createdAt)}</dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tổng tiền</dt>
                  <dd className="mt-1 font-semibold text-slate-800">{formatVnd(totalAmount)}</dd>
                </div>
              </dl>

              {hasCustomBundles && (catalogNeedsConfirm || pendingCustomBundles.length > 0) ? (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Đơn gồm 2 phần. Mỗi phần xử lý độc lập — chỉ trừ / đóng gói phần đã đủ tồn.</p>
                  <ul className="mt-2 space-y-1">
                    <li>
                      <span className="font-semibold">Thành phẩm:</span>{' '}
                      {catalogReady
                        ? willCreateProductionOrder
                          ? 'đủ nguyên liệu — sẽ sinh lệnh sản xuất / điều chuyển và trừ tồn.'
                          : 'đủ — sẽ trừ tồn / điều chuyển.'
                        : 'chưa đủ — giữ phiếu chờ, không trừ lần này.'}
                    </li>
                    <li>
                      <span className="font-semibold">{PERSONAL_PRODUCT_LABEL}:</span>{' '}
                      {customReady
                        ? 'đủ nguyên liệu — sẽ đóng gói và trừ Kho.'
                        : pendingCustomBundles.length
                          ? 'chưa đủ — chưa đóng gói.'
                          : 'đã đóng gói.'}
                    </li>
                  </ul>
                </div>
              ) : null}

              {preview.lines?.length || preview.items?.length ? (
                <WorkSection title="Thành phẩm" badge={catalogBadge} badgeOk={catalogReady || Boolean(preview.canDeduct && !catalogNeedsConfirm)}>
                  {preview.lines?.length ? (
                    <table className="w-full table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-[38%]" />
                        <col className="w-[12.4%]" />
                        <col className="w-[12.4%]" />
                        <col className="w-[12.4%]" />
                        <col className="w-[12.4%]" />
                        <col className="w-[12.4%]" />
                      </colgroup>
                      <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <tr className="text-[11px]">
                          <th className="px-4 py-3">Sản Phẩm</th>
                          <th className="whitespace-nowrap px-3 py-3 text-right">Khách đặt</th>
                          <th className="whitespace-nowrap px-3 py-3 text-right">Đã trừ Kệ</th>
                          <th className="whitespace-nowrap px-3 py-3 text-right">Lấy từ Kho</th>
                          <th className="whitespace-nowrap px-3 py-3 text-right">Cần sản xuất</th>
                          <th className="whitespace-nowrap px-3 py-3 text-right">Hẹn Giao Sau</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {preview.lines.map((line) => (
                          <tr key={line.skuId}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{line.skuName || '—'}</p>
                              <p className="font-mono text-xs text-slate-500">{line.skuCode}</p>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{line.orderedQuantity}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{line.finishedDeductedQuantity}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{line.warehouseTransferQuantity}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-amber-700">
                              {isBackorder ? 0 : line.pendingBomQuantity}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-amber-700">
                              {isBackorder ? Math.max(0, line.orderedQuantity - line.finishedDeductedQuantity - line.warehouseTransferQuantity) : 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}

                  {preview.items?.length ? (
                    <div className={preview.lines?.length ? 'border-t border-slate-100' : ''}>
                      <p className="bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {detailSectionTitle}
                      </p>
                      <table className="w-full table-fixed text-left text-sm">
                        <colgroup>
                          <col className="w-[44%]" />
                          <col className="w-[16%]" />
                          <col className="w-[25%]" />
                          <col className="w-[15%]" />
                        </colgroup>
                        <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                          <tr className="text-[11px]">
                            <th className="px-4 py-3">{isBomReconciliation ? 'Nguyên liệu/Bao bì' : 'Thành phẩm'}</th>
                            <th className="whitespace-nowrap px-4 py-3 text-right">{isBomReconciliation ? 'Cần dùng' : 'Cần điều chuyển'}</th>
                            <th className="whitespace-nowrap px-4 py-3 text-right">Tồn Kho khả dụng</th>
                            <th className="whitespace-nowrap px-4 py-3 text-right">Thiếu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {preview.items.map((row) => (
                            <tr key={row.materialId} className={row.shortageQuantity > 0 ? 'bg-amber-50/40' : ''}>
                              <td className="px-4 py-3 font-medium text-slate-800">
                                {row.materialName || `SKU #${row.materialId}`}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{row.requiredQuantity}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{row.availableQuantity}</td>
                              <td
                                className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${
                                  row.shortageQuantity > 0 ? 'text-amber-700' : 'text-[#538463]'
                                }`}
                              >
                                {row.shortageQuantity > 0 ? row.shortageQuantity : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </WorkSection>
              ) : null}

              {hasCustomBundles ? (
                <WorkSection
                  className="mt-4"
                  title={PERSONAL_PRODUCT_LABEL}
                  badge={isLoadingCustomStock ? 'Đang tải tồn...' : customBadge}
                  badgeOk={customReady || (pendingCustomBundles.length === 0 && hasCustomBundles)}
                >
                  {isLoadingCustomStock ? (
                    <p className="px-4 py-3 text-sm text-slate-500">Đang tải tồn Kho nguyên liệu...</p>
                  ) : customMaterialRows.length ? (
                    <table className="w-full table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-[44%]" />
                        <col className="w-[18%]" />
                        <col className="w-[20%]" />
                        <col className="w-[18%]" />
                      </colgroup>
                      <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <tr className="text-[11px]">
                          <th className="px-4 py-3">Mặt hàng cần trừ từ Kho</th>
                          <th className="whitespace-nowrap px-4 py-3 text-right">Cần trừ</th>
                          <th className="whitespace-nowrap px-4 py-3 text-right">Tồn Kho</th>
                          <th className="whitespace-nowrap px-4 py-3 text-right">Thiếu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {customMaterialRows.map((row) => (
                          <tr key={row.key} className={row.shortageQuantity > 0 ? 'bg-amber-50/40' : ''}>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              <p>{row.materialName || `SKU #${row.materialId}`}</p>
                              {row.materialCode ? (
                                <p className="font-mono text-xs font-normal text-slate-500">{row.materialCode}</p>
                              ) : null}
                              {row.packed ? (
                                <p className="mt-0.5 text-xs font-normal text-[#356647]">Đã đóng gói</p>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
                              {row.requiredQuantity}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
                              {row.availableQuantity}
                            </td>
                            <td
                              className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${
                                row.shortageQuantity > 0 ? 'text-amber-700' : 'text-[#538463]'
                              }`}
                            >
                              {row.shortageQuantity > 0 ? row.shortageQuantity : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <ul className="divide-y divide-slate-50 text-sm">
                      {(customBundles || []).map((bundle) => {
                        const packed = String(bundle.queueStatus || '').toLowerCase() === 'confirmed'
                        return (
                          <li key={bundle.bundleId || bundle.queueId} className="px-4 py-3">
                            <p className="font-medium text-slate-800">
                              {bundle.label || PERSONAL_PRODUCT_LABEL}
                            </p>
                            <p className="mt-0.5 text-xs text-[#356647]">
                              {packed ? 'Đã đóng gói / đã trừ nguyên liệu Kho' : 'Chờ đóng gói / trừ nguyên liệu Kho'}
                            </p>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </WorkSection>
              ) : null}

              {confirmShortages?.length ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Thiếu tồn Kho khi xác nhận:</p>
                  <ul className="mt-2 list-disc pl-5">
                    {confirmShortages.map((row) => (
                      <li key={row.materialId}>
                        {row.materialName || `SKU #${row.materialId}`}: cần {row.requiredQuantity}, có {row.availableQuantity}, thiếu{' '}
                        {row.shortageQuantity}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!canConfirm && !canCancel ? (
                <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Bạn chỉ có quyền xem yêu cầu đóng gói này.
                </p>
              ) : null}
              {!canConfirm && canCancel ? (
                <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Quản lý/Admin chỉ xử lý ngoại lệ bằng thao tác hủy yêu cầu; Thủ kho là người xác nhận vận hành.
                </p>
              ) : null}

              {showConfirmDialog ? (
                <div className="mt-4 rounded-xl border border-[#538463]/25 bg-[#f0f7f2] p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">
                    {catalogReady && customReady
                      ? 'Xác nhận xử lý cả hai phần đã đủ tồn?'
                      : catalogReady
                        ? 'Chỉ xác nhận thành phẩm — sản phẩm cá nhân giữ chờ?'
                        : customReady
                          ? `Chỉ đóng gói ${PERSONAL_PRODUCT_LABEL.toLowerCase()} — thành phẩm giữ chờ?`
                          : `Xác nhận ${operationLabel}?`}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {catalogNeedsConfirm ? (
                      <li className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="font-semibold text-slate-900">Thành phẩm</p>
                        <p className="mt-0.5">
                          {catalogReady
                            ? willCreateProductionOrder
                              ? 'Sẽ sinh lệnh sản xuất / điều chuyển (nếu cần) rồi trừ tồn. Phần đã trừ Kệ không trừ lại.'
                              : 'Sẽ điều chuyển (nếu cần) rồi trừ tồn thành phẩm.'
                            : 'Chưa đủ — lần này không trừ, phiếu thành phẩm vẫn chờ.'}
                        </p>
                      </li>
                    ) : null}
                    {hasCustomBundles ? (
                      <li className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="font-semibold text-slate-900">{PERSONAL_PRODUCT_LABEL}</p>
                        <p className="mt-0.5">
                          {customReady
                            ? 'Sẽ đóng gói và trừ nguyên liệu trên Kho.'
                            : pendingCustomBundles.length
                              ? 'Chưa đủ nguyên liệu — lần này không đóng gói.'
                              : 'Đã đóng gói trước đó.'}
                        </p>
                      </li>
                    ) : null}
                  </ul>
                  {generatedDocuments.length && catalogReady ? (
                    <div className="mt-2 rounded-lg border border-[#538463]/20 bg-white px-3 py-2">
                      <p className="font-semibold text-slate-900">Chứng từ sẽ được sinh tự động:</p>
                      <ul className="mt-1 list-disc pl-5">
                        {generatedDocuments.map((doc) => (
                          <li key={doc}>{doc}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirmDialog(false)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={isConfirming}
                      onClick={handleConfirm}
                      className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#457053] disabled:opacity-50"
                    >
                      {isConfirming ? 'Đang trừ...' : 'Xác nhận cuối'}
                    </button>
                  </div>
                </div>
              ) : null}

              {isCancelOpen ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
                  <label className="block">
                    <span className="font-semibold">Lý do hủy *</span>
                    <ReasonSuggestionChips
                      className="mt-2"
                      suggestions={getReasonSuggestions('stockDeductCancel')}
                      value={cancelReason}
                      onSelect={setCancelReason}
                    />
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-red-400"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      placeholder="Nhập lý do hủy yêu cầu..."
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCancelOpen(false)
                        setCancelReason('')
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={isCancelling || !cancelReason.trim()}
                      onClick={handleCancel}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {isCancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {!isLoading && !preview ? (
            <p className="py-8 text-center text-sm text-slate-500">Không tải được preview.</p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
          {canCancelQueue && !showConfirmDialog && !isCancelOpen ? (
            <button
              type="button"
              disabled={isConfirming || isCancelling}
              onClick={() => setIsCancelOpen(true)}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Hủy yêu cầu
            </button>
          ) : null}
          {(canConfirmQueue || (canConfirm && pendingCustomBundles.length > 0)) && !showConfirmDialog && !isCancelOpen ? (
            <button
              type="button"
              disabled={isConfirming}
              onClick={() => setShowConfirmDialog(true)}
              className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isConfirming
                ? 'Đang xử lý...'
                : catalogReady && customReady
                  ? 'Xác nhận 2 phần đã đủ'
                  : catalogReady
                    ? 'Xác nhận thành phẩm'
                    : customReady
                      ? `Đóng gói ${PERSONAL_PRODUCT_LABEL.toLowerCase()}`
                      : preview?.canDeduct
                        ? `Xác nhận ${operationLabel}`
                        : 'Thử xử lý lại'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default StockDeductPreviewModal
