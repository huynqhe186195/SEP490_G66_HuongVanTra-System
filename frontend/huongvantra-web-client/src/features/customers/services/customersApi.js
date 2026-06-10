import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import { DEFAULT_MEMBERSHIP_TIER, getMembershipTierLabel, isMemberTierCustomer } from '../utils/customerDisplay.js'

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

  const nestedTier = item.tier ?? item.Tier

  return {
    customerId: item.id ?? item.Id ?? item.customerId ?? item.CustomerId,
    customerCode: item.customerCode ?? item.CustomerCode ?? '',
    fullName: item.fullName ?? item.FullName ?? '',
    customerType: CUSTOMER_GROUP_TO_TYPE[normalizedGroup] ?? String(customerGroup).toUpperCase(),
    phone: item.phoneNumber ?? item.PhoneNumber ?? item.phone ?? item.Phone ?? '',
    email: item.email ?? item.Email ?? '',
    status: item.isDeleted ? 'INACTIVE' : 'ACTIVE',
    tierId: item.tierId ?? item.TierId ?? nestedTier?.id ?? nestedTier?.Id ?? null,
    tierCode: item.tierName ?? item.TierName ?? nestedTier?.tierName ?? nestedTier?.TierName ?? null,
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

function mapAddress(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    customerId: item.customerId ?? item.CustomerId,
    receiverName: item.receiverName ?? item.ReceiverName ?? '',
    receiverPhone: item.receiverPhone ?? item.ReceiverPhone ?? '',
    addressLine: item.addressLine ?? item.AddressLine ?? '',
    ward: item.ward ?? item.Ward ?? '',
    district: item.district ?? item.District ?? '',
    province: item.province ?? item.Province ?? '',
    isDefault: Boolean(item.isDefault ?? item.IsDefault),
  }
}

function mapDebtTransaction(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    customerId: item.customerId ?? item.CustomerId,
    type: item.type ?? item.Type ?? '',
    amount: Number(item.amount ?? item.Amount ?? 0),
    balanceAfter: Number(item.balanceAfter ?? item.BalanceAfter ?? 0),
    referenceType: item.referenceType ?? item.ReferenceType ?? null,
    referenceId: item.referenceId ?? item.ReferenceId ?? null,
    note: item.note ?? item.Note ?? '',
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
  }
}

function mapActivity(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    customerId: item.customerId ?? item.CustomerId,
    activityType: item.activityType ?? item.ActivityType ?? '',
    description: item.description ?? item.Description ?? '',
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
  }
}

export function mapCustomerDetail(item) {
  const base = mapCustomer(item)
  if (!base) return null

  const tier = item.tier ?? item.Tier
  const rawAddresses = item.addresses ?? item.Addresses ?? []
  const mappedAddresses = Array.isArray(rawAddresses) ? rawAddresses.map(mapAddress).filter(Boolean) : []
  const primaryAddress = mappedAddresses.find((entry) => entry.isDefault) ?? mappedAddresses[0]

  return {
    ...base,
    addresses: mappedAddresses,
    address: primaryAddress?.addressLine ?? item.address ?? item.Address ?? '',
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
    const keyword = params.keyword.trim().toLowerCase()
    const phoneKeyword = keyword.replace(/\D/g, '')
    result = result.filter((item) => {
      const name = (item.fullName || '').toLowerCase()
      const phone = (item.phone || '').replace(/\s+/g, '')
      return name.includes(keyword) || (phoneKeyword.length > 0 && phone.includes(phoneKeyword))
    })
  }

  if (params.customerType) {
    result = result.filter((item) => item.customerType === params.customerType)
  }

  if (params.tierCode) {
    const tierCode = params.tierCode.trim().toLowerCase()
    if (tierCode === DEFAULT_MEMBERSHIP_TIER.toLowerCase()) {
      result = result.filter((item) => isMemberTierCustomer(item))
    } else {
      result = result.filter((item) => getMembershipTierLabel(item).toLowerCase() === tierCode)
    }
  } else if (params.tierId) {
    result = result.filter((item) => String(item.tierId) === String(params.tierId))
  }

  if (params.debtFilter === 'with_debt') {
    result = result.filter((item) => Number(item.currentDebt) > 0)
  } else if (params.debtFilter === 'no_debt') {
    result = result.filter((item) => Number(item.currentDebt) <= 0)
  } else if (params.hasDebt) {
    result = result.filter((item) => item.currentDebt > 0)
  }

  if (params.sortBy === 'name') {
    result = [...result].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'vi'))
  } else if (params.sortBy === 'spend') {
    result = [...result].sort((a, b) => Number(b.totalSpend) - Number(a.totalSpend))
  } else if (params.sortBy === 'debt') {
    result = [...result].sort((a, b) => Number(b.currentDebt) - Number(a.currentDebt))
  }

  return result
}

