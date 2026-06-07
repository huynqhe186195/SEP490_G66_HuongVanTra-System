import { useMemo } from 'react'
import { formatVnd, getTierClass } from '../utils/customerDisplay.js'
import { computeTierProgress } from '../utils/membershipTierUtils.js'

function MembershipTierProgress({
  totalSpend = 0,
  tierId = null,
  tierCode = '',
  tierDiscountPercent = 0,
  tiers = [],
  compact = false,
  showHint = true,
}) {
  const progress = useMemo(
    () => computeTierProgress(totalSpend, tiers, tierId),
    [totalSpend, tiers, tierId],
  )

  const displayCode = tierCode || progress.currentTier?.tierCode || '—'
  const discount =
    tierDiscountPercent > 0
      ? tierDiscountPercent
      : progress.currentTier?.discountPercent ?? 0

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight ${getTierClass(displayCode)}`}
        >
          {displayCode}
        </span>
        {discount > 0 ? (
          <span className="text-xs font-semibold text-[#356647]">Chiết khấu hạng: {discount}%</span>
        ) : null}
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-[#717971]">
          <span>Tổng chi tiêu tích lũy</span>
          <span className="font-semibold text-[#356647]">{formatVnd(progress.spend)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#e4e3db]">
          <div
            className="h-full rounded-full bg-[#356647] transition-all"
            style={{ width: `${progress.isMaxTier ? 100 : progress.percentToNext}%` }}
          />
        </div>
        {progress.isMaxTier ? (
          <p className="mt-1 text-xs text-[#356647]">Đã đạt hạng cao nhất trong hệ thống.</p>
        ) : (
          <p className="mt-1 text-xs text-[#717971]">
            Còn <span className="font-semibold text-[#7e5700]">{formatVnd(progress.amountToNext)}</span> để lên{' '}
            <span className="font-semibold">{progress.nextTier?.tierCode}</span>
            {progress.nextTier?.discountPercent > 0 ? ` (chiết khấu ${progress.nextTier.discountPercent}%)` : ''}
          </p>
        )}
      </div>

      {showHint && !compact ? (
        <p className="text-xs leading-relaxed text-[#717971]">
          Hạng được tính tự động theo ngưỡng chi tiêu; có thể gán tay khi tạo/sửa khách phổ thông.
        </p>
      ) : null}
    </div>
  )
}

export default MembershipTierProgress
