import { useMemo, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import { createStockAdjustmentRequest } from '../../inventory/services/stockAdjustmentRequestApi.js'
import { formatStockQuantity } from '../utils/productDisplay.js'

function buildSkuSnapshotName(sku, productName) {
  const parts = []
  if (productName?.trim()) parts.push(productName.trim())
  if (sku.packagingType?.trim()) parts.push(sku.packagingType.trim())
  if (parts.length) return parts.join(' — ')
  return sku.skuCode || 'SKU'
}

function AdjustSkuStockModal({ sku, productName, quantityOnHand = 0, onClose, onSubmitted }) {
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const quantityDelta = Number(delta)
  const needsReason = Number.isFinite(quantityDelta) && quantityDelta < 0

  const skuSnapshotName = useMemo(() => buildSkuSnapshotName(sku, productName), [sku, productName])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
      showError('Nhập số lượng thay đổi (+ nhập từ kho, − giảm tồn cửa hàng).')
      return
    }

    if (needsReason && !reason.trim()) {
      showError('Yêu cầu giảm tồn cần ghi rõ lý do.')
      return
    }

    setIsSaving(true)
    try {
      const created = await createStockAdjustmentRequest({
        skuId: sku.id,
        skuCode: sku.skuCode,
        skuSnapshotName,
        quantityDelta,
        reason: reason.trim() || null,
      })
      showSuccess(`Đã gửi yêu cầu ${created.requestCode}. Chờ Thủ kho duyệt.`)
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
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-stock-title"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="adjust-stock-title" className="text-lg font-bold text-slate-800">
              Gửi yêu cầu điều chỉnh tồn
            </h2>
            <p className="mt-1 font-mono text-sm text-[#356647]">{sku.skuCode}</p>
            {skuSnapshotName !== sku.skuCode ? (
              <p className="mt-0.5 text-xs text-slate-500">{skuSnapshotName}</p>
            ) : null}
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

        <form className="space-y-4 px-6 py-5" onSubmit={handleSubmit}>
          <p className="text-sm text-slate-600">
            Tồn cửa hàng hiện tại:{' '}
            <span className="font-bold text-slate-800">{formatStockQuantity(quantityOnHand)}</span>
          </p>

          <label className="block space-y-2">
            <span className="text-xs font-semibold text-[#717971]">Số lượng thay đổi *</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="VD: 50 (nhập từ kho) hoặc -5 (giảm tồn CH)"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
              autoFocus
            />
            <p className="text-xs text-slate-500">
              Số dương = yêu cầu nhập từ kho tổng (Thủ kho duyệt sẽ tạo phiếu xuất kho). Số âm = giảm tồn tại cửa
              hàng (kiểm kê, hư hỏng...).
            </p>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold text-[#717971]">
              Lý do{needsReason ? ' *' : ''}
            </span>
            <textarea
              rows={3}
              placeholder={needsReason ? 'Bắt buộc khi xuất / giảm tồn' : 'Tùy chọn — ghi chú cho Thủ kho'}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full resize-none rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
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

export default AdjustSkuStockModal
