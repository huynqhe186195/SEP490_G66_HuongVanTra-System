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
  const rawCategoryScopes = item.categoryScopes ?? item.CategoryScopes ?? []
  const categoryScopes = Array.isArray(rawCategoryScopes)
    ? rawCategoryScopes
        .map((scope) => ({
          categoryId: scope.categoryId ?? scope.CategoryId ?? null,
          categoryName:
            scope.categoryName ??
            scope.CategoryName ??
            scope.categorySnapshotName ??
            scope.CategorySnapshotName ??
            '',
        }))
        .filter((scope) => scope.categoryId !== null && scope.categoryId !== undefined)
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
    categoryScopes,
    promotionDiscountAmount:
      item.promotionDiscountAmount ?? item.PromotionDiscountAmount ?? null,
    eligibleSubtotal: item.eligibleSubtotal ?? item.EligibleSubtotal ?? null,
    estimatedDiscountAmount:
      item.estimatedDiscountAmount ?? item.EstimatedDiscountAmount ?? null,
    estimatedFinalTotal:
      item.estimatedFinalTotal ?? item.EstimatedFinalTotal ?? null,
    estimatedPayableAmount:
      item.estimatedPayableAmount ?? item.EstimatedPayableAmount ?? null,
    isBestSuggestion: Boolean(item.isBestSuggestion ?? item.IsBestSuggestion ?? false),
    message: item.message ?? item.Message ?? null,
  }
}

/** CK mã — áp sau CK thủ công/đơn (khớp PosOrderService). */
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
    return `Giảm ${Number(promotion.discountValue || 0).toLocaleString('vi-VN')}đ`
  }

  const maxDiscountAmount = Number(promotion.maxDiscountAmount || 0)
  if (maxDiscountAmount > 0) {
    return `Giảm ${promotion.discountValue}% - tối đa ${maxDiscountAmount.toLocaleString('vi-VN')}đ`
  }

  return `Giảm ${promotion.discountValue}% - chưa cấu hình giảm tối đa`
}

export function formatPromotionScopeLabel(promotion) {
  const scopeType = String(promotion?.scopeType || 'ORDER').toUpperCase()
  if (scopeType === 'SKU') return 'SKU cụ thể'
  if (scopeType === 'CATEGORY') return 'Theo danh mục'
  return 'Toàn đơn'
}

export function formatPromotionScopeSummary(promotion) {
  if (!promotion) return ''
  const scopeType = String(promotion.scopeType || 'ORDER').toUpperCase()
  if (scopeType === 'ORDER') {
    return 'Toàn đơn'
  }

  if (scopeType === 'CATEGORY') {
    const scopes = Array.isArray(promotion.categoryScopes) ? promotion.categoryScopes : []
    if (!scopes.length) return 'Theo danh mục'

    return `Danh mục: ${scopes
      .map((scope) => scope.categoryName || scope.categoryId)
      .filter(Boolean)
      .join(', ')}`
  }

  const scopes = Array.isArray(promotion.skuScopes) ? promotion.skuScopes : []
  if (!scopes.length) return 'SKU cụ thể'

  return `SKU: ${scopes
    .map((scope) => scope.skuCode || scope.skuName || scope.skuId)
    .filter(Boolean)
    .join(', ')}`
}

export function formatPromotionMinimumOrderText(promotion) {
  const amount = Number(promotion?.minimumOrderAmount || 0)
  if (amount <= 0) return ''
  return `Đơn tối thiểu: ${amount.toLocaleString('vi-VN')}đ`
}

export function formatPromotionUsageText(promotion) {
  if (!promotion) return ''
  const parts = []
  const totalLimit = Number(promotion.usageLimitTotal || 0)
  if (totalLimit > 0) {
    const remaining = Number(promotion.remainingUsageTotal ?? Math.max(0, totalLimit - Number(promotion.usedCountTotal || 0)))
    parts.push(`Còn ${Math.max(0, remaining).toLocaleString('vi-VN')} lượt`)
  }

  const perCustomer = Number(promotion.usageLimitPerCustomer || 0)
  if (perCustomer > 0) {
    parts.push(`Mỗi khách: ${perCustomer.toLocaleString('vi-VN')} lần`)
  }

  return parts.join(' - ')
}

export const PROMOTION_VALIDITY_LABELS = {
  active: 'Còn hiệu lực',
  not_started: 'Chưa bắt đầu',
  expired: 'Đã hết hạn',
  unlimited: 'Không giới hạn',
  deactivated: 'Ngừng hoạt động',
}

export function getPromotionValidityLabel(status) {
  if (!status) return PROMOTION_VALIDITY_LABELS.unlimited
  return PROMOTION_VALIDITY_LABELS[status] ?? status
}
