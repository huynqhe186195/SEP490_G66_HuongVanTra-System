import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

export function mapContract(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    contractCode: item.contractCode ?? item.ContractCode ?? '',
    customerId: item.customerId ?? item.CustomerId,
    customerName: item.customerName ?? item.CustomerName ?? '',
    customerCode: item.customerCode ?? item.CustomerCode ?? '',
    createdByUserId: item.createdByUserId ?? item.CreatedByUserId,
    title: item.title ?? item.Title ?? '',
    contractType: item.contractType ?? item.ContractType ?? '',
    status: item.status ?? item.Status ?? '',
    effectiveDate: item.effectiveDate ?? item.EffectiveDate ?? null,
    expiryDate: item.expiryDate ?? item.ExpiryDate ?? null,
    discountPercent: item.discountPercent ?? item.DiscountPercent ?? null,
    creditLimit: item.creditLimit ?? item.CreditLimit ?? null,
    paymentTermDays: item.paymentTermDays ?? item.PaymentTermDays ?? null,
    notes: item.notes ?? item.Notes ?? null,
    rejectionNote: item.rejectionNote ?? item.RejectionNote ?? null,
    submittedAt: item.submittedAt ?? item.SubmittedAt ?? null,
    reviewedAt: item.reviewedAt ?? item.ReviewedAt ?? null,
    createdAt: item.createdAt ?? item.CreatedAt,
    updatedAt: item.updatedAt ?? item.UpdatedAt,
  }
}

export async function fetchContracts({ search, customerId, status, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (customerId) params.set('customerId', customerId)
  if (status) params.set('status', status)
  params.set('page', page)
  params.set('pageSize', pageSize)

  const data = await apiRequestAuth(`/api/contracts?${params}`)
  const paged = toPagedResult(data)
  return { ...paged, items: paged.items.map(mapContract).filter(Boolean) }
}

export async function fetchContractById(id) {
  const data = await apiRequestAuth(`/api/contracts/${id}`)
  return mapContract(data)
}

export async function createContract(payload) {
  const data = await apiRequestAuth('/api/contracts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapContract(data)
}

export async function updateContract(id, payload) {
  const data = await apiRequestAuth(`/api/contracts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return mapContract(data)
}

export async function deleteContract(id) {
  await apiRequestAuth(`/api/contracts/${id}`, { method: 'DELETE' })
}

export async function submitContract(id) {
  const data = await apiRequestAuth(`/api/contracts/${id}/submit`, { method: 'POST' })
  return mapContract(data)
}

export async function reviewContract(id, approved, rejectionNote) {
  const data = await apiRequestAuth(`/api/contracts/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ approved, rejectionNote: rejectionNote ?? null }),
  })
  return mapContract(data)
}
