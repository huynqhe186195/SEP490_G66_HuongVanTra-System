import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import { mapCustomBundle } from './customBundleApi.js'

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
    codDebtSettlementJson: item.codDebtSettlementJson ?? item.CodDebtSettlementJson ?? null,
    paymentPurpose: normalizeEnum(item.paymentPurpose ?? item.PaymentPurpose ?? 'Full'),
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
    returnedQuantity: Number(item.returnedQuantity ?? item.ReturnedQuantity ?? 0),
    unitPrice: Number(item.unitPrice ?? item.UnitPrice ?? 0),
    subTotal: Number(item.subTotal ?? item.SubTotal ?? 0),
    isGift: Boolean(item.isGift ?? item.IsGift ?? false),
    immediateFulfilledQuantity: Number(item.immediateFulfilledQuantity ?? item.ImmediateFulfilledQuantity ?? 0),
    reservedFinishedQuantity: Number(item.reservedFinishedQuantity ?? item.ReservedFinishedQuantity ?? 0),
    backorderQuantity: Number(item.backorderQuantity ?? item.BackorderQuantity ?? 0),
  }
}

function mapStockHandlingLine(item) {
  if (!item || typeof item !== 'object') return null
  return {
    skuId: item.skuId ?? item.SkuId,
    skuCode: item.skuCode ?? item.SkuCode ?? '',
    skuName: item.skuName ?? item.SkuName ?? '',
    orderedQuantity: Number(item.orderedQuantity ?? item.OrderedQuantity ?? 0),
    finishedDeductedQuantity: Number(item.finishedDeductedQuantity ?? item.FinishedDeductedQuantity ?? 0),
    pendingBomQuantity: Number(item.pendingBomQuantity ?? item.PendingBomQuantity ?? 0),
    warehouseDeductedQuantity: Number(
      item.warehouseDeductedQuantity ?? item.WarehouseDeductedQuantity ?? 0,
    ),
  }
}

function mapStockHandlingSummary(item) {
  if (!item || typeof item !== 'object') return null
  return {
    hasPendingStockReconciliation: Boolean(
      item.hasPendingStockReconciliation ?? item.HasPendingStockReconciliation,
    ),
    stockHandlingMode: normalizeEnum(item.stockHandlingMode ?? item.StockHandlingMode),
    message: item.message ?? item.Message ?? '',
    lines: (item.lines ?? item.Lines ?? []).map(mapStockHandlingLine).filter(Boolean),
  }
}

