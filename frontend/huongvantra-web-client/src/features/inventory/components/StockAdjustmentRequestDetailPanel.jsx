import { Link } from 'react-router-dom'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import {
  getAdjustmentLineStatusLabel,
  getAdjustmentStatusClass,
  getAdjustmentStatusLabel,
} from '../services/stockAdjustmentRequestApi.js'
import { getStockTransferStatusLabel, STOCK_FLOW_TERMS } from '../utils/stockFlowLabels.js'

const CLOSEABLE_STATUSES = ['approved', 'processing', 'partiallyfulfilled']

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  )
}

export default function StockAdjustmentRequestDetailPanel({
  request,
  relatedTransfers,
  canReview,
  canCancel,
  canCancelAny,
  currentUserId,
  activeTab,
  actingId,
  onReview,
  onReject,
  onCancel,
  onCloseRemaining,
}) {
  if (!request) {
    return <p className="text-sm text-slate-500">Chọn một yêu cầu để xem chi tiết.</p>
  }

  const items = Array.isArray(request.items) ? request.items : []
  const transfers = Array.isArray(relatedTransfers) ? relatedTransfers : []
  const isOwnRequest = currentUserId && String(request.requestedBy).toLowerCase() === String(currentUserId).toLowerCase()
  const showReviewActions = request.status === 'pending' && canReview && !isOwnRequest
  const showCancelAction = request.status === 'pending' && canCancel && (canCancelAny || isOwnRequest || activeTab === 'mine')
  const showCloseAction =
    canReview
    && CLOSEABLE_STATUSES.includes(request.status)
    && Number(request.totalRemainingQuantity ?? 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xl font-bold text-[#356647]">{request.requestCode}</p>
          <p className="mt-1 text-sm text-slate-500">
            {items.length || request.itemCount || 0} SKU · gửi {formatVietnamDateTime(request.requestedAt)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${getAdjustmentStatusClass(request.status)}`}
        >
          {getAdjustmentStatusLabel(request.status)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {STOCK_FLOW_TERMS.requestedQuantity}
          </p>
          <p className="mt-1 text-lg font-bold text-slate-800">
            {formatStockQuantity(request.totalRequestedQuantity ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-[#f0f7f2] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            {STOCK_FLOW_TERMS.fulfilledQuantity}
          </p>
          <p className="mt-1 text-lg font-bold text-emerald-800">
            {formatStockQuantity(request.totalFulfilledQuantity ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
            {STOCK_FLOW_TERMS.rejectedQuantity}
          </p>
          <p className="mt-1 text-lg font-bold text-rose-800">
            {formatStockQuantity(request.totalRejectedQuantity ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            {STOCK_FLOW_TERMS.remainingQuantity}
          </p>
          <p className="mt-1 text-lg font-bold text-amber-800">
            {formatStockQuantity(request.totalRemainingQuantity ?? 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DetailField label="Nơi cấp hàng" value={STOCK_FLOW_TERMS.warehouse} />
        <DetailField label="Nơi nhận hàng" value={STOCK_FLOW_TERMS.shelf} />
        <DetailField label="Lý do gửi" value={request.reason} />
        <DetailField
          label="Thời gian duyệt"
          value={request.reviewedAt ? formatVietnamDateTime(request.reviewedAt) : '—'}
        />
        {request.reviewNote ? (
          <div className="sm:col-span-2">
            <DetailField label="Ghi chú duyệt" value={request.reviewNote} />
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Sản phẩm</th>
              <th className="px-4 py-3 text-right">{STOCK_FLOW_TERMS.requestedQuantity}</th>
              <th className="px-4 py-3 text-right">{STOCK_FLOW_TERMS.approvedQuantity}</th>
              <th className="px-4 py-3 text-right">{STOCK_FLOW_TERMS.fulfilledQuantity}</th>
              <th className="px-4 py-3 text-right">{STOCK_FLOW_TERMS.rejectedQuantity}</th>
              <th className="px-4 py-3 text-right">{STOCK_FLOW_TERMS.remainingQuantity}</th>
              <th className="px-4 py-3">Trạng thái dòng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length > 0 ? (
              items.map((item) => (
                <tr key={item.id ?? item.skuId ?? item.skuCode}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{item.skuSnapshotName || '—'}</p>
                    <p className="mt-0.5 font-mono text-xs font-bold text-[#356647]">{item.skuCode || '—'}</p>
                    {item.reviewNote ? (
                      <p className="mt-1 text-xs text-slate-500">Ghi chú: {item.reviewNote}</p>
                    ) : null}
                    {item.rejectionReason ? (
                      <p className="mt-1 text-xs text-rose-600">Lý do từ chối: {item.rejectionReason}</p>
                    ) : null}
                    {item.closedReason ? (
                      <p className="mt-1 text-xs text-slate-600">Lý do đóng phần còn lại: {item.closedReason}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">
                    {formatStockQuantity(item.requestedQuantity)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatStockQuantity(item.approvedQuantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {formatStockQuantity(item.fulfilledQuantity)}
                  </td>
                  <td className="px-4 py-3 text-right text-rose-700">
                    {formatStockQuantity(item.rejectedQuantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-700">
                    {formatStockQuantity(item.remainingQuantity)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getAdjustmentStatusClass(item.status)}`}
                    >
                      {getAdjustmentLineStatusLabel(item.status)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                  Chưa có dòng SKU trong yêu cầu này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            {STOCK_FLOW_TERMS.transfer} liên quan
          </p>
          <Link to={`/inventory/stock-transfers?sourceRequestId=${request.id}`} className="text-xs font-semibold text-[#356647] hover:underline">
            Mở danh sách phiếu điều chuyển
          </Link>
        </div>
        {transfers.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {transfers.map((transfer) => (
              <li key={transfer.transferId} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm font-bold text-[#356647]">{transfer.transferCode}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getAdjustmentStatusClass(transfer.status)}`}
                  >
                    {getStockTransferStatusLabel(transfer.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {STOCK_FLOW_TERMS.transferQuantity}: {formatStockQuantity(transfer.totalQuantity)}
                  {' · tạo '}
                  {formatVietnamDateTime(transfer.createdAt)}
                  {transfer.completedAt ? ` · hoàn tất ${formatVietnamDateTime(transfer.completedAt)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-sm text-slate-500">
            Chưa có phiếu điều chuyển nào từ yêu cầu này. Một yêu cầu có thể được đáp ứng bằng nhiều phiếu điều chuyển.
          </p>
        )}
      </div>

      {showReviewActions || showCancelAction || showCloseAction ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          {showReviewActions ? (
            <>
              <button
                type="button"
                disabled={actingId === request.id}
                onClick={() => onReview?.(request)}
                className="rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
              >
                Duyệt theo dòng
              </button>
              <button
                type="button"
                disabled={actingId === request.id}
                onClick={() => onReject?.(request)}
                className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Từ chối
              </button>
            </>
          ) : null}
          {showCloseAction ? (
            <button
              type="button"
              disabled={actingId === request.id}
              onClick={() => onCloseRemaining?.(request)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Đóng phần còn lại
            </button>
          ) : null}
          {showCancelAction ? (
            <button
              type="button"
              disabled={actingId === request.id}
              onClick={() => onCancel?.(request)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy yêu cầu
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
