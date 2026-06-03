/** Chuẩn hóa hạng từ API /api/customer/tiers */
export function mapMembershipTier(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    tierCode: item.tierCode ?? item.TierCode ?? '',
    minTotalSpend: Number(item.minTotalSpend ?? item.MinTotalSpend ?? 0),
    discountPercent: Number(item.discountPercent ?? item.DiscountPercent ?? 0),
  }
}

export function sortTiersAsc(tiers) {
  return [...(tiers || [])].filter(Boolean).sort((a, b) => a.minTotalSpend - b.minTotalSpend)
}

/**
 * Tiến độ lên hạng kế tiếp (theo TotalSpend tích lũy — khớp PosOrder/OnlineOrder).
 */
export function computeTierProgress(totalSpend, tiers, currentTierId) {
  const sorted = sortTiersAsc(tiers)
  if (!sorted.length) {
    return {
      currentTier: null,
      nextTier: null,
      spend: Math.max(0, Number(totalSpend) || 0),
      percentToNext: 0,
      amountToNext: 0,
      isMaxTier: true,
    }
  }

  const spend = Math.max(0, Number(totalSpend) || 0)
  let current =
    sorted.find((t) => t.id === currentTierId) ??
    [...sorted].reverse().find((t) => spend >= t.minTotalSpend) ??
    sorted[0]

  const currentIndex = sorted.findIndex((t) => t.id === current.id)
  const next = currentIndex >= 0 && currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null

  if (!next) {
    return {
      currentTier: current,
      nextTier: null,
      spend,
      percentToNext: 100,
      amountToNext: 0,
      isMaxTier: true,
    }
  }

  const currentMin = current.minTotalSpend
  const nextMin = next.minTotalSpend
  const span = Math.max(1, nextMin - currentMin)
  const percentToNext = Math.min(100, Math.max(0, Math.round(((spend - currentMin) / span) * 100)))
  const amountToNext = Math.max(0, nextMin - spend)

  return {
    currentTier: current,
    nextTier: next,
    spend,
    percentToNext,
    amountToNext,
    isMaxTier: false,
  }
}

export const TIER_AUTO_UPGRADE_HINT =
  'Hạng tự động cập nhật khi tạo đơn POS/online (cộng tổng chi tiêu tích lũy). Hệ thống còn quét 24h/lần theo doanh số 12 tháng cho khách phổ thông.'
