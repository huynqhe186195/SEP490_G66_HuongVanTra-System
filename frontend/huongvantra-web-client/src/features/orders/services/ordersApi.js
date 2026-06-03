import { loadAuthSession } from '../../auth/services/authSession.js'

const DEFAULT_API_BASE_URL = 'http://localhost:5249'

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
}

async function parseResponseError(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null)
    if (body && typeof body === 'object') {
      if (typeof body.message === 'string' && body.message.trim()) return body.message
      if (typeof body.detail === 'string' && body.detail.trim()) return body.detail
      if (typeof body.title === 'string' && body.title.trim()) return body.title
    }
  }

  const text = await response.text().catch(() => '')
  return text.trim() || 'Có lỗi xảy ra.'
}

async function requestWithAuth(path, options = {}) {
  const session = loadAuthSession()
  if (!session?.accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${session.accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await parseResponseError(response))
  }

  if (response.status === 204) return null
  return response.json()
}

export function mapOrderListItem(item) {
  return {
    id: item.id ?? item.Id,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    customerName: item.customerName ?? item.CustomerName ?? 'Khách lẻ',
    customerPhone: item.customerPhone ?? item.CustomerPhone ?? '',
    paymentMethod: item.paymentMethod ?? item.PaymentMethod ?? '',
    orderStatus: item.orderStatus ?? item.OrderStatus ?? '',
    paymentStatus: item.paymentStatus ?? item.PaymentStatus ?? '',
    shippingAddress: item.shippingAddress ?? item.ShippingAddress ?? '',
    totalAmount: Number(item.totalAmount ?? item.TotalAmount ?? 0),
    cashierId: item.cashierId ?? item.CashierId ?? null,
    cashierName: item.cashierName ?? item.CashierName ?? '',
    createdAt: item.createdAt ?? item.CreatedAt,
  }
}

export function mapOrderCreatorOption(item) {
  return {
    id: item.id ?? item.Id,
    fullName: item.fullName ?? item.FullName ?? '',
  }
}

export function mapOrderDetail(item) {
  return {
    id: item.id ?? item.Id,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    storeId: item.storeId ?? item.StoreId,
    customerId: item.customerId ?? item.CustomerId,
    customerName: item.customerName ?? item.CustomerName ?? 'Khách lẻ',
    customerPhone: item.customerPhone ?? item.CustomerPhone ?? '',
    cashierName: item.cashierName ?? item.CashierName ?? '',
    orderStatus: item.orderStatus ?? item.OrderStatus ?? '',
    paymentStatus: item.paymentStatus ?? item.PaymentStatus ?? '',
    paymentMethod: item.paymentMethod ?? item.PaymentMethod ?? '',
    shippingAddress: item.shippingAddress ?? item.ShippingAddress ?? '',
    stockStatus: item.stockStatus ?? item.StockStatus ?? '',
    subTotal: Number(item.subTotal ?? item.SubTotal ?? 0),
    couponDiscount: Number(item.couponDiscount ?? item.CouponDiscount ?? 0),
    manualDiscount: Number(item.manualDiscount ?? item.ManualDiscount ?? 0),
    deductAmount: Number(item.deductAmount ?? item.DeductAmount ?? 0),
    totalAmount: Number(item.totalAmount ?? item.TotalAmount ?? 0),
    notes: item.notes ?? item.Notes ?? '',
    createdAt: item.createdAt ?? item.CreatedAt,
    updatedAt: item.updatedAt ?? item.UpdatedAt,
    items: (item.items ?? item.Items ?? []).map((row) => ({
      id: row.id ?? row.Id,
      productId: row.productId ?? row.ProductId,
      productName: row.productName ?? row.ProductName ?? '',
      productSku: row.productSku ?? row.ProductSku ?? '',
      unitPrice: Number(row.unitPrice ?? row.UnitPrice ?? 0),
      quantity: Number(row.quantity ?? row.Quantity ?? 0),
      lineTotal: Number(row.lineTotal ?? row.LineTotal ?? 0),
      isGift: Boolean(row.isGift ?? row.IsGift),
    })),
    payments: (item.payments ?? item.Payments ?? []).map((row) => ({
      id: row.id ?? row.Id,
      paymentMethod: row.paymentMethod ?? row.PaymentMethod ?? '',
      amount: Number(row.amount ?? row.Amount ?? 0),
      transactionDate: row.transactionDate ?? row.TransactionDate,
    })),
    stockDeductQueue: item.stockDeductQueue ?? item.StockDeductQueue
      ? {
          id: (item.stockDeductQueue ?? item.StockDeductQueue).id ?? (item.stockDeductQueue ?? item.StockDeductQueue).Id,
          status: (item.stockDeductQueue ?? item.StockDeductQueue).status ?? (item.stockDeductQueue ?? item.StockDeductQueue).Status ?? '',
          createdAt: (item.stockDeductQueue ?? item.StockDeductQueue).createdAt ?? (item.stockDeductQueue ?? item.StockDeductQueue).CreatedAt,
        }
      : null,
  }
}

