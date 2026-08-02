import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ReasonSuggestionChips from '../../../components/shared/ReasonSuggestionChips.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { getStockStatusLabel } from '../../orders/utils/orderDisplay.js'
import { getReasonSuggestions } from '../../shared/reasonSuggestions.js'
import {
  cancelStockDeductQueue,
  confirmStockDeductQueue,
  previewStockDeductQueue,
} from '../services/stockDeductQueueApi.js'

function StockDeductPreviewModal({ queueId, orderCode, canConfirm = false, canCancel = false, onClose, onConfirmed }) {
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
        showError('Chưa đủ tồn để xác nhận Queue. Queue đã chuyển sang Chờ hàng.')
        onConfirmed?.()
        return
      }

      showSuccess('Đã xác nhận Queue thành công.')
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
      showSuccess('Đã hủy queue trừ tồn.')
      onConfirmed?.()
      onClose?.()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsCancelling(false)
    }
  }

  const canConfirmQueue =
    canConfirm &&
    preview &&
    (preview.queueStatus === 'waiting' || preview.queueStatus === 'insufficient')
  const canCancelQueue =
    canCancel &&
    preview &&
    (preview.queueStatus === 'waiting' || preview.queueStatus === 'insufficient')
  const isBomReconciliation = Boolean(preview?.isBomReconciliation)
  const operationLabel = isBomReconciliation ? 'đóng gói và trừ Kho' : 'trừ tồn Kệ Hàng'
  const stockLocationLabel = isBomReconciliation ? 'Kho' : 'Kệ Hàng'

  return (
    <div className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl"
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
                  {preview?.orderId ? (
                    <Link className="font-semibold text-[#538463] hover:underline" to={`/orders/${preview.orderId}`}>
                      {orderCode || preview.orderCode}
                    </Link>
                  ) : (
                    <span className="font-semibold">{orderCode || preview?.orderCode}</span>
                  )}
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
                  {preview.canDeduct ? `Đủ tồn ${stockLocationLabel} — có thể xử lý` : `Thiếu tồn ${stockLocationLabel}`}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Trạng thái tồn: {getStockStatusLabel(preview.orderStockStatus)}
                </span>
              </div>

              {preview.lines?.length ? (
                <div className="mb-4 overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Sản Phẩm</th>
                        <th className="px-4 py-3 text-right">Đã bán</th>
                        <th className="px-4 py-3 text-right">Đã trừ thành phẩm</th>
                        <th className="px-4 py-3 text-right">Chờ xử lý BOM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {preview.lines.map((line) => (
                        <tr key={line.skuId}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{line.skuName || '—'}</p>
                            <p className="font-mono text-xs text-slate-500">{line.skuCode}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">{line.orderedQuantity}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{line.finishedDeductedQuantity}</td>
                          <td className="px-4 py-3 text-right font-semibold text-amber-700">
                            {line.pendingBomQuantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Sản Phẩm</th>
                      <th className="px-4 py-3 text-right">Cần trừ</th>
                      <th className="px-4 py-3 text-right">Tồn hiện có</th>
                      <th className="px-4 py-3 text-right">Thiếu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.items.map((row) => (
                      <tr key={row.materialId} className={row.shortageQuantity > 0 ? 'bg-amber-50/40' : ''}>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {row.materialName || `SKU #${row.materialId}`}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{row.requiredQuantity}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{row.availableQuantity}</td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
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
                  <p className="font-semibold">Thiếu tồn {stockLocationLabel} khi xác nhận:</p>
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
                  Bạn chỉ có quyền xem Queue này.
                </p>
              ) : null}
              {!canConfirm && canCancel ? (
                <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Quản lý/Admin chỉ xử lý ngoại lệ bằng thao tác hủy Queue; Thủ kho là actor xác nhận vận hành.
                </p>
              ) : null}

              {showConfirmDialog ? (
                <div className="mt-4 rounded-xl border border-[#538463]/25 bg-[#f0f7f2] p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Xác nhận {operationLabel}?</p>
                  <p className="mt-1">
                    Hệ thống sẽ trừ nguyên liệu kho tổng theo snapshot BOM của phần thiếu và tạo phiếu xuất
                    `sales_bom_reconciliation`. Thành phẩm đã trừ ở checkout sẽ không bị trừ lại.
                  </p>
                  <p className="mt-1 hidden">
                    Hệ thống sẽ trừ `QuantityOnHand` cho các SKU trong đơn này và tạo phiếu xuất
                    `sales_deduct_later`. Tồn kho tổng không bị thay đổi.
                  </p>
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
                      placeholder="Nhập lý do hủy Queue..."
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
              Hủy queue
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
