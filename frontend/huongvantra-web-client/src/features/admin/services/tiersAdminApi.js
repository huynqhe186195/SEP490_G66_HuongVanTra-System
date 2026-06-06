import { apiRequestAuth } from '../../../lib/apiClient.js'
import { mapMembershipTier } from '../../customers/utils/membershipTierUtils.js'

function mapTierAdminItem(item) {
  const base = mapMembershipTier({
    id: item.id ?? item.Id,
    tierCode: item.tierName ?? item.TierName,
    minTotalSpend: item.minSpendingThreshold ?? item.MinSpendingThreshold,
    discountPercent: item.discountPercent ?? item.DiscountPercent,
    isActive: true,
  })
  if (!base) return null
  return {
    ...base,
    customerCount: Number(item.customerCount ?? item.CustomerCount ?? 0),
  }
}

export async function fetchAdminMembershipTiers() {
  const items = await apiRequestAuth('/api/customer-tiers', { method: 'GET' })
  return Array.isArray(items) ? items.map(mapTierAdminItem).filter(Boolean) : []
}

export async function createAdminMembershipTier(payload) {
  const item = await apiRequestAuth('/api/customer-tiers', {
    method: 'POST',
    body: JSON.stringify({
      tierName: payload.tierCode ?? payload.tierName,
      minSpendingThreshold: Number(payload.minTotalSpend ?? payload.minSpendingThreshold ?? 0),
      discountPercent: Number(payload.discountPercent ?? 0),
      validityMonths: payload.validityMonths ?? null,
    }),
  })
  return mapTierAdminItem(item)
}

export async function updateAdminMembershipTier(id, payload) {
  const item = await apiRequestAuth(`/api/customer-tiers/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      tierName: payload.tierCode ?? payload.tierName,
      minSpendingThreshold: Number(payload.minTotalSpend ?? payload.minSpendingThreshold ?? 0),
      discountPercent: Number(payload.discountPercent ?? 0),
      validityMonths: payload.validityMonths ?? null,
    }),
  })
  return mapTierAdminItem(item)
}

export async function deactivateAdminMembershipTier(_id) {
  throw new Error('API chưa hỗ trợ vô hiệu hóa hạng thẻ.')
}

export async function reactivateAdminMembershipTier(_id) {
  throw new Error('API chưa hỗ trợ kích hoạt lại hạng thẻ.')
}
