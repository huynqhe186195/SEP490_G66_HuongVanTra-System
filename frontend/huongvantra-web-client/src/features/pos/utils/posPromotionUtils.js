export function mapPromotion(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    promoCode: item.promoCode ?? item.PromoCode ?? '',
    discountType: String(item.discountType ?? item.DiscountType ?? 'PERCENTAGE').toUpperCase(),
    discountValue: Number(item.discountValue ?? item.DiscountValue ?? 0),
    validFromUtc: item.validFromUtc ?? item.ValidFromUtc ?? null,
    validToUtc: item.validToUtc ?? item.ValidToUtc ?? null,
    validityStatus: item.validityStatus ?? item.ValidityStatus ?? null,
    isActive: item.isActive ?? item.IsActive ?? true,
  }
}

/** CK mã — áp sau CK thủ công/đơn (khớp PosOrderService). */
export function computeCouponDiscount(afterManualDiscount, promotion) {
  const base = Math.max(0, Math.round(Number(afterManualDiscount) || 0))
  if (!promotion || base <= 0) return 0

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
