import { apiRequestAuth, downloadBlob, toPagedResult } from '../../../lib/apiClient.js'

export function mapLineItem(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    lineNumber: item.lineNumber ?? item.LineNumber ?? 0,
    skuId: item.skuId ?? item.SkuId,
    skuCode: item.skuCode ?? item.SkuCode ?? '',
    productName: item.productName ?? item.ProductName ?? '',
    unit: item.unit ?? item.Unit ?? null,
    quantity: Number(item.quantity ?? item.Quantity ?? 0),
    unitPrice: Number(item.unitPrice ?? item.UnitPrice ?? 0),
    lineAmount: Number(item.lineAmount ?? item.LineAmount ?? 0),
    note: item.note ?? item.Note ?? null,
  }
}

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
    signedAtLocation: item.signedAtLocation ?? item.SignedAtLocation ?? null,
    paymentMethod: item.paymentMethod ?? item.PaymentMethod ?? null,
    deliveryTerms: item.deliveryTerms ?? item.DeliveryTerms ?? null,
    shippingResponsibility: item.shippingResponsibility ?? item.ShippingResponsibility ?? null,
    lineItems: Array.isArray(item.lineItems ?? item.LineItems)
      ? (item.lineItems ?? item.LineItems).map(mapLineItem).filter(Boolean)
      : [],
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

export async function fetchActiveContractForCustomer(customerId) {
  if (!customerId) return null
  try {
    const data = await apiRequestAuth(`/api/contracts/active-for-customer/${customerId}`)
    return mapContract(data)
  } catch (err) {
    if (err?.statusCode === 404) return null
    throw err
  }
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

export async function exportContractDocx(id, contractCode) {
  const blob = await apiRequestAuth(`/api/contracts/${id}/export-docx`, { responseType: 'blob' })
  downloadBlob(blob, `HopDong_${contractCode || id}.docx`)
}

export async function exportContractPdf(id, contractCode) {
  const blob = await apiRequestAuth(`/api/contracts/${id}/export-pdf`, { responseType: 'blob' })
  downloadBlob(blob, `HopDong_${contractCode || id}.pdf`)
}

export async function importContractFromDocx(file) {
  const formData = new FormData()
  formData.append('file', file)

  const data = await apiRequestAuth('/api/contracts/import', {
    method: 'POST',
    body: formData,
    headers: {},
  })
  return data
}
