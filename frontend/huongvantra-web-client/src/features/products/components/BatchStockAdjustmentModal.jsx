import { useMemo, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import { createStockAdjustmentRequest } from '../../inventory/services/stockAdjustmentRequestApi.js'
import { formatStockQuantity } from '../utils/productDisplay.js'

export function buildSkuSnapshotName(sku, productName) {
  const parts = []
  if (productName?.trim()) parts.push(productName.trim())
  if (sku.packagingType?.trim()) parts.push(sku.packagingType.trim())
  if (parts.length) return parts.join(' — ')
  return sku.skuCode || 'SKU'
}

function BatchStockAdjustmentModal({ lines, onClose, onSubmitted }) {
  const [draftLines, setDraftLines] = useState(() =>
    lines.map((line) => ({
      skuId: line.sku.id,
      skuCode: line.sku.skuCode,
      skuSnapshotName: line.skuSnapshotName ?? buildSkuSnapshotName(line.sku, line.productName),
      quantityOnHand: Number(line.quantityOnHand ?? 0),
      delta: line.quantityDelta != null ? String(line.quantityDelta) : '',
    })),
  )
  const [reason, setReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const parsedLines = useMemo(
    () =>
      draftLines.map((line) => ({
        ...line,
        quantityDelta: Number(line.delta),
      })),
    [draftLines],
  )

  function updateDelta(skuId, value) {
    setDraftLines((current) =>
      current.map((line) => (line.skuId === skuId ? { ...line, delta: value } : line)),
    )
  }

  function removeLine(skuId) {
    setDraftLines((current) => current.filter((line) => line.skuId !== skuId))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (draftLines.length === 0) {
      showError('Lô yêu cầu phải có ít nhất một SKU.')
      return
    }

    const items = []
    for (const line of parsedLines) {
      if (!Number.isFinite(line.quantityDelta) || line.quantityDelta <= 0) {
        showError(`Nhập số lượng bổ sung lớn hơn 0 cho SKU ${line.skuCode}.`)
        return
      }
      items.push({
        skuId: line.skuId,
        skuCode: line.skuCode,
        skuSnapshotName: line.skuSnapshotName,
        quantityDelta: line.quantityDelta,
      })
    }

    setIsSaving(true)
    try {
      const created = await createStockAdjustmentRequest({
        reason: reason.trim() || null,
        items,
      })
      const lineCount = created.items?.length ?? items.length
      showSuccess(
        `Đã gửi yêu cầu bổ sung tồn quầy ${created.requestCode} (${lineCount} SKU). Chờ Thủ kho duyệt.`,
      )
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
        className="flex max-h-[min(90dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-adjust-stock-title"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="batch-adjust-stock-title" className="text-lg font-bold text-slate-800">
              Gửi yêu cầu bổ sung tồn quầy
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {draftLines.length} SKU trong yêu cầu — Kho tổng cấp sang Tồn quầy POS mặc định
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

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
            {draftLines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                Chưa có SKU trong lô.
              </p>
            ) : (
              draftLines.map((line) => (
                <div
                  key={line.skuId}
                  className="rounded-xl border border-slate-100 bg-[#fbf9f1]/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-[#356647]">{line.skuCode}</p>
                      {line.skuSnapshotName !== line.skuCode ? (
                        <p className="mt-0.5 text-xs text-slate-500">{line.skuSnapshotName}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-600">
                        Tồn quầy POS mặc định:{' '}
                        <span className="font-semibold">{formatStockQuantity(line.quantityOnHand)}</span>
                      </p>
                    </div>
                    {draftLines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeLine(line.skuId)}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Bỏ khỏi lô
                      </button>
                    ) : null}
                  </div>
                  <label className="mt-3 block space-y-1">
                    <span className="text-xs font-semibold text-[#717971]">Số lượng bổ sung *</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="VD: 50"
                      value={line.delta}
                      onChange={(event) => updateDelta(line.skuId, event.target.value)}
                      className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                    />
                  </label>
                </div>
              ))
            )}

            <label className="block space-y-2">
              <span className="text-xs font-semibold text-[#717971]">
                Ghi chú gửi duyệt
              </span>
              <textarea
                rows={3}
                placeholder={
                  'Tùy chọn — ghi chú cho Thủ kho'
                }
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full resize-none rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
              />
            </label>
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
              disabled={isSaving || draftLines.length === 0}
              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang gửi...' : `Gửi yêu cầu (${draftLines.length} SKU)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BatchStockAdjustmentModal
