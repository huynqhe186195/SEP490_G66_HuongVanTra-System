import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function normalizeEnum(value) {
  return String(value || '').trim()
}

export function mapPayment(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    orderId: item.orderId ?? item.OrderId,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    customerSnapshotName: item.customerSnapshotName ?? item.CustomerSnapshotName ?? '',
    paymentMethod: normalizeEnum(item.paymentMethod ?? item.PaymentMethod),
    amount: Number(item.amount ?? item.Amount ?? 0),
    paymentStatus: normalizeEnum(item.paymentStatus ?? item.PaymentStatus),
    transactionRef: item.transactionRef ?? item.TransactionRef ?? '',
    isCodVerified: Boolean(item.isCodVerified ?? item.IsCodVerified),
    codWarningDate: item.codWarningDate ?? item.CodWarningDate ?? null,
    paidAt: item.paidAt ?? item.PaidAt ?? null,
  }
}

export function mapOrderItem(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    skuId: item.skuId ?? item.SkuId,
    skuSnapshotName: item.skuSnapshotName ?? item.SkuSnapshotName ?? '',
    skuSnapshotCode: item.skuSnapshotCode ?? item.SkuSnapshotCode ?? '',
    quantity: Number(item.quantity ?? item.Quantity ?? 0),
    unitPrice: Number(item.unitPrice ?? item.UnitPrice ?? 0),
    subTotal: Number(item.subTotal ?? item.SubTotal ?? 0),
  }
}

export function mapOrderSummary(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    customerId: item.customerId ?? item.CustomerId ?? null,
    customerSnapshotName: item.customerSnapshotName ?? item.CustomerSnapshotName ?? 'Khách lẻ',
    orderChannel: normalizeEnum(item.orderChannel ?? item.OrderChannel),
    orderStatus: normalizeEnum(item.orderStatus ?? item.OrderStatus),
    inventorySyncStatus: normalizeEnum(item.inventorySyncStatus ?? item.InventorySyncStatus),
    finalAmount: Number(item.finalAmount ?? item.FinalAmount ?? 0),
    createdAt: item.createdAt ?? item.CreatedAt,
  }
}

export function mapOrderDetail(item) {
  if (!item || typeof item !== 'object') return null
  const rawItems = item.items ?? item.Items ?? []
  const rawPayments = item.payments ?? item.Payments ?? []
  return {
    id: item.id ?? item.Id,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    customerId: item.customerId ?? item.CustomerId ?? null,
    customerSnapshotName: item.customerSnapshotName ?? item.CustomerSnapshotName ?? 'Khách lẻ',
    employeeId: item.employeeId ?? item.EmployeeId ?? null,
    orderChannel: normalizeEnum(item.orderChannel ?? item.OrderChannel),
    orderStatus: normalizeEnum(item.orderStatus ?? item.OrderStatus),
    inventorySyncStatus: normalizeEnum(item.inventorySyncStatus ?? item.InventorySyncStatus),
    totalAmount: Number(item.totalAmount ?? item.TotalAmount ?? 0),
    discountAmount: Number(item.discountAmount ?? item.DiscountAmount ?? 0),
    finalAmount: Number(item.finalAmount ?? item.FinalAmount ?? 0),
    shippingAddress: item.shippingAddress ?? item.ShippingAddress ?? '',
    note: item.note ?? item.Note ?? '',
    createdAt: item.createdAt ?? item.CreatedAt,
    updatedAt: item.updatedAt ?? item.UpdatedAt,
    items: Array.isArray(rawItems) ? rawItems.map(mapOrderItem).filter(Boolean) : [],
    payments: Array.isArray(rawPayments) ? rawPayments.map(mapPayment).filter(Boolean) : [],
  }
}

function buildOrdersQuery(params = {}) {
  const search = new URLSearchParams()
  if (params.search?.trim()) search.set('search', params.search.trim())
  if (params.customerId) search.set('customerId', String(params.customerId))
  if (params.status) search.set('status', params.status)
  if (params.channel) search.set('channel', params.channel)
  search.set('page', String(params.page ?? 1))
  search.set('pageSize', String(Math.min(100, Math.max(1, params.pageSize ?? 20))))
  return search.toString()
}

