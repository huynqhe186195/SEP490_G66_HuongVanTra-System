export function mapPromotion(item) {
  if (!item || typeof item !== 'object') return null
  const rawSkuScopes = item.skuScopes ?? item.SkuScopes ?? []
  const skuScopes = Array.isArray(rawSkuScopes)
    ? rawSkuScopes
        .map((scope) => ({
          skuId: scope.skuId ?? scope.SkuId ?? '',
          skuCode: scope.skuCode ?? scope.SkuCode ?? '',
          skuName: scope.skuName ?? scope.SkuName ?? scope.skuSnapshotName ?? scope.SkuSnapshotName ?? '',
        }))
        .filter((scope) => scope.skuId)
    : []

  return {
    id: item.id ?? item.Id,
    promoCode: item.promoCode ?? item.PromoCode ?? '',
    discountType: String(item.discountType ?? item.DiscountType ?? 'PERCENTAGE').toUpperCase(),
    discountValue: Number(item.discountValue ?? item.DiscountValue ?? 0),
    maxDiscountAmount: item.maxDiscountAmount ?? item.MaxDiscountAmount ?? null,
    minimumOrderAmount: Number(item.minimumOrderAmount ?? item.MinimumOrderAmount ?? 0),
    usageLimitTotal: item.usageLimitTotal ?? item.UsageLimitTotal ?? null,
    usageLimitPerCustomer: item.usageLimitPerCustomer ?? item.UsageLimitPerCustomer ?? null,
    usedCountTotal: Number(item.usedCountTotal ?? item.UsedCountTotal ?? 0),
    remainingUsageTotal: item.remainingUsageTotal ?? item.RemainingUsageTotal ?? null,
    validFromUtc: item.validFromUtc ?? item.ValidFromUtc ?? null,
    validToUtc: item.validToUtc ?? item.ValidToUtc ?? null,
    validityStatus: item.validityStatus ?? item.ValidityStatus ?? null,
    isActive: item.isActive ?? item.IsActive ?? true,
    scopeType: String(item.scopeType ?? item.ScopeType ?? 'ORDER').toUpperCase(),
    skuScopes,
    promotionDiscountAmount:
      item.promotionDiscountAmount ?? item.PromotionDiscountAmount ?? null,
    eligibleSubtotal: item.eligibleSubtotal ?? item.EligibleSubtotal ?? null,
    message: item.message ?? item.Message ?? null,
  }
}

/** CK m├ú ÔÇö ├íp sau CK thß╗º c├┤ng/─æãín (khß╗øp PosOrderService). */
export function computeCouponDiscount(afterManualDiscount, promotion) {
  const base = Math.max(0, Math.round(Number(afterManualDiscount) || 0))
  if (!promotion || base <= 0) return 0

  if (promotion.promotionDiscountAmount !== null && promotion.promotionDiscountAmount !== undefined) {
    const previewAmount = Number(promotion.promotionDiscountAmount)
    if (Number.isFinite(previewAmount)) {
      return Math.min(Math.max(0, Math.round(previewAmount)), base)
    }
  }

  const type = String(promotion.discountType || '').toUpperCase()
  const value = Number(promotion.discountValue) || 0

  if (type === 'FIXED') {
    return Math.min(Math.round(value), base)
  }

  const raw = (base * Math.min(100, Math.max(0, value))) / 100
  const maxDiscountAmount = Number(promotion.maxDiscountAmount || 0)
  const capped = maxDiscountAmount > 0 ? Math.min(raw, maxDiscountAmount) : raw
  const rounded = Math.round(capped / 1000) * 1000
  return Math.min(rounded, maxDiscountAmount > 0 ? maxDiscountAmount : rounded, base)
}

export function formatPromotionLabel(promotion) {
  if (!promotion) return ''
  return `${promotion.promoCode} (${formatPromotionDiscountText(promotion)})`
}

export function formatPromotionDiscountText(promotion) {
  if (!promotion) return ''
  const type = String(promotion.discountType || '').toUpperCase()
  if (type === 'FIXED') {
    return `Giß║úm ${Number(promotion.discountValue || 0).toLocaleString('vi-VN')}─æ`
  }

  const maxDiscountAmount = Number(promotion.maxDiscountAmount || 0)
  if (maxDiscountAmount > 0) {
    return `Giß║úm ${promotion.discountValue}% - tß╗æi ─æa ${maxDiscountAmount.toLocaleString('vi-VN')}─æ`
  }

  return `Giß║úm ${promotion.discountValue}% - chã░a cß║Ñu h├¼nh giß║úm tß╗æi ─æa`
}

export function formatPromotionScopeLabel(promotion) {
  return String(promotion?.scopeType || 'ORDER').toUpperCase() === 'SKU'
    ? 'SKU cß╗Ñ thß╗â'
    : 'To├án ─æãín'
}

export function formatPromotionScopeSummary(promotion) {
  if (!promotion) return ''
  if (String(promotion.scopeType || 'ORDER').toUpperCase() !== 'SKU') {
    return 'To├án ─æãín'
  }

  const scopes = Array.isArray(promotion.skuScopes) ? promotion.skuScopes : []
  if (!scopes.length) return 'SKU cß╗Ñ thß╗â'

  return `SKU: ${scopes
    .map((scope) => scope.skuCode || scope.skuName || scope.skuId)
    .filter(Boolean)
    .join(', ')}`
}

export function formatPromotionMinimumOrderText(promotion) {
  const amount = Number(promotion?.minimumOrderAmount || 0)
  if (amount <= 0) return ''
  return `─Éãín tß╗æi thiß╗âu: ${amount.toLocaleString('vi-VN')}─æ`
}

export function formatPromotionUsageText(promotion) {
  if (!promotion) return ''
  const parts = []
  const totalLimit = Number(promotion.usageLimitTotal || 0)
  if (totalLimit > 0) {
    const remaining = Number(promotion.remainingUsageTotal ?? Math.max(0, totalLimit - Number(promotion.usedCountTotal || 0)))
    parts.push(`C├▓n ${Math.max(0, remaining).toLocaleString('vi-VN')} lã░ß╗út`)
  }

  const perCustomer = Number(promotion.usageLimitPerCustomer || 0)
  if (perCustomer > 0) {
    parts.push(`Mß╗ùi kh├ích: ${perCustomer.toLocaleString('vi-VN')} lß║ºn`)
  }

  return parts.join(' - ')
}

export const PROMOTION_VALIDITY_LABELS = {
  active: 'C├▓n hiß╗çu lß╗▒c',
  not_started: 'Chã░a bß║»t ─æß║ºu',
  expired: '─É├ú hß║┐t hß║ín',
  unlimited: 'Kh├┤ng giß╗øi hß║ín',
  deactivated: 'Ngß╗½ng hoß║ít ─æß╗Öng',
}

export function getPromotionValidityLabel(status) {
  if (!status) return PROMOTION_VALIDITY_LABELS.unlimited
  return PROMOTION_VALIDITY_LABELS[status] ?? status
}
