import { useMemo, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import { createStockAdjustmentRequest } from '../../inventory/services/stockAdjustmentRequestApi.js'
import { formatStockQuantity } from '../utils/productDisplay.js'
import { buildSkuSnapshotName } from './BatchStockAdjustmentModal.jsx'

const DEFAULT_TRANSFER_REASON = 'Xuất kho tổng sang cửa hàng để bán POS'

function TransferToStoreModal({
  sku,
  productName = '',
  warehouseQuantityOnHand = 0,
  quantityOnHand = 0,
  onClose,
  onSubmitted,
}) {
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState(DEFAULT_TRANSFER_REASON)
  const [isSaving, setIsSaving] = useState(false)

  const warehouseQty = Number(warehouseQuantityOnHand ?? 0)
  const storeQty = Number(quantityOnHand ?? 0)
  const skuSnapshotName = useMemo(
    () => buildSkuSnapshotName(sku ?? {}, productName),
    [productName, sku],
  )

  const parsedQuantity = Number(quantity)
  const canPreviewAfter =
    Number.isFinite(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= warehouseQty

  async function handleSubmit(event) {
    event.preventDefault()

    if (!sku?.id) {
      showError('Vui lòng chọn SKU cần xuất sang cửa hàng.')
      return
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      showError('Số lượng xuất sang cửa hàng phải lớn hơn 0.')
      return
    }

    if (!Number.isInteger(parsedQuantity)) {
      showError('Số lượng xuất sang cửa hàng phải là số nguyên.')
      return
    }

    if (parsedQuantity > warehouseQty) {
      showError('Số lượng xuất không được vượt tồn kho tổng hiện có.')
      return
    }

    setIsSaving(true)
    try {
      const created = await createStockAdjustmentRequest({
        reason: reason.trim() || DEFAULT_TRANSFER_REASON,
        items: [
          {
            skuId: sku.id,
            skuCode: sku.skuCode,
            skuSnapshotName,
            quantityDelta: parsedQuantity,
          },
        ],
      })

      showSuccess(
        `Đã gửi yêu cầu ${created.requestCode} xuất ${formatStockQuantity(parsedQuantity)} ${sku.skuCode} sang cửa hàng. Chờ duyệt.`,
      )
      onSubmitted?.(created)
      onClose?.()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (!sku) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="flex max-h-[min(90dvh,680px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-to-store-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h2 id="transfer-to-store-title" className="text-lg font-bold text-slate-800">
              Xuất sang cửa hàng
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Kho tổng → Cửa hàng/Quầy POS
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="rounded-xl border border-slate-100 bg-[#fbf9f1]/40 p-4">
              <p className="font-mono text-sm font-bold text-[#356647]">{sku.skuCode}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{skuSnapshotName}</p>
              {productName ? <p className="mt-0.5 text-xs text-slate-500">{productName}</p> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Nguồn</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Kho tổng</p>
                <p className="mt-2 text-2xl font-bold text-[#356647]">
                  {formatStockQuantity(warehouseQty)}
                </p>
                <p className="mt-1 text-xs text-slate-500">WarehouseQuantityOnHand</p>
              </div>
              <div className="hidden items-center justify-center px-1 text-slate-400 sm:flex">
                <span className="material-symbols-outlined text-[24px]">arrow_forward</span>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700">Đích</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Cửa hàng/Quầy POS</p>
                <p className="mt-2 text-2xl font-bold text-[#356647]">
                  {formatStockQuantity(storeQty)}
                </p>
                <p className="mt-1 text-xs text-slate-500">QuantityOnHand</p>
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Số lượng xuất *</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max={Math.max(warehouseQty, 0)}
                step="1"
                placeholder="VD: 5"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
              />
              {canPreviewAfter ? (
                <p className="text-xs text-slate-500">
                  Sau khi duyệt: Kho tổng còn {formatStockQuantity(warehouseQty - parsedQuantity)}, cửa hàng có{' '}
                  {formatStockQuantity(storeQty + parsedQuantity)}.
                </p>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Ghi chú gửi duyệt</span>
              <textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full resize-none rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
              />
            </label>

            {warehouseQty <= 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                SKU này chưa có tồn kho tổng để xuất sang cửa hàng.
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving || warehouseQty <= 0}
              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang gửi...' : 'Gửi yêu cầu xuất'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TransferToStoreModal