export async function fetchOrders(params = {}) {
  const data = await apiRequestAuth(`/api/v1/orders?${buildOrdersQuery(params)}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapOrderSummary).filter(Boolean),
    totalPages: Number(data?.totalPages ?? data?.TotalPages ?? (Math.ceil(paged.totalCount / paged.pageSize) || 1)),
  }
}

function mapOrderActivity(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    orderId: item.orderId ?? item.OrderId,
    activityType: normalizeEnum(item.activityType ?? item.ActivityType),
    description: item.description ?? item.Description ?? '',
    actorId: item.actorId ?? item.ActorId ?? null,
    actorName: item.actorName ?? item.ActorName ?? '',
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
  }
}

export async function fetchOrderActivities(orderId) {
  const data = await apiRequestAuth(`/api/v1/orders/${encodeURIComponent(orderId)}/activities`, {
    method: 'GET',
  })
  return Array.isArray(data) ? data.map(mapOrderActivity).filter(Boolean) : []
}

export async function fetchOrder(idOrCode) {
  const value = String(idOrCode || '').trim()
  const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  const path = isGuid
    ? `/api/v1/orders/${encodeURIComponent(value)}`
    : `/api/v1/orders/by-code/${encodeURIComponent(value)}`
  const data = await apiRequestAuth(path, { method: 'GET' })
  return mapOrderDetail(data)
}

export function buildCreateOrderBody(payload) {
  return {
    customerId: payload.customerId || null,
    customerSnapshotName: payload.customerSnapshotName?.trim() || null,
    employeeId: payload.employeeId || null,
    orderChannel: payload.orderChannel,
    shippingAddress: payload.shippingAddress?.trim() || null,
    note: payload.note?.trim() || null,
    discountAmount: Number(payload.discountAmount ?? 0),
    paidAmount: Number(payload.paidAmount ?? 0),
    transferQrAmount: Number(payload.transferQrAmount ?? 0),
    paymentMethod: payload.paymentMethod,
    items: (payload.items || []).map((line) => ({
      skuId: line.skuId,
      skuSnapshotName: line.skuSnapshotName,
      skuSnapshotCode: line.skuSnapshotCode || null,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
    })),
  }
}

export async function createOrder(payload) {
  const data = await apiRequestAuth('/api/v1/orders', {
    method: 'POST',
    body: JSON.stringify(buildCreateOrderBody(payload)),
  })
  return mapOrderDetail(data)
}

export async function updateOrder(id, payload) {
  const data = await apiRequestAuth(`/api/v1/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      shippingAddress: payload.shippingAddress?.trim() || null,
      note: payload.note?.trim() || null,
      discountAmount: Number(payload.discountAmount ?? 0),
    }),
  })
  return mapOrderDetail(data)
}

export async function cancelOrder(id, reason = '') {
  return apiRequestAuth(`/api/v1/orders/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
}

export async function shipOrder(id) {
  return apiRequestAuth(`/api/v1/orders/${id}/ship`, { method: 'POST' })
}

export async function completeOrder(id) {
  return apiRequestAuth(`/api/v1/orders/${id}/complete`, { method: 'POST' })
}

export async function fetchPaymentsByOrderId(orderId) {
  const data = await apiRequestAuth(`/api/v1/payments/orders/${orderId}`, { method: 'GET' })
  return Array.isArray(data) ? data.map(mapPayment).filter(Boolean) : []
}

export async function fetchUnverifiedCodPayments() {
  const data = await apiRequestAuth('/api/v1/payments/cod/unverified', { method: 'GET' })
  return Array.isArray(data) ? data.map(mapPayment).filter(Boolean) : []
}

export async function fetchOverdueCodPayments() {
  const data = await apiRequestAuth('/api/v1/payments/cod/pending', { method: 'GET' })
  return Array.isArray(data) ? data.map(mapPayment).filter(Boolean) : []
}

export async function verifyCodPayment(paymentId) {
  const data = await apiRequestAuth(`/api/v1/payments/${paymentId}/verify-cod`, {
    method: 'POST',
    body: JSON.stringify({ transactionRef: null }),
  })
  return mapPayment(data)
}
