import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'

export default function CustomerOpenDebtsPanel({
  openDebts = [],
  isLoading = false,
  formatMoney,
  allocationPreview = [],
  title = 'Hóa đơn / đơn chưa trả tiền',
  subtitle,
  highlightAllocations = false,
  compact = false,
}) {
  const allocationMap = useMemo(() => {
    const map = new Map()
    for (const row of allocationPreview) {
      map.set(row.orderId, row)
    }
    return map
  }, [allocationPreview])

  if (!isLoading && openDebts.length === 0) {
    return null
  }

  return (
    <div
      className={`rounded-xl border shadow-sm ${
        highlightAllocations
          ? 'border-[#356647]/30 bg-[#356647]/5'
          : 'border-[#7e5700]/25 bg-white'
      } ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className={`font-bold uppercase tracking-wider ${
              highlightAllocations ? 'text-[#356647]' : 'text-[#7e5700]'
            } ${compact ? 'text-[10px]' : 'text-xs'}`}
          >
            {title}
          </p>
          {subtitle ? (
            <p className={`mt-1 text-[#717971] ${compact ? 'text-[10px]' : 'text-xs'}`}>{subtitle}</p>
          ) : null}
        </div>
        {!isLoading ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
              highlightAllocations
                ? 'bg-[#356647]/15 text-[#356647]'
                : 'bg-[#fec25b]/25 text-[#7e5700]'
            } ${compact ? 'text-[10px]' : 'text-xs'}`}
          >
            {openDebts.length} đơn
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className={`mt-3 text-[#717971] ${compact ? 'text-xs' : 'text-sm'}`}>Đang tải đơn nợ...</p>
      ) : (
        <div className={`custom-scrollbar space-y-2 overflow-y-auto ${compact ? 'mt-2 max-h-36' : 'mt-3 max-h-48'}`}>
          {openDebts.map((row) => {
            const allocation = allocationMap.get(row.orderId)
            const isAllocated = Boolean(allocation)
            const isLinkedOrder = row.orderCode && !String(row.orderCode).startsWith('CN-')
            return (
              <div
                key={row.orderId}
                className={`rounded-lg border px-3 py-2.5 ${
                  isAllocated && highlightAllocations
                    ? 'border-[#356647]/40 bg-white'
                    : 'border-[#e4e3db] bg-[#fbf9f1]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`truncate font-bold text-[#1b1c17] ${compact ? 'text-xs' : 'text-sm'}`}>
                      {isLinkedOrder ? (
                        <Link to={`/orders/${row.orderId}`} className="hover:text-[#356647] hover:underline">
                          {row.orderCode}
                        </Link>
                      ) : (
                        row.orderCode
                      )}
                    </p>
                    {row.createdAt ? (
                      <p className={`text-[#717971] ${compact ? 'text-[10px]' : 'text-xs'}`}>
                        {formatVietnamDateTime(row.createdAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-[#7e5700] ${compact ? 'text-xs' : 'text-sm'}`}>
                      {formatMoney(row.remainingDebt)} đ
                    </p>
                    {!compact && row.originalDebt > row.remainingDebt ? (
                      <p className="text-[10px] text-[#717971]">
                        Gốc {formatMoney(row.originalDebt)} đ
                        {row.paidAmount > 0 ? ` · đã trả ${formatMoney(row.paidAmount)} đ` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>
                {isAllocated && highlightAllocations ? (
                  <p className={`mt-1.5 font-semibold text-[#356647] ${compact ? 'text-[10px]' : 'text-xs'}`}>
                    Sẽ trừ {formatMoney(allocation.amount)} đ
                    {allocation.remainingAfter > 0
                      ? ` · còn nợ ${formatMoney(allocation.remainingAfter)} đ`
                      : ' · hết nợ'}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