export function mapOverdueCodOrder(item) {
  return {
    orderId: item.orderId ?? item.OrderId,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    totalAmount: Number(item.totalAmount ?? item.TotalAmount ?? 0),
    paymentStatus: item.paymentStatus ?? item.PaymentStatus ?? '',
    orderStatus: item.orderStatus ?? item.OrderStatus ?? '',
    createdAt: item.createdAt ?? item.CreatedAt,
    lastRemindedAt: item.lastRemindedAt ?? item.LastRemindedAt ?? null,
    daysPending: Number(item.daysPending ?? item.DaysPending ?? 0),
  }
}

export async function fetchOrders(params = {}) {
  const query = new URLSearchParams()
  if (params.search?.trim()) query.set('search', params.search.trim())
  if (params.orderStatus) query.set('orderStatus', params.orderStatus)
  if (params.paymentStatus) query.set('paymentStatus', params.paymentStatus)
  if (params.paymentMethod) query.set('paymentMethod', params.paymentMethod)
  if (params.cashierId) query.set('cashierId', String(params.cashierId))
  if (params.fromDate) query.set('fromDate', params.fromDate)
  if (params.toDate) query.set('toDate', params.toDate)
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 10))

  const data = await requestWithAuth(`/api/Orders?${query.toString()}`, { method: 'GET' })
  const items = data?.items ?? data?.Items ?? []

  return {
    items: Array.isArray(items) ? items.map(mapOrderListItem) : [],
    totalCount: Number(data?.totalCount ?? data?.TotalCount ?? 0),
    page: Number(data?.page ?? data?.Page ?? 1),
    pageSize: Number(data?.pageSize ?? data?.PageSize ?? 10),
  }
}

export function fetchOrder(idOrCode) {
  return requestWithAuth(`/api/Orders/${encodeURIComponent(idOrCode)}`, { method: 'GET' }).then(mapOrderDetail)
}

export async function fetchOrderCreators() {
  const items = await requestWithAuth('/api/Orders/creators', { method: 'GET' })
  return Array.isArray(items) ? items.map(mapOrderCreatorOption) : []
}

export async function fetchOrderAccess() {
  const data = await requestWithAuth('/api/Orders/access', { method: 'GET' })
  return {
    mode: data?.mode ?? data?.Mode ?? 'All',
    canEdit: Boolean(data?.canEdit ?? data?.CanEdit ?? true),
    storeId: data?.storeId ?? data?.StoreId ?? null,
    employeeId: data?.employeeId ?? data?.EmployeeId ?? null,
  }
}

export async function fetchOverdueCodOrders() {
  const items = await requestWithAuth('/api/online-orders/cod/overdue', { method: 'GET' })
  return Array.isArray(items) ? items.map(mapOverdueCodOrder) : []
}

