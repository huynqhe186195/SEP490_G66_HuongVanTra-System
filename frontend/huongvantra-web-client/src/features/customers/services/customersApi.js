import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

const CUSTOMER_GROUP_TO_TYPE = {
  phothong: 'GENERAL',
  doingoai: 'VIP',
  doanhnghiep: 'CORPORATE',
}

function normalizeCustomerGroup(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function mapCustomer(item) {
  if (!item || typeof item !== 'object') return null

  const customerGroup = item.customerGroup ?? item.CustomerGroup ?? ''
  const normalizedGroup = normalizeCustomerGroup(customerGroup)

  return {
    customerId: item.id ?? item.Id ?? item.customerId ?? item.CustomerId,
    customerCode: item.phoneNumber ?? item.PhoneNumber ?? '',
    fullName: item.fullName ?? item.FullName ?? '',
    customerType: CUSTOMER_GROUP_TO_TYPE[normalizedGroup] ?? String(customerGroup).toUpperCase(),
    phone: item.phoneNumber ?? item.PhoneNumber ?? item.phone ?? item.Phone ?? '',
    email: item.email ?? item.Email ?? '',
    status: item.isDeleted ? 'INACTIVE' : 'ACTIVE',
    tierId: item.tierId ?? item.TierId ?? null,
    tierCode: item.tierName ?? item.TierName ?? null,
    tierDiscountPercent: 0,
    assignedEmployeeId: item.assignedSaleId ?? item.AssignedSaleId ?? null,
    assignedEmployeeName: null,
    totalSpend: Number(item.totalSpending ?? item.TotalSpending ?? item.totalSpend ?? item.TotalSpend ?? 0),
    currentDebt: Number(item.currentDebt ?? item.CurrentDebt ?? 0),
    taxCode: item.taxCode ?? item.TaxCode ?? '',
    tier: item.tier ?? item.Tier ?? null,
    address: item.address ?? item.Address ?? '',
  }
}

export function mapCustomerDetail(item) {
  const base = mapCustomer(item)
  if (!base) return null

  const tier = item.tier ?? item.Tier
  return {
    ...base,
    addresses: item.addresses ?? item.Addresses ?? [],
    tier: tier
      ? {
          tierId: tier.id ?? tier.Id,
          tierCode: tier.tierName ?? tier.TierName ?? '',
          minTotalSpend: Number(tier.minSpendingThreshold ?? tier.MinSpendingThreshold ?? 0),
          discountPercent: Number(tier.discountPercent ?? tier.DiscountPercent ?? 0),
        }
      : base.tier,
  }
}

function applyClientFilters(items, params = {}) {
  let result = items

  if (params.keyword) {
    const keyword = params.keyword.toLowerCase()
    result = result.filter(
      (item) =>
        item.fullName.toLowerCase().includes(keyword) ||
        item.phone.toLowerCase().includes(keyword),
    )
  }

  if (params.customerType) {
    result = result.filter((item) => item.customerType === params.customerType)
  }

  if (params.hasDebt) {
    result = result.filter((item) => item.currentDebt > 0)
  }

  if (params.sortBy === 'debt') {
    result = [...result].sort((a, b) => b.currentDebt - a.currentDebt)
  }

  return result
}

export async function fetchCustomers(params = {}) {
  const data = await apiRequestAuth('/api/customers?page=1&pageSize=500', { method: 'GET' })
  const paged = toPagedResult(data)
  return applyClientFilters(paged.items.map(mapCustomer).filter(Boolean), params)
}

export async function fetchCustomersWithDebt(params = {}) {
  return fetchCustomers({ ...params, hasDebt: true, sortBy: 'debt', sortOrder: 'desc' })
}

export async function fetchCustomerById(customerId) {
  const data = await apiRequestAuth(`/api/customers/${customerId}`, { method: 'GET' })
  return mapCustomerDetail(data)
}

export function createCustomer(payload) {
  return apiRequestAuth('/api/customers', {
    method: 'POST',
    body: JSON.stringify({
      fullName: payload.fullName,
      phoneNumber: payload.phone ?? payload.phoneNumber,
      customerGroup: payload.customerGroup ?? mapTypeToCustomerGroup(payload.customerType),
      taxCode: payload.taxCode ?? null,
      assignedSaleId: payload.assignedEmployeeId ?? payload.assignedSaleId ?? null,
    }),
  }).then(mapCustomerDetail)
}

export function updateCustomer(customerId, payload) {
  return apiRequestAuth(`/api/customers/${customerId}`, {
    method: 'PUT',
    body: JSON.stringify({
      fullName: payload.fullName,
      phoneNumber: payload.phone ?? payload.phoneNumber,
      customerGroup: payload.customerGroup ?? mapTypeToCustomerGroup(payload.customerType),
      taxCode: payload.taxCode ?? null,
      tierId: payload.tierId ?? null,
      assignedSaleId: payload.assignedEmployeeId ?? payload.assignedSaleId ?? null,
    }),
  }).then(mapCustomerDetail)
}

function mapTypeToCustomerGroup(customerType) {
  const normalized = String(customerType || '').toUpperCase()
  if (normalized === 'CORPORATE') return 'DoanhNghiep'
  if (normalized === 'VIP') return 'DoiNgoai'
  return 'PhoThong'
}

export async function fetchMembershipTiers() {
  const data = await apiRequestAuth('/api/customer-tiers', { method: 'GET' })
  return Array.isArray(data)
    ? data.map((item) => ({
        id: item.id ?? item.Id,
        tierCode: item.tierName ?? item.TierName ?? '',
        minTotalSpend: Number(item.minSpendingThreshold ?? item.MinSpendingThreshold ?? 0),
        discountPercent: Number(item.discountPercent ?? item.DiscountPercent ?? 0),
        isActive: true,
      }))
    : []
}

export function fetchCustomerAddresses(customerId) {
  return apiRequestAuth(`/api/customers/${customerId}/addresses`, { method: 'GET' })
}

export function createCustomerAddress(customerId, payload) {
  return apiRequestAuth(`/api/customers/${customerId}/addresses`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateCustomerAddress(customerId, addressId, payload) {
  return apiRequestAuth(`/api/customers/${customerId}/addresses/${addressId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteCustomerAddress(customerId, addressId) {
  return apiRequestAuth(`/api/customers/${customerId}/addresses/${addressId}`, {
    method: 'DELETE',
  })
}

export async function changeCustomerStatus(_customerId, _status) {
  throw new Error('API chưa hỗ trợ đổi trạng thái khách hàng.')
}

export async function reconcileCustomerDebt(_customerId) {
  throw new Error('API chưa hỗ trợ đối soát công nợ khách hàng.')
}

export async function upgradeCustomerTierManual(_payload) {
  throw new Error('API chưa hỗ trợ nâng hạng thủ công.')
}
