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
    minimumOrderAmount: Number(item.minimumOrderAmount ?? item.MinimumOrderAmount ?? 0),
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

  return Math.round((base * Math.min(100, Math.max(0, value))) / 100)
}

export function formatPromotionLabel(promotion) {
  if (!promotion) return ''
  const type = String(promotion.discountType || '').toUpperCase()
  if (type === 'FIXED') {
    return `${promotion.promoCode} (−${Number(promotion.discountValue).toLocaleString('vi-VN')} đ)`
  }
  return `${promotion.promoCode} (−${promotion.discountValue}%)`
}

export function formatPromotionScopeLabel(promotion) {
  return String(promotion?.scopeType || 'ORDER').toUpperCase() === 'SKU'
    ? 'SKU cụ thể'
    : 'Toàn đơn'
}

export function formatPromotionScopeSummary(promotion) {
  if (!promotion) return ''
  if (String(promotion.scopeType || 'ORDER').toUpperCase() !== 'SKU') {
    return 'Toàn đơn'
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
