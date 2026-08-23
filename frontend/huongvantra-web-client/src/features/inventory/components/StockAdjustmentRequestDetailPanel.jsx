import { Link } from 'react-router-dom'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import {
  getAdjustmentLineStatusLabel,
  getAdjustmentRequestStatusPresentation,
  getAdjustmentStatusClass,
} from '../services/stockAdjustmentRequestApi.js'
import { PRODUCTION_STATUS_LABEL } from '../services/productionOrderApi.js'

const PROCESSABLE_LINE_STATUSES = new Set([
  'pending',
  'approved',
  'waitingforstock',
  'processing',
  'partiallyfulfilled',
])

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  )
}

function getProcessActionLabel(item) {
  if (item.autoProductionOrderId) return 'Kiểm tra tiến độ sản xuất'
  if (item.warehouseQuantityOnHand == null) return 'Xử lý yêu cầu'

  const available = Number(item.warehouseQuantityOnHand)
  const requested = Number(item.remainingQuantity ?? item.requestedQuantity ?? 0)
  if (Number.isFinite(available) && available >= requested) return 'Chuẩn bị chuyển lên Kệ'

  return Number.isFinite(available)
    ? 'Tạo Lệnh sản xuất'
    : 'Xử lý yêu cầu'
}

export default function StockAdjustmentRequestDetailPanel({
  request,
  canReview,
  canCancel,
  canCancelAny,
  currentUserId,
  activeTab,
  processingItemId,
  onProcessItem,
  onConfirmTransfer,
  onCancel,
}) {
  if (!request) {
    return <p className="text-sm text-slate-500">Chọn một yêu cầu để xem chi tiết.</p>
  }

  const items = Array.isArray(request.items) ? request.items : []
  const isOwnRequest = currentUserId
    && String(request.requestedBy).toLowerCase() === String(currentUserId).toLowerCase()
  const showCancelAction = request.status === 'pending'
    && canCancel
    && (canCancelAny || isOwnRequest || activeTab === 'mine')
  const requestStatusPresentation = getAdjustmentRequestStatusPresentation(request)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xl font-bold text-[#356647]">{request.requestCode}</p>
          <p className="mt-1 text-sm text-slate-500">
            {items.length || request.itemCount || 0} sản phẩm · gửi {formatVietnamDateTime(request.requestedAt)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${requestStatusPresentation.className}`}>
          {requestStatusPresentation.label}
        </span>
      </div>

      <div className="rounded-xl border border-[#cfe0d4] bg-[#f0f7f2] px-4 py-3 text-sm text-[#285239]">
        <p className="font-semibold">Mỗi sản phẩm được xử lý đủ một lần.</p>
        <p className="mt-1 text-xs leading-5">
          Nếu Kho đủ Thành phẩm, hệ thống chuẩn bị điều chuyển nội bộ. Nếu thiếu Thành phẩm,
          hệ thống kiểm tra BOM và tự tạo Lệnh sản xuất khi đủ Nguyên liệu/Bao bì; nếu không đủ thì từ chối riêng sản phẩm đó.
          Tồn Kho/Kệ Hàng chỉ thay đổi khi Nhân viên kho xác nhận đã chuyển đủ hàng lên Kệ.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DetailField label="Lý do gửi" value={request.reason} />
        <DetailField
          label="Thời gian xử lý gần nhất"
          value={request.reviewedAt ? formatVietnamDateTime(request.reviewedAt) : '—'}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Sản phẩm</th>
              <th className="px-4 py-3 text-right">Số lượng yêu cầu</th>
              <th className="px-4 py-3 text-right">Tồn Kho</th>
              <th className="px-4 py-3">Trạng thái</th>
              {canReview ? <th className="px-4 py-3 text-right">Thao tác</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length > 0 ? items.map((item) => {
              const isReadyForTransferConfirmation = canReview
                && item.status === 'approved'
                && Number(item.remainingQuantity ?? 0) > 0
              const canProcess = !isReadyForTransferConfirmation
                && canReview
                && PROCESSABLE_LINE_STATUSES.has(item.status)
                && Number(item.remainingQuantity ?? 0) > 0
              const isProcessing = processingItemId === item.id
              return (
                <tr key={item.id ?? item.skuId ?? item.skuCode}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{item.skuSnapshotName || '—'}</p>
                    <p className="mt-0.5 font-mono text-xs font-bold text-[#356647]">{item.skuCode || '—'}</p>
                    {item.autoProductionOrderId ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Lệnh sản xuất tự động:{' '}
                        <Link to="/inventory/production-orders" className="font-semibold hover:underline">
                          {item.autoProductionOrderCode || 'Đã tạo'}
                        </Link>
                        {item.autoProductionOrderStatus
                          ? ` · ${PRODUCTION_STATUS_LABEL[item.autoProductionOrderStatus] || 'Đang xử lý'}`
                          : ''}
                      </p>
                    ) : null}
                    {item.reviewNote ? <p className="mt-1 text-xs text-slate-500">Ghi chú: {item.reviewNote}</p> : null}
                    {item.rejectionReason ? (
                      <p className="mt-1 text-xs text-rose-600">Lý do từ chối: {item.rejectionReason}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">
                    {formatStockQuantity(item.requestedQuantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {item.warehouseQuantityOnHand == null
                      ? '—'
                      : formatStockQuantity(item.warehouseQuantityOnHand)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getAdjustmentStatusClass(item.status)}`}>
                      {getAdjustmentLineStatusLabel(item.status)}
                    </span>
                  </td>
                  {canReview ? (
                    <td className="px-4 py-3 text-right">
                      {isReadyForTransferConfirmation ? (
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => onConfirmTransfer?.(request, item)}
                          className="rounded-lg bg-[#356647] px-3 py-2 text-xs font-bold text-white hover:bg-[#285239] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProcessing ? 'Đang xác nhận...' : 'Xác nhận đã chuyển đủ lên Kệ'}
                        </button>
                      ) : canProcess ? (
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => onProcessItem?.(request, item)}
                          className="rounded-lg bg-[#538463] px-3 py-2 text-xs font-bold text-white hover:bg-[#457053] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProcessing
                            ? 'Đang xử lý...'
                            : getProcessActionLabel(item)}
                        </button>
                      ) : <span className="text-xs text-slate-400">Không còn thao tác</span>}
                    </td>
                  ) : null}
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={canReview ? 5 : 4} className="px-4 py-6 text-center text-sm text-slate-500">
                  Chưa có sản phẩm trong yêu cầu này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCancelAction ? (
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => onCancel?.(request)}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Hủy yêu cầu
          </button>
        </div>
      ) : null}
    </div>
  )
}
