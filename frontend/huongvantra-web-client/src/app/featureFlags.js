/**
 * Công tắc tính năng — bật/tắt module chưa dùng mà không xóa code.
 * B2B / hợp đồng / khách doanh nghiệp: cắt khỏi phạm vi runtime (2026-08).
 * DocumentService không còn trong docker-compose / Gateway.
 */
export const B2B_CONTRACTS_ENABLED = false
export const CORPORATE_CUSTOMERS_ENABLED = false