export async function fetchInactiveCustomers(params = {}) {
  const pageSize = 100
  let page = 1
  let allItems = []
  let totalCount = 0

  do {
    const data = await apiRequestAuth(`/api/customers/inactive?page=${page}&pageSize=${pageSize}`, { method: 'GET' })
    const paged = toPagedResult(data)
    const batch = paged.items
      .map((item) => ({ ...mapCustomer(item), status: 'INACTIVE' }))
      .filter(Boolean)
    allItems = allItems.concat(batch)
    totalCount = paged.totalCount
    if (batch.length === 0) break
    page += 1
  } while (allItems.length < totalCount && page <= 20)

  return applyClientFilters(allItems, params)
}

export async function fetchCustomers(params = {}) {
  const pageSize = 100
  let page = 1
  let allItems = []
  let totalCount = 0

  do {
    const data = await apiRequestAuth(`/api/customers?page=${page}&pageSize=${pageSize}`, { method: 'GET' })
    const paged = toPagedResult(data)
    const batch = paged.items.map(mapCustomer).filter(Boolean)
    allItems = allItems.concat(batch)
    totalCount = paged.totalCount
    if (batch.length === 0) break
    page += 1
  } while (allItems.length < totalCount && page <= 20)

  return applyClientFilters(allItems, params)
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
    body: JSON.stringify(buildCreateCustomerBody(payload)),
  }).then(mapCustomerDetail)
}

export function updateCustomer(customerId, payload) {
  return apiRequestAuth(`/api/customers/${customerId}`, {
    method: 'PUT',
    body: JSON.stringify(buildUpdateCustomerBody(payload)),
  }).then(mapCustomerDetail)
}

export function mapTypeToCustomerGroup(customerType) {
  const normalized = String(customerType || '').toUpperCase()
  if (normalized === 'CORPORATE') return 'DoanhNghiep'
  if (normalized === 'VIP') return 'DoiNgoai'
  return 'PhoThong'
}

export function buildCreateCustomerBody(payload) {
  const addressLine = (payload.address ?? payload.addressLine ?? '').trim()
    || 'Chưa có địa chỉ giao hàng'
  return {
    fullName: payload.fullName,
    phoneNumber: payload.phone ?? payload.phoneNumber,
    email: payload.email?.trim() || null,
    addressLine,
    customerGroup: payload.customerGroup ?? mapTypeToCustomerGroup(payload.customerType),
    taxCode: payload.taxCode?.trim() || null,
    assignedSaleId: payload.assignedEmployeeId ?? payload.assignedSaleId ?? null,
  }
}

export function buildUpdateCustomerBody(payload) {
  const addressLine = (payload.address ?? payload.addressLine ?? '').trim()
    || 'Chưa có địa chỉ giao hàng'
  return {
    fullName: payload.fullName,
    phoneNumber: payload.phone ?? payload.phoneNumber,
    email: payload.email?.trim() || null,
    addressLine,
    customerGroup: payload.customerGroup ?? mapTypeToCustomerGroup(payload.customerType),
    taxCode: payload.taxCode?.trim() || null,
    assignedSaleId: payload.assignedEmployeeId ?? payload.assignedSaleId ?? null,
  }
}

export function deleteCustomer(customerId) {
  return apiRequestAuth(`/api/customers/${customerId}`, { method: 'DELETE' })
}

export function restoreCustomer(customerId) {
  return apiRequestAuth(`/api/customers/${customerId}/restore`, { method: 'POST' }).then(mapCustomer)
}

export async function fetchCustomerStatistics() {
  const data = await apiRequestAuth('/api/customers/statistics', { method: 'GET' })
  const byTier = data.customersByTier ?? data.CustomersByTier ?? []
  let topDebtors = (data.topDebtors ?? data.TopDebtors ?? []).map(mapCustomer).filter(Boolean)

  if (topDebtors.length === 0) {
    const withDebt = await fetchCustomersWithDebt()
    topDebtors = withDebt.slice(0, 5)
  }

  return {
    totalCustomers: Number(data.totalCustomers ?? data.TotalCustomers ?? 0),
    newCustomersThisMonth: Number(data.newCustomersThisMonth ?? data.NewCustomersThisMonth ?? 0),
    topSpenders: (data.topSpenders ?? data.TopSpenders ?? []).map(mapCustomer).filter(Boolean),
    topDebtors,
    customersByTier: Array.isArray(byTier)
      ? byTier.map((item) => ({
          tierName: item.tierName ?? item.TierName ?? '',
          count: Number(item.count ?? item.Count ?? 0),
        }))
      : [],
  }
}

