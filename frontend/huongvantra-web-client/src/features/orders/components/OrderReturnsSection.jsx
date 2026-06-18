import { Link } from 'react-router-dom'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatVnd } from '../utils/orderDisplay.js'

function OrderReturnsSection({ returns = [] }) {
  if (!returns.length) return null

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Phiếu trả hàng</h2>
        <Link to="/orders/exchange?tab=returns" className="text-xs font-semibold text-[#356647] hover:underline">
          Xem tất cả
        </Link>
      </div>
      <div className="space-y-2">
        {returns.map((item) => (
          <Link
            key={item.id}
            to={`/orders/returns/${item.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5 text-sm hover:bg-[#f6f4ec]"
          >
            <div>
              <p className="font-semibold text-slate-900">{item.returnCode}</p>
              <p className="text-xs text-slate-500">{formatVietnamDateTime(item.createdAt)}</p>
              {item.note?.trim() ? (
                <p className="mt-1 line-clamp-1 max-w-[320px] text-xs text-slate-500" title={item.note}>
                  {item.note}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="font-semibold text-[#356647]">{formatVnd(item.returnAmount)}</p>
              {item.refundAmount > 0 ? (
                <p className="text-xs text-amber-700">Hoàn {formatVnd(item.refundAmount)}</p>
              ) : null}
              {item.exchangeOrderCode ? (
                <p className="text-xs text-slate-500">Đổi: {item.exchangeOrderCode}</p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default OrderReturnsSection
