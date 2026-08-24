import { apiRequestAuth } from '../../../lib/apiClient.js'

export function mapSupplier(row) {
  if (!row || typeof row !== 'object') return null
  return {
    id: row.id ?? row.Id,
    supplierCode: row.supplierCode ?? row.SupplierCode ?? '',
    name: row.name ?? row.Name ?? '',
    phone: row.phone ?? row.Phone ?? '',
    email: row.email ?? row.Email ?? '',
    address: row.address ?? row.Address ?? '',
    taxCode: row.taxCode ?? row.TaxCode ?? '',
    paymentTerms: row.paymentTerms ?? row.PaymentTerms ?? '',
    note: row.note ?? row.Note ?? '',
    isDeleted: row.isDeleted ?? row.IsDeleted ?? false,
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    updatedAt: row.updatedAt ?? row.UpdatedAt ?? null,
    totalReceiptCount: Number(row.totalReceiptCount ?? row.TotalReceiptCount ?? 0),
    totalReceiptValue: Number(row.totalReceiptValue ?? row.TotalReceiptValue ?? 0),
  }
}

export async function fetchSuppliers({ search, includeDeleted = false, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams()
  if (search?.trim()) params.set('search', search.trim())
  if (includeDeleted) params.set('includeDeleted', 'true')
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  const data = await apiRequestAuth(`/api/v1/inventory/suppliers?${params.toString()}`, { method: 'GET' })
  return {
    items: (data.items ?? data.Items ?? []).map(mapSupplier).filter(Boolean),
    page: Number(data.page ?? data.Page ?? page),
    pageSize: Number(data.pageSize ?? data.PageSize ?? pageSize),
    totalItems: Number(data.totalItems ?? data.TotalItems ?? 0),
    totalPages: Number(data.totalPages ?? data.TotalPages ?? 1),
  }
}

export async function fetchActiveSuppliers() {
  const data = await apiRequestAuth('/api/v1/inventory/suppliers/active', { method: 'GET' })
  return Array.isArray(data) ? data.map(mapSupplier).filter(Boolean) : []
}

export async function fetchSupplierById(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/suppliers/${id}`, { method: 'GET' })
  return mapSupplier(data)
}

export async function createSupplier(payload) {
  const data = await apiRequestAuth('/api/v1/inventory/suppliers', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name?.trim(),
      supplierCode: payload.supplierCode?.trim() || null,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      address: payload.address?.trim() || null,
      taxCode: payload.taxCode?.trim() || null,
      paymentTerms: payload.paymentTerms?.trim() || null,
      note: payload.note?.trim() || null,
    }),
  })
  return mapSupplier(data)
}

export async function updateSupplier(id, payload) {
  const data = await apiRequestAuth(`/api/v1/inventory/suppliers/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: payload.name?.trim(),
      supplierCode: payload.supplierCode?.trim() || null,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      address: payload.address?.trim() || null,
      taxCode: payload.taxCode?.trim() || null,
      paymentTerms: payload.paymentTerms?.trim() || null,
      note: payload.note?.trim() || null,
    }),
  })
  return mapSupplier(data)
}

export async function deleteSupplier(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/suppliers/${id}`, { method: 'DELETE' })
  return mapSupplier(data)
}

export async function restoreSupplier(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/suppliers/${id}/restore`, { method: 'POST' })
  return mapSupplier(data)
}