export async function fetchCustomerDebts(customerId) {
  const data = await apiRequestAuth(`/api/customers/${customerId}/debts`, { method: 'GET' })
  return Array.isArray(data) ? data.map(mapDebtTransaction).filter(Boolean) : []
}

export async function fetchCustomerDebtSummary(customerId) {
  const data = await apiRequestAuth(`/api/customers/${customerId}/debt-summary`, { method: 'GET' })
  return {
    currentDebt: Number(data.currentDebt ?? data.CurrentDebt ?? 0),
    totalIncrease: Number(data.totalIncrease ?? data.TotalIncrease ?? 0),
    totalDecrease: Number(data.totalDecrease ?? data.TotalDecrease ?? 0),
    transactionCount: Number(data.transactionCount ?? data.TransactionCount ?? 0),
  }
}

export async function recordDebtTransaction(customerId, { type, amount, note }) {
  const data = await apiRequestAuth(`/api/customers/${customerId}/debts`, {
    method: 'POST',
    body: JSON.stringify({ type, amount, note }),
  })
  return mapDebtTransaction(data)
}

export async function fetchCustomerActivities(customerId) {
  const data = await apiRequestAuth(`/api/customers/${customerId}/activities`, { method: 'GET' })
  return Array.isArray(data) ? data.map(mapActivity).filter(Boolean) : []
}

export async function fetchMembershipTiers() {
  const data = await apiRequestAuth('/api/customer-tiers', { method: 'GET' })
  return Array.isArray(data)
    ? data.map((item) => ({
        id: item.id ?? item.Id,
        tierCode: item.tierName ?? item.TierName ?? '',
        minTotalSpend: Number(item.minSpendingThreshold ?? item.MinSpendingThreshold ?? 0),
        discountPercent: Number(item.discountPercent ?? item.DiscountPercent ?? 0),
        isActive: item.isActive ?? item.IsActive ?? true,
      }))
    : []
}

export async function fetchCustomerAddresses(customerId) {
  const data = await apiRequestAuth(`/api/customers/${customerId}/addresses`, { method: 'GET' })
  return Array.isArray(data) ? data.map(mapAddress).filter(Boolean) : []
}

export async function createCustomerAddress(customerId, payload) {
  const data = await apiRequestAuth(`/api/customers/${customerId}/addresses`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapAddress(data)
}

export function updateCustomerAddress(customerId, addressId, payload) {
  return apiRequestAuth(`/api/customers/${customerId}/addresses/${addressId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function updateAddressById(addressId, payload) {
  return apiRequestAuth(`/api/addresses/${addressId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteCustomerAddress(customerId, addressId) {
  return apiRequestAuth(`/api/customers/${customerId}/addresses/${addressId}`, {
    method: 'DELETE',
  })
}

export function deleteAddressById(addressId) {
  return apiRequestAuth(`/api/addresses/${addressId}`, { method: 'DELETE' })
}

export async function changeCustomerStatus(customerId, status) {
  const normalized = String(status).toUpperCase()
  if (normalized === 'INACTIVE') {
    await deleteCustomer(customerId)
    return { status: 'INACTIVE' }
  }
  if (normalized === 'ACTIVE') {
    await restoreCustomer(customerId)
    return { status: 'ACTIVE' }
  }
  throw new Error('Trạng thái khách hàng không hợp lệ.')
}

export async function reconcileCustomerDebt(customerId, amount) {
  const debtAmount =
    amount != null ? Number(amount) : Number((await fetchCustomerById(customerId)).currentDebt ?? 0)
  if (!debtAmount || debtAmount <= 0) {
    return null
  }
  return recordDebtTransaction(customerId, {
    type: 'DecreaseDebt',
    amount: debtAmount,
    note: 'Đối soát công nợ (Admin)',
  })
}

export async function upgradeCustomerTierManual(_payload) {
  throw new Error('Hạng thành viên không được phép chỉnh sửa.')
}
