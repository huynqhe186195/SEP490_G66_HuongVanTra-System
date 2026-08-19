/** Nhãn nghiệp vụ «Sản phẩm cá nhân» (trước đây gọi custom bundle). */
export const PERSONAL_PRODUCT_LABEL = 'Sản phẩm cá nhân'
export const PERSONAL_PRODUCT_SHORT = 'SP cá nhân'
export const PERSONAL_PRODUCT_SKU_CODE = 'SP-CA-NHAN'

export function isPersonalProductSkuCode(code) {
  const normalized = String(code || '').trim().toUpperCase()
  return normalized === PERSONAL_PRODUCT_SKU_CODE || normalized === 'CUSTOM-BUNDLE'
}
