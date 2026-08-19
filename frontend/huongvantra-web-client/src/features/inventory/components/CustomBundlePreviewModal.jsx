import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import { getOrderStatusLabel, getStockStatusLabel } from '../../orders/utils/orderDisplay.js'
import { PERSONAL_PRODUCT_LABEL } from '../../orders/utils/personalProductLabels.js'
import { confirmPacking, fetchCustomBundles } from '../../orders/services/customBundleApi.js'
import {
  buildWarehouseStockBySkuIdMap,
  fetchSkuStocks,
  fetchStoreSkuStocks,
} from '../services/inventoryStockApi.js'

/**
 * Modal «Xem & xác nhận» đóng gói sản phẩm cá nhân — cùng pattern StockDeductPreviewModal.
 */
function CustomBundlePreviewModal({
  bundleId,
  orderCode,
  orderId,
  orderStatus,
  orderStockStatus,
  canConfirm = false,
  onClose,
  onConfirmed,
}) {
  const [bundle, setBundle] = useState(null)
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmError, setConfirmError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setShowConfirmDialog(false)
      setConfirmError(null)
      try {
        const [bundlesPage, stocks] = await Promise.all([
          fetchCustomBundles({ page: 1, pageSize: 100, packingStatus: 'Pending' }),
          fetchSkuStocks().catch(() => fetchStoreSkuStocks().catch(() => [])),
        ])
        if (cancelled) return

        let found = (bundlesPage.items || []).find((b) => b.id === bundleId) || null
        if (!found) {
          const packedPage = await fetchCustomBundles({ page: 1, pageSize: 100, packingStatus: 'Packed' })
          if (cancelled) return
          found = (packedPage.items || []).find((b) => b.id === bundleId) || null
        }
        setBundle(found)
        const stockBySkuId = buildWarehouseStockBySkuIdMap(stocks)
        const previewItems = (found?.ingredients || []).map((ing) => {
          const required = Number(ing.quantity) || 0
          const available = Number(stockBySkuId.get(ing.materialSkuId) ?? 0)
          const shortage = Math.max(0, required - available)
          return {
            materialId: ing.materialSkuId,
            materialCode: ing.materialSkuCode || '',
            materialName: ing.materialSnapshotName || '',
            requiredQuantity: required,
            availableQuantity: available,
            shortageQuantity: shortage,
          }
        })
        setItems(previewItems)
      } catch (error) {
        if (!cancelled) {
          setBundle(null)
          setItems([])
          showError(error.message || `Không tải được preview ${PERSONAL_PRODUCT_LABEL.toLowerCase()}.`)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (bundleId) load()
    return () => {
      cancelled = true
    }
  }, [bundleId])

  const canDeduct = items.length > 0 && items.every((row) => row.shortageQuantity <= 0)
  const displayOrderCode = orderCode || bundle?.orderCode || ''
  const displayOrderId = orderId || bundle?.orderId
  const stockStatus = orderStockStatus || (String(orderStatus || bundle?.orderStatus || '').toLowerCase() === 'waitingmaterials'
    ? 'waiting_materials'
    : 'pending_custom_pack')

  const handleConfirm = async () => {
    setIsConfirming(true)
    setConfirmError(null)
    setShowConfirmDialog(false)
    try {
      await confirmPacking(bundleId)
      showSuccess(`Đã xác nhận đóng gói ${PERSONAL_PRODUCT_LABEL.toLowerCase()}, trừ nguyên liệu Kho, ghi lệnh sản xuất và phiếu điều chuyển lên Kệ.`)
      onConfirmed?.()
      onClose?.()
    } catch (error) {
      setConfirmError(error?.message || 'Không đủ tồn Kho hoặc đóng gói thất bại.')
      showError(error?.message || 'Không đóng gói được. Kiểm tra tồn Kho rồi thử lại.')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-pack-preview-title"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="custom-pack-preview-title" className="text-lg font-bold text-slate-800">
              Xem trước đóng gói {PERSONAL_PRODUCT_LABEL.toLowerCase()}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {displayOrderCode ? (
                <>
                  Đơn{' '}
                  {displayOrderId ? (
                    <Link className="font-semibold text-[#538463] hover:underline" to={`/orders/${displayOrderId}`}>
                      {displayOrderCode}
                    </Link>
                  ) : (
                    <span className="font-semibold">{displayOrderCode}</span>
                  )}
                  {bundle?.label ? <span className="text-slate-400"> · {bundle.label}</span> : null}
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

          {!isLoading && bundle ? (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    canDeduct ? 'bg-[#b9d4b0]/30 text-[#538463]' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {canDeduct ? 'Đủ tồn Kho — có thể đóng gói' : 'Thiếu tồn Kho'}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Trạng thái tồn: {getStockStatusLabel(stockStatus) || stockStatus}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Đơn: {getOrderStatusLabel(orderStatus || bundle.orderStatus)}
                </span>
                <span className="rounded-full bg-[#e8f0e9] px-3 py-1 text-xs font-semibold text-[#356647]">
                  {PERSONAL_PRODUCT_LABEL}
                </span>
              </div>

              <div className="mb-4 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Nguyên liệu / bao bì</th>
                      <th className="px-4 py-3 text-right">Số lượng gói</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(bundle.ingredients || []).map((ing) => (
                      <tr key={ing.materialSkuId || ing.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{ing.materialSnapshotName || '—'}</p>
                          <p className="font-mono text-xs text-slate-500">{ing.materialSkuCode}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                          ×{ing.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Sản Phẩm</th>
                      <th className="px-4 py-3 text-right">Cần trừ</th>
                      <th className="px-4 py-3 text-right">Tồn Kho hiện có</th>
                      <th className="px-4 py-3 text-right">Thiếu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((row) => (
                      <tr key={row.materialId} className={row.shortageQuantity > 0 ? 'bg-amber-50/40' : ''}>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          <p>{row.materialName || `SKU #${row.materialId}`}</p>
                          {row.materialCode ? (
                            <p className="font-mono text-xs font-normal text-slate-500">{row.materialCode}</p>
                          ) : null}
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

              {confirmError ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Không xác nhận được</p>
                  <p className="mt-2 whitespace-pre-line leading-relaxed">{confirmError}</p>
                </div>
              ) : null}

              {showConfirmDialog ? (
                <div className="mt-4 rounded-xl border border-[#538463]/25 bg-[#f0f7f2] p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Xác nhận đóng gói {PERSONAL_PRODUCT_LABEL.toLowerCase()}?</p>
                  <p className="mt-1">
                    Hệ thống sẽ trừ nguyên liệu / bao bì trên Kho, ghi phiếu xuất, tạo lệnh sản xuất
                    (Hoàn thành), nhập thành phẩm vào Kho và tự động sinh phiếu điều chuyển Kho → Kệ.
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
            </>
          ) : null}

          {!isLoading && !bundle ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Không tìm thấy {PERSONAL_PRODUCT_LABEL.toLowerCase()} chờ đóng gói (có thể đã được đóng gói).
            </p>
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
          {canConfirm && bundle && !showConfirmDialog ? (
            <button
              type="button"
              disabled={isConfirming}
              onClick={() => setShowConfirmDialog(true)}
              className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isConfirming
                ? 'Đang xử lý...'
                : canDeduct
                  ? 'Xác nhận đóng gói'
                  : 'Thử đóng gói lại'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default CustomBundlePreviewModal
