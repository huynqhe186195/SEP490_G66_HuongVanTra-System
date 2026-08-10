/** Chuẩn hóa hạng từ API /api/customer/tiers */
export function mapMembershipTier(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    tierCode: item.tierCode ?? item.TierCode ?? '',
    minTotalSpend: Number(item.minTotalSpend ?? item.MinTotalSpend ?? 0),
    discountPercent: Number(item.discountPercent ?? item.DiscountPercent ?? 0),
    isActive: item.isActive ?? item.IsActive ?? true,
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

export function normalizeTierNameInput(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export const TIER_READONLY_HINT =
  'Hạng thành viên do hệ thống quản lý theo chi tiêu tích lũy — không chỉnh sửa tại hồ sơ khách.'

/** Danh sách mã hạng từ API (đã sort theo ngưỡng chi tiêu). */
export function getMembershipTierCodes(tiers) {
  return sortTiersAsc(tiers)
    .map((tier) => String(tier.tierCode || '').trim())
    .filter(Boolean)
}

/** Nhãn badge theo tier thực tế (vd. "Hạng Member / Silver / Gold"). */
export function formatMembershipTiersBadge(tiers) {
  const codes = getMembershipTierCodes(tiers)
  if (!codes.length) return 'Hạng thành viên'
  return `Hạng ${codes.join(' / ')}`
}

/**
 * Notice cho KH không dùng hạng thành viên (VIP / doanh nghiệp).
 * Có tiers → nhắc tên hạng thực tế; không có → câu đơn giản.
 */
export function formatNonMembershipTierNotice(tiers) {
  const codes = getMembershipTierCodes(tiers)
  if (!codes.length) {
    return 'Không áp dụng hạng thành viên · chiết khấu thủ công trên đơn'
  }
  return `Không dùng hạng ${codes.join(' / ')} · chiết khấu thủ công trên đơn`
}

/** Bản ngắn cho badge header danh sách. */
export const NON_MEMBERSHIP_TIER_NOTICE = 'Không áp dụng hạng thành viên · chiết khấu thủ công trên đơn'