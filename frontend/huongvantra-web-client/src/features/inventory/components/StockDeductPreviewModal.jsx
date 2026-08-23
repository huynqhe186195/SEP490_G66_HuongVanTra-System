import { useEffect, useState } from 'react'
import ReasonSuggestionChips from '../../../components/shared/ReasonSuggestionChips.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { getStockStatusLabel, resolveStockDeductOrderStatusMeta } from '../../orders/utils/orderDisplay.js'
import { getReasonSuggestions } from '../../shared/reasonSuggestions.js'
import {
  cancelStockDeductQueue,
  confirmStockDeductQueue,
  previewStockDeductQueue,
} from '../services/stockDeductQueueApi.js'

function StockDeductPreviewModal({ queueId, orderCode, orderPaymentStatus, canConfirm = false, canCancel = false, onClose, onConfirmed }) {
  const [preview, setPreview] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmShortages, setConfirmShortages] = useState(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

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

  const handleConfirm = async () => {
    setIsConfirming(true)
    setConfirmShortages(null)
    setShowConfirmDialog(false)
    try {
      const result = await confirmStockDeductQueue(queueId)
      if (result.canDeduct === false) {
        setConfirmShortages(result.shortages || [])
        setPreview((prev) =>
          prev
            ? { ...prev, queueStatus: result.queueStatus, orderStockStatus: result.orderStockStatus, canDeduct: false }
            : prev,
        )
        showError('Chưa đủ tồn để xác nhận. Yêu cầu đóng gói đã chuyển sang Chờ hàng.')
        onConfirmed?.()
        return
      }

      showSuccess(
        preview?.willCreateProductionOrder
          ? 'Đã xác nhận: đã sinh lệnh sản xuất và phiếu điều chuyển (nếu cần), trừ tồn Kệ.'
          : preview?.willCreateStockTransfer
            ? 'Đã xác nhận: đã sinh phiếu điều chuyển Kho → Kệ và trừ tồn.'
            : 'Đã xác nhận trừ tồn thành công.',
      )
      onConfirmed?.()
      onClose?.()
    } catch (error) {
      if (error.code === 'INSUFFICIENT_STOCK' && error.shortages?.length) {
        setConfirmShortages(error.shortages)
        showError('Vẫn thiếu tồn — cần bổ sung trước khi thử lại.')
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

  const isCancellationRequested = preview?.orderStockStatus?.toLowerCase() === 'cancellation_requested'
  const canCancelQueue =
    canCancel &&
    preview &&
    (preview.queueStatus === 'waiting' || preview.queueStatus === 'insufficient')
  const isBomReconciliation = Boolean(preview?.isBomReconciliation)
  const willCreateProductionOrder = Boolean(preview?.willCreateProductionOrder)
  const willCreateStockTransfer = Boolean(preview?.willCreateStockTransfer)
  const isBackorder = preview?.lines?.some((line) => line.stockHandlingMode.includes('backorder'))
  const hasWarehouseTransfer = preview?.lines?.some((line) => line.warehouseTransferQuantity > 0)
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
  const canConfirmQueue =
    canConfirm &&
    preview &&
    !isBackorder &&
    (preview.queueStatus === 'waiting' || preview.queueStatus === 'insufficient') &&
    !isCancellationRequested
  const orderStatusMeta = preview
    ? resolveStockDeductOrderStatusMeta(orderPaymentStatus ?? preview.orderPaymentStatus, preview.orderStockStatus)
    : null

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
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    preview.canDeduct ? 'bg-[#b9d4b0]/30 text-[#538463]' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {stockAvailabilityLabel}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Trạng thái tồn: {getStockStatusLabel(preview.orderStockStatus)}
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

              {preview.lines?.length ? (
                <div className="mb-4 overflow-hidden rounded-xl border border-slate-100">
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
                </div>
              ) : null}

              <div className="overflow-hidden rounded-xl border border-slate-100">
                <p className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">{detailSectionTitle}</p>
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
                  <p className="font-semibold text-slate-900">Xác nhận {operationLabel}?</p>
                  {willCreateProductionOrder ? (
                    <p className="mt-1">
                      Hệ thống sẽ sản xuất phần còn thiếu theo BOM, điều chuyển Thành phẩm từ Kho lên Kệ, rồi hoàn tất trừ đơn.
                      Phần đã trừ từ Kệ sẽ không bị trừ lại.
                    </p>
                  ) : (
                    <p className="mt-1">
                      Hệ thống sẽ điều chuyển Thành phẩm từ Kho lên Kệ Hàng rồi hoàn tất trừ đơn. Phần đã trừ từ Kệ sẽ không bị trừ lại.
                    </p>
                  )}
                  {generatedDocuments.length ? (
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
          {canConfirmQueue && !showConfirmDialog && !isCancelOpen ? (
            <button
              type="button"
              disabled={isConfirming}
              onClick={() => setShowConfirmDialog(true)}
              className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isConfirming ? 'Đang xử lý...' : preview.canDeduct ? `Xác nhận ${operationLabel}` : 'Thử xử lý lại'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default StockDeductPreviewModal
