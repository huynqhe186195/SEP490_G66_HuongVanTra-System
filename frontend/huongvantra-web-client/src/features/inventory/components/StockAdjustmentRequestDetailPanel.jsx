import { Link, useNavigate } from 'react-router-dom'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { getAdjustmentStatusClass, getAdjustmentStatusLabel } from '../services/stockAdjustmentRequestApi.js'

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  )
}

function formatDelta(delta) {
  const value = Number(delta)
  if (!Number.isFinite(value)) return '—'
  if (value > 0) return `+${formatStockQuantity(value)}`
  return formatStockQuantity(value)
}

export default function StockAdjustmentRequestDetailPanel({
  request,
  canReview,
  activeTab,
  actingId,
  onApprove,
  onReject,
  onCancel,
}) {
  const navigate = useNavigate()

  if (!request) {
    return <p className="text-sm text-slate-500">Chọn một yêu cầu để xem chi tiết lô.</p>
  }

  const showReviewActions = request.status === 'pending' && canReview && activeTab !== 'mine'
  const showCancelAction = request.status === 'pending' && activeTab === 'mine'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xl font-bold text-[#356647]">{request.requestCode}</p>
          <p className="mt-1 text-sm text-slate-500">
            {request.itemCount} SKU · gửi {formatVietnamDateTime(request.requestedAt)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${getAdjustmentStatusClass(request.status)}`}
        >
          {getAdjustmentStatusLabel(request.status)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Thay đổi</th>
              <th className="px-4 py-3 text-right">Tồn CH lúc gửi</th>
              <th className="px-4 py-3 text-right">Tồn CH sau duyệt</th>
              <th className="px-4 py-3 text-right">Kho tổng sau duyệt</th>
              <th className="px-4 py-3">Phiếu xuất</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {request.items.map((item) => (
              <tr key={item.id ?? item.skuId}>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs font-bold text-[#356647]">{item.skuCode}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.skuSnapshotName}</p>
                </td>
                <td
                  className={`px-4 py-3 text-right font-bold ${
                    item.quantityDelta > 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatDelta(item.quantityDelta)}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {formatStockQuantity(item.quantityOnHandSnapshot)}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {item.quantityOnHandAfter != null
                    ? formatStockQuantity(item.quantityOnHandAfter)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {item.warehouseQuantityOnHandAfter != null
                    ? formatStockQuantity(item.warehouseQuantityOnHandAfter)
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  {item.exportSlipCode ? (
                    <button
                      type="button"
                      className="font-semibold text-[#356647] hover:underline"
                      onClick={() =>
                        navigate('/inventory/export', { state: { search: item.exportSlipCode } })
                      }
                    >
                      {item.exportSlipCode}
                    </button>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showReviewActions || showCancelAction ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          {showReviewActions ? (
            <>
              <button
                type="button"
                disabled={actingId === request.id}
                onClick={() => onApprove?.(request.id)}
                className="rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
              >
                Duyệt lô
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
          {showCancelAction ? (
            <button
              type="button"
              disabled={actingId === request.id}
              onClick={() => onCancel?.(request.id)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy lô
            </button>
          ) : null}
        </div>
      ) : null}

      {request.exportSlipCodes?.length > 0 ? (
        <p className="text-xs text-slate-500">
          Xem tất cả phiếu xuất tại{' '}
          <Link to="/inventory/export" className="font-semibold text-[#356647] hover:underline">
            Phiếu xuất kho
          </Link>
          .
        </p>
      ) : null}
    </div>
  )
}