export function mapOrderSummary(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    customerId: item.customerId ?? item.CustomerId ?? null,
    customerSnapshotName: item.customerSnapshotName ?? item.CustomerSnapshotName ?? 'Khách lẻ',
    employeeId: item.employeeId ?? item.EmployeeId ?? null,
    sellerName:
      item.employeeSnapshotName
      ?? item.EmployeeSnapshotName
      ?? item.sellerName
      ?? item.SellerName
      ?? '',
    orderChannel: normalizeEnum(item.orderChannel ?? item.OrderChannel),
    orderKind: normalizeEnum(item.orderKind ?? item.OrderKind ?? 'Sale'),
    orderStatus: normalizeEnum(item.orderStatus ?? item.OrderStatus),
    inventorySyncStatus: normalizeEnum(item.inventorySyncStatus ?? item.InventorySyncStatus),
    totalAmount: Number(item.totalAmount ?? item.TotalAmount ?? 0),
    discountAmount: Number(item.discountAmount ?? item.DiscountAmount ?? 0),
    totalQuantity: Number(item.totalQuantity ?? item.TotalQuantity ?? 0),
    finalAmount: Number(item.finalAmount ?? item.FinalAmount ?? 0),
    createdAt: item.createdAt ?? item.CreatedAt,
    note: item.note ?? item.Note ?? '',
    codPaymentId: item.codPaymentId ?? item.CodPaymentId ?? null,
    isCodVerified: item.isCodVerified ?? item.IsCodVerified ?? null,
    codWarningDate: item.codWarningDate ?? item.CodWarningDate ?? null,
    codExpectedAmount: Number(item.codExpectedAmount ?? item.CodExpectedAmount ?? 0) || null,
    hasActiveStockReservation: Boolean(
      item.hasActiveStockReservation ?? item.HasActiveStockReservation ?? false,
    ),
    pickupDate: item.pickupDate ?? item.PickupDate ?? null,
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
    sellerName:
      item.employeeSnapshotName
      ?? item.EmployeeSnapshotName
      ?? item.sellerName
      ?? item.SellerName
      ?? '',
    orderChannel: normalizeEnum(item.orderChannel ?? item.OrderChannel),
    orderKind: normalizeEnum(item.orderKind ?? item.OrderKind ?? 'Sale'),
    orderStatus: normalizeEnum(item.orderStatus ?? item.OrderStatus),
    inventorySyncStatus: normalizeEnum(item.inventorySyncStatus ?? item.InventorySyncStatus),
    totalAmount: Number(item.totalAmount ?? item.TotalAmount ?? 0),
    discountAmount: Number(item.discountAmount ?? item.DiscountAmount ?? 0),
    promotionId: item.promotionId ?? item.PromotionId ?? null,
    promotionCode: item.promotionCode ?? item.PromotionCode ?? '',
    promotionDiscountAmount: Number(item.promotionDiscountAmount ?? item.PromotionDiscountAmount ?? 0),
    finalAmount: Number(item.finalAmount ?? item.FinalAmount ?? 0),
    shippingAddress: item.shippingAddress ?? item.ShippingAddress ?? '',
    note: item.note ?? item.Note ?? '',
    createdAt: item.createdAt ?? item.CreatedAt,
    updatedAt: item.updatedAt ?? item.UpdatedAt,
    items: Array.isArray(rawItems) ? rawItems.map(mapOrderItem).filter(Boolean) : [],
    payments: Array.isArray(rawPayments) ? rawPayments.map(mapPayment).filter(Boolean) : [],
    stockHandlingSummary: mapStockHandlingSummary(item.stockHandlingSummary ?? item.StockHandlingSummary),
    contractId: item.contractId ?? item.ContractId ?? null,
    contractCodeSnapshot: item.contractCodeSnapshot ?? item.ContractCodeSnapshot ?? null,
    contractDiscountPercentSnapshot:
      item.contractDiscountPercentSnapshot ?? item.ContractDiscountPercentSnapshot ?? null,
    contractPaymentTermDaysSnapshot:
      item.contractPaymentTermDaysSnapshot ?? item.ContractPaymentTermDaysSnapshot ?? null,
    dueDate: item.dueDate ?? item.DueDate ?? null,
    backorderAcceptedAt: item.backorderAcceptedAt ?? item.BackorderAcceptedAt ?? null,
    backorderMinLeadDaysSnapshot:
      item.backorderMinLeadDaysSnapshot ?? item.BackorderMinLeadDaysSnapshot ?? null,
    backorderMaxLeadDaysSnapshot:
      item.backorderMaxLeadDaysSnapshot ?? item.BackorderMaxLeadDaysSnapshot ?? null,
    estimatedReadyFrom: item.estimatedReadyFrom ?? item.EstimatedReadyFrom ?? null,
    estimatedReadyTo: item.estimatedReadyTo ?? item.EstimatedReadyTo ?? null,
    fulfillmentPreference: normalizeEnum(item.fulfillmentPreference ?? item.FulfillmentPreference),
    refundStatus: normalizeEnum(item.refundStatus ?? item.RefundStatus ?? 'NotRequired'),
    refundAmount: Number(item.refundAmount ?? item.RefundAmount ?? 0),
    refundMethod: item.refundMethod ?? item.RefundMethod ?? '',
    refundEvidence: item.refundEvidence ?? item.RefundEvidence ?? '',
    cancellationReason: item.cancellationReason ?? item.CancellationReason ?? '',
    cancellationRequestedAt: item.cancellationRequestedAt ?? item.CancellationRequestedAt ?? null,
    cancellationRequestedBy: item.cancellationRequestedBy ?? item.CancellationRequestedBy ?? null,
    cancellationRequestedByName:
      item.cancellationRequestedByName ?? item.CancellationRequestedByName ?? '',
    refundApprovedAt: item.refundApprovedAt ?? item.RefundApprovedAt ?? null,
    refundApprovedBy: item.refundApprovedBy ?? item.RefundApprovedBy ?? null,
    refundApprovedByName: item.refundApprovedByName ?? item.RefundApprovedByName ?? '',
    refundedAt: item.refundedAt ?? item.RefundedAt ?? null,
    refundedBy: item.refundedBy ?? item.RefundedBy ?? null,
    refundedByName: item.refundedByName ?? item.RefundedByName ?? '',
    pickupDate: item.pickupDate ?? item.PickupDate ?? null,
    pickupNote: item.pickupNote ?? item.PickupNote ?? '',
    deliveredAt: item.deliveredAt ?? item.DeliveredAt ?? null,
    deliveredByName: item.deliveredByName ?? item.DeliveredByName ?? '',
    pickupContactName: item.pickupContactName ?? item.PickupContactName ?? '',
    pickupContactPhone: item.pickupContactPhone ?? item.PickupContactPhone ?? '',
    pickupCode: item.pickupCode ?? item.PickupCode ?? '',
    depositAmount: Number(item.depositAmount ?? item.DepositAmount ?? 0),
    remainingAmountDue: Number(item.remainingAmountDue ?? item.RemainingAmountDue ?? 0),
    customBundles: Array.isArray(item.customBundles ?? item.CustomBundles)
      ? (item.customBundles ?? item.CustomBundles).map(mapCustomBundle).filter(Boolean)
      : [],
  }
}

function isValidGuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim())
}

function buildOrdersQuery(params = {}) {
  const search = new URLSearchParams()
  if (params.search?.trim()) search.set('search', params.search.trim())
  if (params.customerId && isValidGuid(params.customerId)) {
    search.set('customerId', String(params.customerId).trim())
  }
  if (params.status) search.set('status', params.status)
  if (params.channel) search.set('channel', params.channel)
  if (params.excludeChannel) search.set('excludeChannel', params.excludeChannel)
  if (params.codTab) search.set('codTab', params.codTab)
  if (params.returnableOnly) search.set('returnableOnly', 'true')
  if (params.orderKind) search.set('orderKind', params.orderKind)
  if (params.excludeOrderKind) search.set('excludeOrderKind', params.excludeOrderKind)
  if (params.fromDate) search.set('fromDate', params.fromDate)
  if (params.toDate) search.set('toDate', params.toDate)
  if (params.employeeId && isValidGuid(params.employeeId)) {
    search.set('employeeId', String(params.employeeId).trim())
  }
  if (params.hasActiveReservation) search.set('hasActiveReservation', 'true')
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(1000, Math.max(1, Number(params.pageSize) || 20))
  search.set('page', String(page))
  search.set('pageSize', String(pageSize))
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

export function mapReceiptReprintLog(item) {
  if (!item) return null
  return {
    id: item.id ?? item.Id ?? '',
    orderId: item.orderId ?? item.OrderId ?? '',
    printedByUserId: item.printedByUserId ?? item.PrintedByUserId ?? null,
    printedByName: item.printedByName ?? item.PrintedByName ?? '',
    reason: item.reason ?? item.Reason ?? '',
    reprintNumber: Number(item.reprintNumber ?? item.ReprintNumber ?? 0),
    printedAt: item.printedAt ?? item.PrintedAt ?? null,
  }
}

export async function fetchReceiptReprints(orderId) {
  const data = await apiRequestAuth(
    `/api/v1/orders/${encodeURIComponent(orderId)}/receipt-reprints`,
    { method: 'GET' },
  )
  return Array.isArray(data) ? data.map(mapReceiptReprintLog).filter(Boolean) : []
}

export async function reprintReceipt(orderId, reason, { idempotencyKey } = {}) {
  const data = await apiRequestAuth(
    `/api/v1/orders/${encodeURIComponent(orderId)}/receipt-reprints`,
    {
      method: 'POST',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify({ reason: String(reason || '').trim() }),
    },
  )
  const receipt = data?.receipt ?? data?.Receipt ?? null
  return {
    log: mapReceiptReprintLog(data?.log ?? data?.Log),
    receipt: receipt
      ? {
          orderId: receipt.orderId ?? receipt.OrderId ?? '',
          orderCode: receipt.orderCode ?? receipt.OrderCode ?? '',
          invoiceCode: receipt.invoiceCode ?? receipt.InvoiceCode ?? null,
          customerName: receipt.customerName ?? receipt.CustomerName ?? 'Khách lẻ',
          paymentMethodLabel: receipt.paymentMethodLabel ?? receipt.PaymentMethodLabel ?? '—',
          createdAt: receipt.createdAt ?? receipt.CreatedAt ?? null,
          sellerName: receipt.sellerName ?? receipt.SellerName ?? null,
          items: (receipt.items ?? receipt.Items ?? []).map((line) => ({
            sku: line.sku ?? line.Sku ?? '',
            name: line.name ?? line.Name ?? '',
            qty: Number(line.qty ?? line.Qty ?? 0),
            price: Number(line.price ?? line.Price ?? 0),
            total: Number(line.total ?? line.Total ?? 0),
          })),
          grossSubtotal: Number(receipt.grossSubtotal ?? receipt.GrossSubtotal ?? 0),
          totalDiscount: Number(receipt.totalDiscount ?? receipt.TotalDiscount ?? 0),
          total: Number(receipt.total ?? receipt.Total ?? 0),
          amountPaid: Number(receipt.amountPaid ?? receipt.AmountPaid ?? 0),
          debtAmount: Number(receipt.debtAmount ?? receipt.DebtAmount ?? 0),
          isBackorder: Boolean(receipt.isBackorder ?? receipt.IsBackorder),
          fulfillmentPreference: receipt.fulfillmentPreference ?? receipt.FulfillmentPreference ?? null,
          estimatedReadyFrom: receipt.estimatedReadyFrom ?? receipt.EstimatedReadyFrom ?? null,
          estimatedReadyTo: receipt.estimatedReadyTo ?? receipt.EstimatedReadyTo ?? null,
          pickupDate: receipt.pickupDate ?? receipt.PickupDate ?? null,
          pickupContactName: receipt.pickupContactName ?? receipt.PickupContactName ?? '',
          pickupContactPhone: receipt.pickupContactPhone ?? receipt.PickupContactPhone ?? '',
          pickupCode: receipt.pickupCode ?? receipt.PickupCode ?? '',
          isReprint: true,
          reprintNumber: Number(receipt.reprintNumber ?? receipt.ReprintNumber ?? 0),
          reprintedAt: receipt.reprintedAt ?? receipt.ReprintedAt ?? null,
        }
      : null,
  }
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

// Chuẩn hóa JSON gửi BE (skuId, orderChannel, payments, CustomBundles). Dùng chung POS/COD/B2B.
export function buildCreateOrderBody(payload) {
  return {
    customerId: payload.customerId || null,
    customerSnapshotName: payload.customerSnapshotName?.trim() || null,
    employeeId: payload.employeeId || null,
    orderChannel: payload.orderChannel,
    contractId: payload.contractId || null,
    shippingAddress: payload.shippingAddress?.trim() || null,
    note: payload.note?.trim() || null,
    discountAmount: Number(payload.discountAmount ?? 0),
    promotionId: payload.promotionId || null,
    promotionCode: payload.promotionCode?.trim() || null,
    paidAmount: Number(payload.paidAmount ?? 0),
    transferQrAmount: Number(payload.transferQrAmount ?? 0),
    paymentMethod: payload.paymentMethod,
    acceptBackorder: Boolean(payload.acceptBackorder),
    fulfillmentPreference: payload.fulfillmentPreference || 'PartialDelivery',
    pickupDate: payload.pickupDate || null,
    pickupNote: payload.pickupNote?.trim() || null,
    pickupContactName: payload.pickupContactName?.trim() || null,
    pickupContactPhone: payload.pickupContactPhone?.trim() || null,
    depositAmount: payload.depositAmount != null ? Number(payload.depositAmount) : null,
    codDebtSettlementJson: payload.codDebtSettlementJson?.trim() || null,
    payments: Array.isArray(payload.payments)
      ? payload.payments
          .map((payment) => ({
            paymentMethod: payment.paymentMethod,
            amount: Number(payment.amount),
            debtSettlementJson: payment.debtSettlementJson?.trim() || null,
          }))
          .filter((payment) => payment.paymentMethod && payment.amount > 0)
      : null,
    items: (payload.items || []).map((line) => ({
      skuId: line.skuId,
      skuSnapshotName: line.skuSnapshotName,
      skuSnapshotCode: line.skuSnapshotCode || null,
      categorySnapshotName: line.categorySnapshotName || null,
      quantity: Number(line.quantity),
      costPrice: Number(line.costPrice ?? 0),
      unitPrice: Number(line.unitPrice),
      isGift: Boolean(line.isGift),
    })),
    CustomBundles: ((payload.customBundles || payload.CustomBundles) ?? []).map((b) => ({
      Label: b.label || b.Label || null,
      Note: b.note || b.Note || null,
      Ingredients: ((b.ingredients || b.Ingredients) ?? []).map((i) => ({
        MaterialSkuId: i.materialSkuId || i.MaterialSkuId,
        MaterialSkuCode: i.materialSkuCode || i.MaterialSkuCode,
        MaterialSnapshotName: i.materialSnapshotName || i.MaterialSnapshotName,
        Quantity: Number(i.quantity || i.Quantity),
        UnitPrice: Number(i.unitPrice || i.UnitPrice),
      })),
    })),
  }
}

// Cửa POST tạo đơn mọi kênh (POS/COD/B2B). POS gọi gián tiếp qua posApi.submitPosOrder; B2B gọi thẳng từ OrderCreatePage.
export async function createOrder(payload, { idempotencyKey } = {}) {
  const data = await apiRequestAuth('/api/v1/orders', {
    method: 'POST',
    headers: idempotencyKey
      ? { 'X-Idempotency-Key': idempotencyKey }
      : undefined,
    body: JSON.stringify(buildCreateOrderBody(payload)),
  })
  return mapOrderDetail(data)
}

export async function updateOrder(id, payload) {
  const body = {
    shippingAddress: payload.shippingAddress?.trim() || null,
    note: payload.note?.trim() || null,
    discountAmount: Number(payload.manualDiscountAmount ?? payload.discountAmount ?? 0),
  }
  if (payload.promotionTouched) {
    if (payload.promotionId) {
      body.promotionId = payload.promotionId
    } else if (payload.clearPromotion) {
      body.promotionId = '00000000-0000-0000-0000-000000000000'
      body.promotionCode = ''
    } else if (payload.promotionCode !== undefined) {
      body.promotionCode = payload.promotionCode?.trim() || ''
    }
  }
  if (Array.isArray(payload.items) && payload.items.length > 0) {
    body.items = payload.items.map((line) => ({
      id: line.id || null,
      skuId: line.skuId,
      skuSnapshotName: line.skuSnapshotName,
      skuSnapshotCode: line.skuSnapshotCode || null,
      categorySnapshotName: line.categorySnapshotName || null,
      quantity: Number(line.quantity),
      costPrice: Number(line.costPrice ?? 0),
      unitPrice: Number(line.unitPrice ?? 0),
      isGift: Boolean(line.isGift),
    }))
  }
  const data = await apiRequestAuth(`/api/v1/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return mapOrderDetail(data)
}

export async function cancelOrder(id, reason = '') {
  return apiRequestAuth(`/api/v1/orders/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
}

export async function requestBackorderCancellation(id, reason) {
  const data = await apiRequestAuth(`/api/v1/orders/${id}/backorder-cancellation`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return mapOrderDetail(data)
}

export async function reviewBackorderCancellation(id, approved, note = '') {
  const data = await apiRequestAuth(`/api/v1/orders/${id}/backorder-cancellation/review`, {
    method: 'POST',
    body: JSON.stringify({ approved: Boolean(approved), note: note?.trim() || null }),
  })
  return mapOrderDetail(data)
}

export async function completeBackorderRefund(
  id,
  refundMethod,
  refundEvidence,
  immediateItemsReturned = false,
) {
  const data = await apiRequestAuth(`/api/v1/orders/${id}/backorder-refund/complete`, {
    method: 'POST',
    body: JSON.stringify({ refundMethod, refundEvidence, immediateItemsReturned }),
  })
  return mapOrderDetail(data)
}

export async function shipOrder(id) {
  return apiRequestAuth(`/api/v1/orders/${id}/ship`, { method: 'POST' })
}

export async function completeOrder(id) {
  return apiRequestAuth(`/api/v1/orders/${id}/complete`, { method: 'POST' })
}

export async function markOrderDelivered(id) {
  return apiRequestAuth(`/api/v1/orders/${id}/mark-delivered`, { method: 'POST' })
}

// POS-06 (cọc): thu phần tiền còn lại khi khách tới nhận, rồi chuyển đơn sang Hoàn tất.
export async function collectRemainingAndDeliver(id, payload) {
  const data = await apiRequestAuth(`/api/v1/orders/${id}/collect-and-deliver`, {
    method: 'POST',
    body: JSON.stringify({
      paymentMethod: payload.paymentMethod,
      amount: Number(payload.amount ?? 0),
      transactionRef: payload.transactionRef?.trim() || null,
    }),
  })
  return mapOrderDetail(data)
}

// POS-06 (cọc): Manager hủy đơn quá hạn nhận hàng 7 ngày, giữ lại tiền cọc.
export async function cancelOverdueDepositOrder(id, reason) {
  const data = await apiRequestAuth(`/api/v1/orders/${id}/cancel-overdue-deposit`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return mapOrderDetail(data)
}

function mapReturnOrderLine(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    skuId: item.skuId ?? item.SkuId,
    skuSnapshotName: item.skuSnapshotName ?? item.SkuSnapshotName ?? '',
    skuSnapshotCode: item.skuSnapshotCode ?? item.SkuSnapshotCode ?? null,
    returnQuantity: Number(item.returnQuantity ?? item.ReturnQuantity ?? 0),
    unitPrice: Number(item.unitPrice ?? item.UnitPrice ?? 0),
    subTotal: Number(item.subTotal ?? item.SubTotal ?? 0),
  }
}

export function mapReturnOrderSummary(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    returnCode: item.returnCode ?? item.ReturnCode ?? '',
    sourceOrderId: item.sourceOrderId ?? item.SourceOrderId,
    sourceOrderCode: item.sourceOrderCode ?? item.SourceOrderCode ?? '',
    sourceOrderChannel: normalizeEnum(item.sourceOrderChannel ?? item.SourceOrderChannel ?? ''),
    customerId: item.customerId ?? item.CustomerId ?? null,
    customerSnapshotName: item.customerSnapshotName ?? item.CustomerSnapshotName ?? null,
    returnAmount: Number(item.returnAmount ?? item.ReturnAmount ?? 0),
    refundAmount: Number(item.refundAmount ?? item.RefundAmount ?? 0),
    exchangeAmount: Number(item.exchangeAmount ?? item.ExchangeAmount ?? 0),
    exchangeOrderId: item.exchangeOrderId ?? item.ExchangeOrderId ?? null,
    exchangeOrderCode: item.exchangeOrderCode ?? item.ExchangeOrderCode ?? null,
    note: item.note ?? item.Note ?? null,
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
    acceptanceStatus: normalizeEnum(item.acceptanceStatus ?? item.AcceptanceStatus ?? 'Accepted'),
    acceptedAt: item.acceptedAt ?? item.AcceptedAt ?? null,
  }
}

export function mapReturnOrderDetail(item) {
  if (!item || typeof item !== 'object') return null
  const items = item.items ?? item.Items ?? []
  const evidence = item.evidenceImageUrls ?? item.EvidenceImageUrls ?? []
  return {
    ...mapReturnOrderSummary(item),
    netCustomerPays: Number(item.netCustomerPays ?? item.NetCustomerPays ?? 0),
    customerPaidAmount: Number(item.customerPaidAmount ?? item.CustomerPaidAmount ?? 0),
    refundMethod: item.refundMethod ?? item.RefundMethod ?? '',
    note: item.note ?? item.Note ?? null,
    rejectedAt: item.rejectedAt ?? item.RejectedAt ?? null,
    rejectionReason: item.rejectionReason ?? item.RejectionReason ?? null,
    acceptedBySystem: Boolean(item.acceptedBySystem ?? item.AcceptedBySystem),
    managerOverride: Boolean(item.managerOverride ?? item.ManagerOverride),
    policyCode: item.policyCode ?? item.PolicyCode ?? null,
    policyVersion: item.policyVersion ?? item.PolicyVersion ?? null,
    evidenceImageUrls: Array.isArray(evidence) ? evidence.map((url) => String(url)).filter(Boolean) : [],
    items: Array.isArray(items) ? items.map(mapReturnOrderLine).filter(Boolean) : [],
  }
}

export function mapReturnOrderResult(item) {
  if (!item || typeof item !== 'object') return null
  return {
    returnId: item.returnId ?? item.ReturnId,
    returnCode: item.returnCode ?? item.ReturnCode ?? '',
    sourceOrderId: item.sourceOrderId ?? item.SourceOrderId,
    sourceOrderCode: item.sourceOrderCode ?? item.SourceOrderCode ?? '',
    returnAmount: Number(item.returnAmount ?? item.ReturnAmount ?? 0),
    exchangeAmount: Number(item.exchangeAmount ?? item.ExchangeAmount ?? 0),
    netCustomerPays: Number(item.netCustomerPays ?? item.NetCustomerPays ?? 0),
    refundAmount: Number(item.refundAmount ?? item.RefundAmount ?? 0),
    exchangeOrderId: item.exchangeOrderId ?? item.ExchangeOrderId ?? null,
    exchangeOrderCode: item.exchangeOrderCode ?? item.ExchangeOrderCode ?? null,
    acceptanceStatus: normalizeEnum(item.acceptanceStatus ?? item.AcceptanceStatus ?? 'Accepted'),
    acceptedAt: item.acceptedAt ?? item.AcceptedAt ?? null,
  }
}

function buildReturnsQuery(params = {}) {
  const search = new URLSearchParams()
  if (params.search) search.set('search', params.search)
  if (params.channel) search.set('channel', params.channel)
  search.set('page', String(params.page ?? 1))
  search.set('pageSize', String(Math.min(100, Math.max(1, params.pageSize ?? 20))))
  return search.toString()
}

async function requestReturnsPage(query) {
  const paths = [`/api/v1/orders/return-slips?${query}`, `/api/v1/returns?${query}`]
  let lastError = null

  for (const path of paths) {
    try {
      return await apiRequestAuth(path, { method: 'GET' })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('Không tải được danh sách phiếu trả.')
}

export async function fetchReturns(params = {}) {
  const query = buildReturnsQuery(params)
  const data = await requestReturnsPage(query)
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapReturnOrderSummary).filter(Boolean),
    totalPages: Number(data?.totalPages ?? data?.TotalPages ?? (Math.ceil(paged.totalCount / paged.pageSize) || 1)),
  }
}

export async function fetchReturnById(id) {
  const paths = [
    `/api/v1/orders/return-slips/${encodeURIComponent(id)}`,
    `/api/v1/returns/${encodeURIComponent(id)}`,
  ]
  let lastError = null

  for (const path of paths) {
    try {
      const data = await apiRequestAuth(path, { method: 'GET' })
      return mapReturnOrderDetail(data)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('Không tìm thấy phiếu trả hàng.')
}

export async function acceptReturn(returnId) {
  const data = await apiRequestAuth(`/api/v1/returns/${encodeURIComponent(returnId)}/accept`, {
    method: 'POST',
  })
  return mapReturnOrderResult(data)
}

export async function rejectReturn(returnId, reason = null) {
  const data = await apiRequestAuth(`/api/v1/returns/${encodeURIComponent(returnId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return mapReturnOrderResult(data)
}

export async function fetchReturnsByOrderId(orderId) {
  const data = await apiRequestAuth(`/api/v1/orders/${encodeURIComponent(orderId)}/returns`, { method: 'GET' })
  return Array.isArray(data) ? data.map(mapReturnOrderSummary).filter(Boolean) : []
}

export async function returnOrder(orderId, payload) {
  const data = await apiRequestAuth(`/api/v1/orders/${encodeURIComponent(orderId)}/return`, {
    method: 'POST',
    body: JSON.stringify({
      items: (payload.items || []).map((line) => ({
        orderDetailId: line.orderDetailId,
        returnQuantity: Number(line.returnQuantity),
      })),
      paymentMethod: payload.paymentMethod || 'CASH',
      customerPaidAmount: Number(payload.customerPaidAmount ?? 0),
      exchangeItems: (payload.exchangeItems || []).map((line) => ({
        skuId: line.skuId,
        skuSnapshotName: line.skuSnapshotName,
        skuSnapshotCode: line.skuSnapshotCode || null,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      })),
      note: payload.note?.trim() || null,
      reasons: Array.isArray(payload.reasons) ? payload.reasons.map((reason) => String(reason || '').trim()).filter(Boolean) : [],
      otherReason: payload.otherReason?.trim() || null,
      exchangeFulfillment: payload.exchangeFulfillment || null,
      exchangeManualDiscount: Number(payload.exchangeManualDiscount ?? 0),
      checklistAnswers: Array.isArray(payload.checklistAnswers)
        ? payload.checklistAnswers
            .filter((item) => item?.id)
            .map((item) => ({
              id: String(item.id).trim(),
              checked: Boolean(item.checked),
            }))
        : [],
      evidenceImageUrls: Array.isArray(payload.evidenceImageUrls)
        ? payload.evidenceImageUrls.map((url) => String(url || '').trim()).filter(Boolean)
        : [],
      managerOverride: Boolean(payload.managerOverride),
    }),
  })
  return mapReturnOrderResult(data)
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

export async function verifyCodPayment(paymentId, { collectedAmount = 0, transactionRef = null, debtSettlementJson = null } = {}) {
  const body = {
    transactionRef,
    collectedAmount: Number(collectedAmount || 0),
  }
  if (debtSettlementJson) body.debtSettlementJson = debtSettlementJson
  const data = await apiRequestAuth(`/api/v1/payments/${paymentId}/verify-cod`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return mapPayment(data)
}
