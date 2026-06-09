import { apiRequestAuth } from '../../../lib/apiClient.js'
import { mapMembershipTier, normalizeTierNameInput } from '../../customers/utils/membershipTierUtils.js'

function mapTierAdminItem(item) {
  const base = mapMembershipTier({
    id: item.id ?? item.Id,
    tierCode: item.tierName ?? item.TierName,
    minTotalSpend: item.minSpendingThreshold ?? item.MinSpendingThreshold,
    discountPercent: item.discountPercent ?? item.DiscountPercent,
    isActive: item.isActive ?? item.IsActive ?? true,
  })
  if (!base) return null
  return {
    ...base,
    customerCount: Number(item.customerCount ?? item.CustomerCount ?? 0),
  }
}

export async function fetchAdminMembershipTiers() {
  const items = await apiRequestAuth('/api/customer-tiers?includeInactive=true', { method: 'GET' })
  return Array.isArray(items) ? items.map(mapTierAdminItem).filter(Boolean) : []
}

export async function createAdminMembershipTier(payload) {
  const item = await apiRequestAuth('/api/customer-tiers', {
    method: 'POST',
    body: JSON.stringify({
      tierName: normalizeTierNameInput(payload.tierCode ?? payload.tierName),
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
      tierName: normalizeTierNameInput(payload.tierCode ?? payload.tierName),
      minSpendingThreshold: Number(payload.minTotalSpend ?? payload.minSpendingThreshold ?? 0),
      discountPercent: Number(payload.discountPercent ?? 0),
      validityMonths: payload.validityMonths ?? null,
    }),
  })
  return mapTierAdminItem(item)
}

export async function deactivateAdminMembershipTier(id) {
  const item = await apiRequestAuth(`/api/customer-tiers/${id}/deactivate`, { method: 'POST' })
  return mapTierAdminItem(item)
}

export async function reactivateAdminMembershipTier(id) {
  const item = await apiRequestAuth(`/api/customer-tiers/${id}/reactivate`, { method: 'POST' })
  return mapTierAdminItem(item)
}