export function confirmCodCompleted(orderId) {
  return requestWithAuth(`/api/online-orders/${orderId}/cod/confirm-completed`, {
    method: 'PATCH',
  })
}

export function markCodReminded(orderId) {
  return requestWithAuth(`/api/online-orders/${orderId}/cod/mark-reminded`, {
    method: 'PATCH',
  })
}

export function rejectCodOrder(orderId, reason) {
  return requestWithAuth(`/api/online-orders/${orderId}/cod/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
}

export function updateOrderStatus(orderId, payload) {
  return requestWithAuth(`/api/Orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderStatus: payload.orderStatus,
      paymentStatus: payload.paymentStatus || undefined,
      stockStatus: payload.stockStatus || undefined,
    }),
  }).then(mapOrderDetail)
}

export function mapOrderPaymentQr(item) {
  return {
    orderId: item.orderId ?? item.OrderId,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    totalAmount: Number(item.totalAmount ?? item.TotalAmount ?? 0),
    paymentMethod: item.paymentMethod ?? item.PaymentMethod ?? '',
    qrPayload: item.qrPayload ?? item.QrPayload ?? '',
    qrImageUrl: item.qrImageUrl ?? item.QrImageUrl ?? '',
    transferContent: item.transferContent ?? item.TransferContent ?? '',
    transferAccountNumber: item.transferAccountNumber ?? item.TransferAccountNumber ?? '',
    paymentMode: item.paymentMode ?? item.PaymentMode ?? '',
    reusedExistingVa: Boolean(item.reusedExistingVa ?? item.ReusedExistingVa),
    createdNewVa: Boolean(item.createdNewVa ?? item.CreatedNewVa),
    hint: item.hint ?? item.Hint ?? '',
    qrExpiresAtUtc: item.qrExpiresAtUtc ?? item.QrExpiresAtUtc ?? null,
  }
}

export function fetchOrderPaymentQr(orderId, { force = false } = {}) {
  const query = force ? '?force=true' : ''
  return requestWithAuth(`/api/Orders/${orderId}/payment-qr${query}`, { method: 'GET' }).then(mapOrderPaymentQr)
}

export function mapOrderPaymentStatus(item) {
  return {
    orderId: item.orderId ?? item.OrderId,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    paymentStatus: item.paymentStatus ?? item.PaymentStatus ?? '',
    orderStatus: item.orderStatus ?? item.OrderStatus ?? '',
    isPaid: Boolean(item.isPaid ?? item.IsPaid),
    invoiceCode: item.invoiceCode ?? item.InvoiceCode ?? null,
    expectedTransferContent: item.expectedTransferContent ?? item.ExpectedTransferContent ?? null,
    expectedAmount: Number(item.expectedAmount ?? item.ExpectedAmount ?? 0),
  }
}

export function fetchOrderPaymentStatus(orderId) {
  return requestWithAuth(`/api/Orders/${orderId}/payment-status`, { method: 'GET' }).then(mapOrderPaymentStatus)
}

export function updateOrderItems(orderId, items) {
  return requestWithAuth(`/api/Orders/${orderId}/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: items.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        isGift: line.isGift ? 1 : 0,
      })),
    }),
  }).then(mapOrderDetail)
}

export function updateOrderAdjustments(orderId, payload) {
  return requestWithAuth(`/api/Orders/${orderId}/adjustments`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      manualDiscount: payload.manualDiscount,
      deductAmount: payload.deductAmount,
      notes: payload.notes,
      shippingAddress: payload.shippingAddress,
      requestStockDeduct: Boolean(payload.requestStockDeduct),
    }),
  }).then(mapOrderDetail)
}

export function confirmOrderPayment(orderId, payload = {}) {
  return requestWithAuth(`/api/Orders/${orderId}/confirm-payment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentReference: payload.paymentReference || undefined,
      note: payload.note || undefined,
    }),
  })
}

export function confirmOrderCod(orderId) {
  return requestWithAuth(`/api/Orders/${orderId}/confirm-cod`, {
    method: 'PATCH',
  })
}
