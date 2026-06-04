import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import { getStockStatusLabel } from '../../orders/utils/orderDisplay.js'
import {
  confirmStockDeductQueue,
  previewStockDeductQueue,
} from '../services/stockDeductQueueApi.js'

function StockDeductPreviewModal({ queueId, orderCode, readOnly = false, onClose, onConfirmed }) {
  const [preview, setPreview] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmShortages, setConfirmShortages] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadPreview() {
      setIsLoading(true)
      setConfirmShortages(null)
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
    try {
      await confirmStockDeductQueue(queueId)
      showSuccess('Đã trừ kho thành công.')
      onConfirmed?.()
      onClose?.()
    } catch (error) {
      if (error.code === 'INSUFFICIENT_STOCK' && error.shortages?.length) {
        setConfirmShortages(error.shortages)
        showError('Vẫn thiếu hàng — cần nhập kho trước khi trừ lại.')
      } else {
        showError(error.message)
      }
    } finally {
      setIsConfirming(false)
    }
  }

  const canConfirm =
    !readOnly &&
    preview &&
    (preview.queueStatus === 'waiting' || preview.queueStatus === 'insufficient')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-deduct-preview-title"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="stock-deduct-preview-title" className="text-lg font-bold text-slate-800">
              Xem trước trừ kho
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
                  {preview.canDeduct ? 'Đủ hàng — có thể trừ' : 'Thiếu hàng'}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Kho đơn: {getStockStatusLabel(preview.orderStockStatus)}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Nguyên liệu</th>
                      <th className="px-4 py-3 text-right">Cần</th>
                      <th className="px-4 py-3 text-right">Có</th>
                      <th className="px-4 py-3 text-right">Thiếu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.items.map((row) => (
                      <tr key={row.materialId} className={row.shortageQuantity > 0 ? 'bg-amber-50/40' : ''}>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {row.materialName || `NVL #${row.materialId}`}
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
                  <p className="font-semibold">Thiếu hàng khi xác nhận:</p>
                  <ul className="mt-2 list-disc pl-5">
                    {confirmShortages.map((row) => (
                      <li key={row.materialId}>
                        NVL #{row.materialId}: cần {row.requiredQuantity}, có {row.availableQuantity}, thiếu{' '}
                        {row.shortageQuantity}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {readOnly ? (
                <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Quản lý chi nhánh chỉ xem preview. Thao tác trừ kho do Thủ kho thực hiện.
                </p>
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
          {canConfirm ? (
            <button
              type="button"
              disabled={isConfirming}
              onClick={handleConfirm}
              className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isConfirming ? 'Đang trừ...' : preview.canDeduct ? 'Xác nhận trừ kho' : 'Thử trừ lại'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default StockDeductPreviewModal
