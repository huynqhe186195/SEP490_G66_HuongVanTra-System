import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  buildCreateCustomerBody,
  fetchCustomerAddresses,
  fetchCustomerById,
  fetchCustomerByPhone,
  mapCustomer,
} from '../../customers/services/customersApi.js'
import { isUsableShippingAddress } from '../../customers/utils/shippingAddress.js'
import {
  buildCreateOrderBody,
  createOrder,
  fetchOrder,
  fetchOrders,
  mapOrderDetail,
} from '../../orders/services/ordersApi.js'
import { mapPromotion } from '../utils/posPromotionUtils.js'
import { normalizePosBaseQuantity } from '../utils/posQuantity.js'
import { buildPosCustomerSearchQuery } from '../utils/posCustomerSearch.js'
import {
  getProductsFromCache,
  getCustomerByPhone as getOfflineCustomerByPhone,
  searchCustomersFromCache,
  enqueue,
  saveDraftOrder,
} from '../../../lib/offlineDb.js'

/** Ghép tên SP + quy cách; tránh "Trà Xanh 100g — Trà Xanh 100g" khi VariantName đã chứa tên SP. */
export function formatPosDisplayName(productName, packagingType, fallback = '') {
  const name = String(productName || '').trim()
  const packaging = String(packagingType || '').trim()
  if (!name) return packaging || String(fallback || '').trim() || 'Sản phẩm'
  if (!packaging) return name
  if (name === packaging) return name
  const nameLower = name.toLowerCase()
  const packagingLower = packaging.toLowerCase()
  if (packagingLower.includes(nameLower) || nameLower.includes(packagingLower)) {
    return packaging.length >= name.length ? packaging : name
  }
  return `${name} — ${packaging}`
}

function buildPromotionPreviewBody({
  promotionId = null,
  promotionCode = null,
  customerId = null,
  items = [],
  manualDiscount = 0,
} = {}) {
  return {
    promotionId: promotionId || null,
    promotionCode: promotionCode?.trim() || null,
    customerId: customerId || null,
    manualDiscount: Math.max(0, Math.round(Number(manualDiscount) || 0)),
    items: items.map((item) => {
      const quantity = normalizePosBaseQuantity(
        item.quantity ?? item.qty ?? 1,
        item.inventoryUnit || 'Piece',
      )
      const unitPrice = Number(item.unitPrice ?? item.price ?? 0)
      return {
        skuId: item.skuId ?? item.productId,
        quantity,
        unitPrice,
        subTotal: item.subTotal ?? item.lineTotal ?? unitPrice * quantity,
        categoryId: item.categoryId ?? item.CategoryId ?? null,
      }
    }),
  }
}

function mapPaymentMethod(method) {
  const value = String(method || '').toUpperCase()
  if (value === 'CASH') return 'Cash'
  if (value === 'TRANSFER' || value === 'VIETQR') return 'VietQR'
  if (value === 'BANKTRANSFER') return 'BankTransfer'
  if (value === 'COD') return 'COD'
  return 'Cash'
}

function getPaymentAllocations(payload) {
  const rows = payload?.payments ?? payload?.Payments
  return Array.isArray(rows) ? rows : []
}

function findPaymentAllocation(payload, predicate) {
  return getPaymentAllocations(payload).find((payment) =>
    predicate(String(payment?.paymentMethod || payment?.PaymentMethod || '').toUpperCase()))
}

function getPaymentAllocationAmount(payload, predicate) {
  const allocation = findPaymentAllocation(payload, predicate)
  return Math.max(0, Number(allocation?.amount ?? allocation?.Amount ?? 0))
}

function findTransferPayment(payments) {
  return (Array.isArray(payments) ? payments : []).find((payment) => {
    const method = String(payment?.paymentMethod || '').toUpperCase()
    return method === 'VIETQR' || method === 'BANKTRANSFER' || method === 'TRANSFER'
  })
}

function resolveOrderPaymentStatus(payments) {
  const rows = Array.isArray(payments) ? payments : []
  const transferPayment = findTransferPayment(rows)
  if (transferPayment) return transferPayment.paymentStatus ?? ''
  if (rows.length === 0) return ''
  if (rows.every((payment) => String(payment?.paymentStatus || '').toLowerCase() === 'success')) {
    return 'Success'
  }
  if (rows.some((payment) => String(payment?.paymentStatus || '').toLowerCase() === 'failed')) {
    return 'Failed'
  }
  return 'Pending'
}

function mapPosLineItem(item) {
  const productId = item.productId ?? item.ProductId ?? item.skuId ?? item.SkuId
  const skuCode = item.sku ?? item.Sku ?? item.skuSnapshotCode ?? item.SkuSnapshotCode ?? ''
  // Guid SKU id — không dùng mã SKU (vd. HVT-...) làm productId.
  const looksLikeGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(productId || ''))
  return {
    productId: looksLikeGuid ? productId : null,
    sku: skuCode,
    productName: item.productName ?? item.ProductName ?? '',
    packagingType: item.packagingType ?? item.PackagingType ?? '',
    name: item.name ?? item.Name ?? item.skuSnapshotName ?? item.SkuSnapshotName ?? '',
    quantity: Number(item.quantity ?? item.Quantity ?? item.qty ?? item.Qty ?? 1),
    inventoryUnit: item.inventoryUnit ?? item.InventoryUnit ?? '',
    priceUnit: item.priceUnit ?? item.PriceUnit ?? '',
    unitPrice: Number(item.unitPrice ?? item.UnitPrice ?? item.price ?? item.Price ?? 0),
    isGift: Boolean(item.isGift ?? item.IsGift),
    categoryName: item.categoryName ?? item.CategoryName ?? item.categorySnapshotName ?? item.CategorySnapshotName ?? '',
    costPrice: Number(item.costPrice ?? item.CostPrice ?? 0),
  }
}

function buildOrderRequestFromPosPayload(
  payload,
  { orderChannel, shippingAddress, paymentMethod, paidAmount, transferQrAmount, codDebtSettlementJson },
) {
  const rawItems = payload.items ?? payload.Items ?? []
  const lines = rawItems.map(mapPosLineItem).filter((line) => line.productId)
  if (rawItems.length > 0 && lines.length === 0) {
    throw new Error('Giỏ hàng thiếu mã SKU hợp lệ (Guid). Thêm lại sản phẩm rồi thanh toán.')
  }
  const transferPayment = findPaymentAllocation(
    payload,
    (method) => method === 'TRANSFER' || method === 'VIETQR' || method === 'BANKTRANSFER',
  )
  const cashPayment = findPaymentAllocation(payload, (method) => method === 'CASH')
  const codPayment = findPaymentAllocation(payload, (method) => method === 'COD')
  const legacyPayment = transferPayment ?? cashPayment ?? codPayment
  const rawPayments = payload.payments ?? payload.Payments ?? []

  return buildCreateOrderBody({
    customerId: payload.customerId ?? payload.CustomerId,
    customerSnapshotName: (payload.customerSnapshotName ?? payload.CustomerSnapshotName)?.trim() || null,
    orderChannel: orderChannel ?? payload.orderChannel ?? payload.OrderChannel,
    shippingAddress,
    note: (payload.note ?? payload.Note)?.trim() || null,
    discountAmount: Number(
      payload.manualDiscount
      ?? payload.ManualDiscount
      ?? payload.discountAmount
      ?? payload.DiscountAmount
      ?? 0,
    ),
    promotionId: payload.promotionId ?? payload.PromotionId,
    promotionCode: payload.promotionCode ?? payload.PromotionCode,
    paidAmount: paidAmount ?? 0,
    transferQrAmount: transferQrAmount ?? 0,
    paymentMethod: paymentMethod ?? mapPaymentMethod(
      legacyPayment?.paymentMethod ?? legacyPayment?.PaymentMethod,
    ),
    acceptBackorder: Boolean(payload.acceptBackorder ?? payload.AcceptBackorder),
    fulfillmentPreference:
      payload.fulfillmentPreference
      || payload.FulfillmentPreference
      || 'PartialDelivery',
    pickupDate: payload.pickupDate ?? payload.PickupDate ?? null,
    pickupNote: payload.pickupNote ?? payload.PickupNote ?? null,
    pickupContactName: payload.pickupContactName ?? payload.PickupContactName ?? null,
    pickupContactPhone: payload.pickupContactPhone ?? payload.PickupContactPhone ?? null,
    depositAmount: payload.depositAmount ?? payload.DepositAmount ?? null,
    payments: rawPayments.map((allocation) => ({
      paymentMethod: mapPaymentMethod(allocation.paymentMethod ?? allocation.PaymentMethod),
      amount: Number(allocation.amount ?? allocation.Amount ?? 0),
      debtSettlementJson: allocation.debtSettlementJson ?? allocation.DebtSettlementJson ?? null,
    })),
    codDebtSettlementJson: codDebtSettlementJson ?? null,
    items: lines.map((line) => ({
      skuId: line.productId,
      skuSnapshotName: formatPosDisplayName(
        line.productName,
        line.packagingType,
        line.name || line.sku || 'Sản phẩm',
      ),
      skuSnapshotCode: line.sku || null,
      categorySnapshotName: line.categoryName || null,
      quantity: normalizePosBaseQuantity(line.quantity, line.inventoryUnit),
      costPrice: Number(line.costPrice ?? 0),
      unitPrice: line.isGift ? 0 : line.unitPrice,
      isGift: Boolean(line.isGift),
    })),
    customBundles: payload.customBundles ?? payload.CustomBundles ?? [],
  })
}

function mapOrderDetailToPosResult(order) {
  return {
    orderId: order.id,
    orderCode: order.orderCode,
    totalAmount: order.finalAmount,
    paymentStatus: resolveOrderPaymentStatus(order.payments),
    stockStatus: String(order.inventorySyncStatus || 'PendingDeduction').toLowerCase(),
    orderStatus: order.orderStatus,
    qrPayload: null,
    qrImageUrl: null,
    transferContent: order.orderCode,
    transferAccountNumber: null,
    paymentMode: 'vietqr_main',
    qrExpiresAtUtc: null,
    invoiceCode: null,
    createdAt: order.createdAt,
    stockHandlingSummary: order.stockHandlingSummary ?? null,
    backorderAcceptedAt: order.backorderAcceptedAt ?? null,
    estimatedReadyFrom: order.estimatedReadyFrom ?? null,
    estimatedReadyTo: order.estimatedReadyTo ?? null,
    fulfillmentPreference: order.fulfillmentPreference ?? null,
    pickupDate: order.pickupDate ?? null,
    pickupContactName: order.pickupContactName ?? '',
    pickupContactPhone: order.pickupContactPhone ?? '',
    pickupCode: order.pickupCode ?? '',
    items: (order.items ?? []).map((row) => ({
      productId: row.skuId,
      productName: row.skuSnapshotName,
      sku: row.skuSnapshotCode ?? '',
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      lineTotal: row.subTotal,
      isGift: row.isGift ? 1 : 0,
      immediateFulfilledQuantity: Number(row.immediateFulfilledQuantity ?? 0),
      reservedFinishedQuantity: Number(row.reservedFinishedQuantity ?? 0),
      backorderQuantity: Number(row.backorderQuantity ?? 0),
    })),
  }
}

export function mapPosOrderResult(item) {
  if (item?.id && item?.orderCode) {
    return mapOrderDetailToPosResult(item)
  }

  return {
    orderId: item.orderId ?? item.OrderId,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    totalAmount: Number(item.totalAmount ?? item.TotalAmount ?? 0),
    paymentStatus: item.paymentStatus ?? item.PaymentStatus ?? '',
    stockStatus: item.stockStatus ?? item.StockStatus ?? '',
    orderStatus: item.orderStatus ?? item.OrderStatus ?? '',
    qrPayload: item.qrPayload ?? item.QrPayload ?? null,
    qrImageUrl: item.qrImageUrl ?? item.QrImageUrl ?? null,
    transferContent: item.transferContent ?? item.TransferContent ?? null,
    transferAccountNumber: item.transferAccountNumber ?? item.TransferAccountNumber ?? null,
    paymentMode: item.paymentMode ?? item.PaymentMode ?? 'vietqr_main',
    qrExpiresAtUtc: item.qrExpiresAtUtc ?? item.QrExpiresAtUtc ?? null,
    invoiceCode: item.invoiceCode ?? item.InvoiceCode ?? null,
    createdAt: item.createdAt ?? item.CreatedAt,
    stockHandlingSummary: item.stockHandlingSummary ?? item.StockHandlingSummary ?? null,
    backorderAcceptedAt: item.backorderAcceptedAt ?? item.BackorderAcceptedAt ?? null,
    estimatedReadyFrom: item.estimatedReadyFrom ?? item.EstimatedReadyFrom ?? null,
    estimatedReadyTo: item.estimatedReadyTo ?? item.EstimatedReadyTo ?? null,
    fulfillmentPreference: item.fulfillmentPreference ?? item.FulfillmentPreference ?? null,
    pickupDate: item.pickupDate ?? item.PickupDate ?? null,
    pickupContactName: item.pickupContactName ?? item.PickupContactName ?? '',
    pickupContactPhone: item.pickupContactPhone ?? item.PickupContactPhone ?? '',
    pickupCode: item.pickupCode ?? item.PickupCode ?? '',
    items: (item.items ?? item.Items ?? []).map((row) => ({
      productId: row.productId ?? row.ProductId,
      productName: row.productName ?? row.ProductName ?? '',
      sku: row.sku ?? row.Sku ?? '',
      unitPrice: Number(row.unitPrice ?? row.UnitPrice ?? 0),
      quantity: Number(row.quantity ?? row.Quantity ?? 0),
      lineTotal: Number(row.lineTotal ?? row.LineTotal ?? 0),
      immediateFulfilledQuantity: Number(row.immediateFulfilledQuantity ?? row.ImmediateFulfilledQuantity ?? 0),
      reservedFinishedQuantity: Number(row.reservedFinishedQuantity ?? row.ReservedFinishedQuantity ?? 0),
      backorderQuantity: Number(row.backorderQuantity ?? row.BackorderQuantity ?? 0),
      isGift: row.isGift ?? row.IsGift ?? 0,
    })),
  }
}

export function mapPosTransferPaymentInfo(item) {
  return {
    bankCode: item.bankCode ?? item.BankCode ?? '',
    bankBin: item.bankBin ?? item.BankBin ?? '',
    bankName: item.bankName ?? item.BankName ?? '',
    accountNumber: item.accountNumber ?? item.AccountNumber ?? '',
    accountHolder: item.accountHolder ?? item.AccountHolder ?? '',
    paymentMode: item.paymentMode ?? item.PaymentMode ?? 'vietqr_main',
    sepayOrderVaEnabled: Boolean(item.sepayOrderVaEnabled ?? item.SepayOrderVaEnabled),
    sepayWebhookEnabled: Boolean(item.sepayWebhookEnabled ?? item.SepayWebhookEnabled),
  }
}

export async function fetchPosSepaySetup() {
  const data = await apiRequestAuth('/api/pos/sepay-setup', { method: 'GET' })
  return {
    paymentMode: data.paymentMode ?? data.PaymentMode ?? 'vietqr_main',
    requireSepayVa: Boolean(data.requireSepayVa ?? data.RequireSepayVa),
    apiTokenConfigured: Boolean(data.apiTokenConfigured ?? data.ApiTokenConfigured),
    bankAccountUuidConfigured: Boolean(data.bankAccountUuidConfigured ?? data.BankAccountUuidConfigured),
    staticVaConfigured: Boolean(data.staticVaConfigured ?? data.StaticVaConfigured),
    canCreateTransferQr: Boolean(data.canCreateTransferQr ?? data.CanCreateTransferQr),
    setupMessage: data.setupMessage ?? data.SetupMessage ?? null,
    bankAccounts: (data.bankAccounts ?? data.BankAccounts ?? []).map((row) => ({
      id: row.id ?? row.Id ?? '',
      bankName: row.bankName ?? row.BankName ?? '',
      accountNumber: row.accountNumber ?? row.AccountNumber ?? '',
      accountHolderName: row.accountHolderName ?? row.AccountHolderName ?? '',
      status: row.status ?? row.Status ?? '',
    })),
  }
}

function mapTransferQrResponse(qr, fallbackOrderCode = '') {
  const qrImageUrl = qr.qrImageUrl ?? qr.QrImageUrl ?? null
  return {
    transferContent: qr.transferContent ?? qr.TransferContent ?? fallbackOrderCode,
    transferAccountNumber: qr.transferAccountNumber ?? qr.TransferAccountNumber ?? null,
    qrExpiresAtUtc: qr.qrExpiresAtUtc ?? qr.QrExpiresAtUtc ?? null,
    paymentMode: qr.paymentMode ?? qr.PaymentMode ?? 'vietqr_main',
    qrImageUrl,
    qrPayload: qr.qrPayload ?? qr.QrPayload ?? qrImageUrl,
    isExpired: Boolean(qr.isExpired ?? qr.IsExpired),
  }
}

export async function fetchOrderTransferQrByOrderId(orderId) {
  const qr = await apiRequestAuth(`/api/pos/orders/${orderId}/transfer-qr`, { method: 'GET' })
  return mapTransferQrResponse(qr)
}

export async function refreshOrderTransferQr(orderId) {
  const qr = await apiRequestAuth(`/api/pos/orders/${orderId}/transfer-qr/refresh`, { method: 'POST' })
  return mapTransferQrResponse(qr)
}

/** POS-06 (cọc): QR thu nốt phần còn lại khi khách tới nhận hàng. */
export async function fetchOrderRemainingQr(orderId) {
  const qr = await apiRequestAuth(`/api/pos/orders/${orderId}/remaining-qr`, { method: 'GET' })
  return mapTransferQrResponse(qr)
}

export async function refreshOrderRemainingQr(orderId) {
  const qr = await apiRequestAuth(`/api/pos/orders/${orderId}/remaining-qr/refresh`, { method: 'POST' })
  return mapTransferQrResponse(qr)
}

export async function fetchOrderRemainingPaymentStatus(orderId) {
  const data = await apiRequestAuth(`/api/pos/orders/${orderId}/remaining-status`, { method: 'GET' })
  return mapPosPaymentStatus(data)
}

export async function fetchOrderTransferQr({ orderCode, amount, orderId }) {
  const base = {
    transferContent: orderCode,
    transferAccountNumber: null,
    qrExpiresAtUtc: null,
    paymentMode: 'vietqr_main',
    qrImageUrl: null,
    qrPayload: null,
    isExpired: false,
  }

  if (orderId) {
    try {
      return await fetchOrderTransferQrByOrderId(orderId)
    } catch {
      return base
    }
  }

  try {
    const qr = await apiRequestAuth('/api/pos/transfer-qr', {
      method: 'POST',
      body: JSON.stringify({
        orderCode,
        amount,
      }),
    })
    return mapTransferQrResponse(qr, orderCode)
  } catch {
    return base
  }
}

async function attachTransferQr(result, qrAmount = 0) {
  const amount = qrAmount > 0 ? qrAmount : result.totalAmount
  const qr = await fetchOrderTransferQr({
    orderCode: result.orderCode,
    amount,
    orderId: result.orderId,
  })
  return {
    ...result,
    ...qr,
    qrAmount: amount,
  }
}

export function resolveTransferQrImageUrl({ qrImageUrl, qrPayload } = {}) {
  if (qrImageUrl) return qrImageUrl
  if (!qrPayload) return ''
  if (qrPayload.startsWith('http://') || qrPayload.startsWith('https://') || qrPayload.startsWith('data:')) {
    return qrPayload
  }
  // VietQR EMV payload — render thành ảnh QR
  return `https://quickchart.io/qr?size=280&margin=1&text=${encodeURIComponent(qrPayload)}`
}

async function submitPosOrder(payload, options, { idempotencyKey } = {}) {
  const body = buildOrderRequestFromPosPayload(payload, options)
  const order = await createOrder(body, { idempotencyKey })
  return mapOrderDetailToPosResult(order)
}

export async function createPosOrderOnline(payload, { qrAmount = 0, idempotencyKey } = {}) {
  const transferPayment = findPaymentAllocation(
    payload,
    (method) => method === 'TRANSFER' || method === 'VIETQR' || method === 'BANKTRANSFER',
  )
  const result = await submitPosOrder(payload, {
    orderChannel: 'POS',
    paymentMethod: mapPaymentMethod(transferPayment?.paymentMethod ?? 'TRANSFER'),
    paidAmount: 0,
    transferQrAmount: qrAmount > 0 ? qrAmount : 0,
  }, { idempotencyKey })
  return attachTransferQr(result, qrAmount)
}

export function buildTakeawayOrderPayload({
  storeId,
  customerId,
  customerSnapshotName = null,
  shippingAddress,
  note,
  cartItems,
  customBundles = [],
  manualDiscount = 0,
  promotionId = null,
  promotionCode = null,
}) {
  return {
    storeId,
    customerId,
    customerSnapshotName: customerSnapshotName?.trim() || null,
    promotionId: promotionId || null,
    promotionCode: promotionCode?.trim() || null,
    manualDiscount: Math.max(0, Math.round(Number(manualDiscount) || 0)),
    shippingAddress: shippingAddress?.trim() || null,
    note: note?.trim() || null,
    items: cartItems.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      quantity: item.qty,
      unitPrice: item.isGift ? 0 : item.price,
      costPrice: item.costPrice ?? 0,
      categoryName: item.categoryName ?? null,
      inventoryUnit: item.inventoryUnit,
      priceUnit: item.priceUnit,
      isGift: item.isGift ? 1 : 0,
    })),
    customBundles: customBundles ?? [],
    payments: [],
  }
}

export function createTakeawayCodOrder(
  payload,
  expectedAmount = 0,
  { paymentAmount = expectedAmount, codDebtSettlementJson = null, idempotencyKey } = {},
) {
  const amount = Math.max(0, Number(expectedAmount) || 0)
  const appliedAmount = Math.max(0, Number(paymentAmount) || 0)
  return submitPosOrder(
    {
      ...payload,
      payments: [{
        paymentMethod: 'COD',
        amount: appliedAmount,
        debtSettlementJson: codDebtSettlementJson,
      }],
    },
    {
      orderChannel: 'COD',
      shippingAddress: payload.shippingAddress,
      paymentMethod: 'COD',
      paidAmount: amount,
      codDebtSettlementJson,
    },
    { idempotencyKey },
  )
}

/** Mang đi thanh toán tiền mặt / ghi nợ — channel COD + địa chỉ giao. */
export function createTakeawayCashOrder(payload, { idempotencyKey } = {}) {
  const cashAmount = getPaymentAllocationAmount(payload, (method) => method === 'CASH')
  return submitPosOrder(payload, {
    orderChannel: 'COD',
    shippingAddress: payload.shippingAddress,
    paymentMethod: 'Cash',
    paidAmount: cashAmount,
  }, { idempotencyKey })
}

export async function createTakeawayVietQrOrder(
  payload,
  {
    qrAmount = 0,
    paymentAmount = qrAmount,
    debtSettlementJson = null,
    idempotencyKey,
  } = {},
) {
  const result = await submitPosOrder(
    {
      ...payload,
      payments: [{
        paymentMethod: 'TRANSFER',
        amount: Math.max(0, Number(paymentAmount) || 0),
        debtSettlementJson,
      }],
    },
    {
      // Mang đi + QR vẫn theo dõi như đơn giao COD (địa chỉ giao), không phải Phone.
      orderChannel: 'COD',
      shippingAddress: payload.shippingAddress,
      paymentMethod: 'VietQR',
      paidAmount: 0,
      transferQrAmount: qrAmount > 0 ? qrAmount : 0,
    },
    { idempotencyKey },
  )
  return attachTransferQr(result, qrAmount)
}

export async function createPosOrderOffline(payload, { idempotencyKey } = {}) {
  // Khi offline: lưu vào sync_queue và trả về fake result để UI tiếp tục
  if (!navigator.onLine) {
    const cashAmount = getPaymentAllocationAmount(payload, (method) => method === 'CASH')
    const tempId = `OFFLINE-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const idempotencyKey = crypto.randomUUID()
    const orderPayload = buildOrderRequestFromPosPayload(payload, {
      orderChannel: 'POS',
      paymentMethod: 'Cash',
      paidAmount: cashAmount,
    })

    await saveDraftOrder({
      tempId,
      status: 'PENDING_SYNC',
      payload: orderPayload,
      createdAt: Date.now(),
    })
    await enqueue('CREATE_ORDER', orderPayload, idempotencyKey)

    return {
      orderId: tempId,
      orderCode: tempId,
      status: 'PENDING_SYNC',
      isOffline: true,
      totalAmount: orderPayload.totalAmount ?? 0,
      paidAmount: cashAmount,
    }
  }

  const cashAmount = getPaymentAllocationAmount(payload, (method) => method === 'CASH')
  return submitPosOrder(payload, {
    orderChannel: 'POS',
    paymentMethod: 'Cash',
    paidAmount: cashAmount,
  }, { idempotencyKey })
}

/** CK tại quầy đã ghi nhận số tiền khách chuyển (không qua QR). */
export function createPosOrderTransferRecorded(payload) {
  const transferPayment = findPaymentAllocation(
    payload,
    (method) => method === 'TRANSFER' || method === 'VIETQR' || method === 'BANKTRANSFER',
  )
  const transferAmount = getPaymentAllocationAmount(
    payload,
    (method) => method === 'TRANSFER' || method === 'VIETQR' || method === 'BANKTRANSFER',
  )
  return submitPosOrder(payload, {
    orderChannel: 'POS',
    paymentMethod: mapPaymentMethod(transferPayment?.paymentMethod ?? 'TRANSFER'),
    paidAmount: transferAmount,
  })
}

export async function fetchPosTransferPaymentInfo() {
  const data = await apiRequestAuth('/api/pos/transfer-payment-info', { method: 'GET' })
  return mapPosTransferPaymentInfo(data)
}

export function mapPosPaymentStatus(item) {
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

export async function fetchPosOrderPaymentStatus(orderId) {
  try {
    const data = await apiRequestAuth(`/api/pos/orders/${orderId}/payment-status`, { method: 'GET' })
    return mapPosPaymentStatus(data)
  } catch {
    const order = await fetchOrder(orderId)
    const transferPayment = findTransferPayment(order.payments)
    const paymentStatus = resolveOrderPaymentStatus(order.payments)
    const isPaid = String(order.orderStatus || '').toLowerCase() === 'completed'

    return mapPosPaymentStatus({
      orderId: order.id,
      orderCode: order.orderCode,
      paymentStatus,
      orderStatus: order.orderStatus,
      isPaid,
      expectedTransferContent: order.orderCode,
      expectedAmount: Number(transferPayment?.amount ?? order.finalAmount),
    })
  }
}

// POS chỉ bán thành phẩm; nguyên liệu/bao bì thuộc luồng kho. Type rỗng (cache cũ) được cho qua để POS offline không trắng màn hình.
function isFinishedGoods(product) {
  const type = String(product?.productType ?? '').trim().toUpperCase()
  return type === '' || type === 'THANH_PHAM'
}

export function mapPosProduct(item) {
  const productName = item.productName ?? item.ProductName ?? ''
  const packagingType = item.packagingType ?? item.PackagingType ?? ''
  const sku = item.sku ?? item.Sku ?? ''
  const fallbackName = item.name ?? item.Name ?? ''
  const displayName = formatPosDisplayName(productName, packagingType, fallbackName || sku)

  return {
    productId: item.productId ?? item.ProductId,
    sku,
    productName,
    packagingType,
    name: displayName,
    price: Number(item.price ?? item.Price ?? 0),
    stockQuantity: Number(item.stockQuantity ?? item.StockQuantity ?? 0),
    imageUrl: item.imageUrl ?? item.ImageUrl ?? '',
    categoryId: item.categoryId ?? item.CategoryId ?? null,
    categoryName: item.categoryName ?? item.CategoryName ?? '',
    costPrice: Number(item.costPrice ?? item.CostPrice ?? 0),
    productType: item.productType ?? item.ProductType ?? '',
    inventoryUnit: item.inventoryUnit || item.InventoryUnit || '',
    isSellable: item.isSellable ?? item.IsSellable ?? true,
    priceUnit:
      item.priceUnit
      || item.PriceUnit
      || item.inventoryUnit
      || item.InventoryUnit
      || '',
  }
}

export function mapPosCustomer(item) {
  const mapped = mapCustomer(item)
  if (!mapped) {
    return {
      customerId: item.customerId ?? item.CustomerId,
      customerCode: item.customerCode ?? item.CustomerCode ?? '',
      fullName: item.fullName ?? item.FullName ?? '',
      phone: item.phone ?? item.Phone ?? '',
      customerType: item.customerType ?? item.CustomerType ?? '',
      tierCode: item.tierCode ?? item.TierCode ?? '',
      tierId: item.tierId ?? item.TierId ?? null,
      tierDiscountPercent: Number(item.tierDiscountPercent ?? item.TierDiscountPercent ?? 0),
      totalSpend: Number(item.totalSpend ?? item.TotalSpend ?? 0),
      currentDebt: Number(item.currentDebt ?? item.CurrentDebt ?? 0),
    }
  }

  return {
    customerId: mapped.customerId,
    customerCode: mapped.customerCode,
    fullName: mapped.fullName,
    phone: mapped.phone,
    customerType: mapped.customerType,
    tierCode: mapped.tierCode ?? '',
    tierId: mapped.tierId,
    tierDiscountPercent: Number(
      item.tierDiscountPercent
      ?? item.TierDiscountPercent
      ?? mapped.tier?.discountPercent
      ?? mapped.tierDiscountPercent
      ?? 0,
    ),
    totalSpend: mapped.totalSpend,
    currentDebt: mapped.currentDebt,
  }
}

function mapOfflineCustomer(c) {
  return {
    customerId: c.customerId,
    customerCode: c.customerCode ?? '',
    fullName: c.name,
    phone: c.phone,
    currentDebt: c.debtBalance ?? 0,
    outstandingBalance: c.debtBalance ?? 0,
    tierId: c.tierId ?? null,
    tierName: c.tierName ?? '',
    tierDiscountPercent: c.tierDiscountPercent ?? 0,
    customerType: c.customerType ?? 'RETAIL',
  }
}

export function mapPosCustomerContext(item) {
  return {
    customerId: item.customerId ?? item.CustomerId,
    customerCode: item.customerCode ?? item.CustomerCode ?? '',
    fullName: item.fullName ?? item.FullName ?? '',
    customerType: item.customerType ?? item.CustomerType ?? '',
    phone: item.phone ?? item.Phone ?? '',
    email: item.email ?? item.Email ?? '',
    address: item.address ?? item.Address ?? '',
    tierCode: item.tierCode ?? item.TierCode ?? '',
    tierId: item.tierId ?? item.TierId ?? null,
    tierDiscountPercent: Number(item.tierDiscountPercent ?? item.TierDiscountPercent ?? 0),
    totalSpend: Number(item.totalSpend ?? item.TotalSpend ?? 0),
    currentDebt: Number(item.currentDebt ?? item.CurrentDebt ?? 0),
    outstandingBalance: Number(item.outstandingBalance ?? item.OutstandingBalance ?? 0),
    recentOrders: (item.recentOrders ?? item.RecentOrders ?? []).map((row) => ({
      orderCode: row.orderCode ?? row.OrderCode ?? '',
      entryType: row.entryType ?? row.EntryType ?? '',
      amount: Number(row.amount ?? row.Amount ?? 0),
      paymentStatus: row.paymentStatus ?? row.PaymentStatus ?? '',
      orderStatus: row.orderStatus ?? row.OrderStatus ?? '',
      cashierName: row.cashierName ?? row.CashierName ?? '',
      cashierRole: row.cashierRole ?? row.CashierRole ?? '',
      createdAt: row.createdAt ?? row.CreatedAt,
    })),
    unpaidOrders: (item.unpaidOrders ?? item.UnpaidOrders ?? []).map((row) => ({
      orderCode: row.orderCode ?? row.OrderCode ?? '',
      totalAmount: Number(row.totalAmount ?? row.TotalAmount ?? 0),
      paidAmount: Number(row.paidAmount ?? row.PaidAmount ?? 0),
      remainingAmount: Number(row.remainingAmount ?? row.RemainingAmount ?? 0),
      paymentStatus: row.paymentStatus ?? row.PaymentStatus ?? '',
      createdAt: row.createdAt ?? row.CreatedAt,
    })),
    shippingAddresses: (item.shippingAddresses ?? item.ShippingAddresses ?? []).map((row) => ({
      id: row.id ?? row.Id ?? null,
      address: row.address ?? row.Address ?? '',
      label: row.label ?? row.Label ?? row.address ?? row.Address ?? '',
      lastUsedAt: row.lastUsedAt ?? row.LastUsedAt ?? null,
      isProfileAddress: Boolean(row.isProfileAddress ?? row.IsProfileAddress),
      receiverName: row.receiverName ?? row.ReceiverName ?? '',
      receiverPhone: row.receiverPhone ?? row.ReceiverPhone ?? '',
    })),
  }
}

export async function fetchPosCustomerContext(customerId) {
  const [customer, ordersResult, addressRows] = await Promise.all([
    fetchCustomerById(customerId),
    fetchOrders({ customerId, page: 1, pageSize: 10 }),
    fetchCustomerAddresses(customerId).catch(() => []),
  ])

  const tierDiscountPercent = Number(customer.tier?.discountPercent ?? 0)
  const recentOrders = (ordersResult.items ?? []).map((order) => ({
    orderCode: order.orderCode,
    entryType: 'ORDER',
    amount: order.finalAmount,
    paymentStatus: '',
    orderStatus: order.orderStatus,
    cashierName: '',
    cashierRole: '',
    createdAt: order.createdAt,
  }))

  const unpaidOrders = recentOrders
    .filter((order) => String(order.orderStatus).toLowerCase() !== 'completed')
    .map((order) => ({
      orderCode: order.orderCode,
      totalAmount: order.amount,
      paidAmount: 0,
      remainingAmount: order.amount,
      paymentStatus: 'Pending',
      createdAt: order.createdAt,
    }))

  const fromAddressApi = (Array.isArray(addressRows) ? addressRows : []).map((row) => {
    const line = [row.addressLine, row.ward, row.district, row.province].filter(Boolean).join(', ')
    if (!isUsableShippingAddress(line)) return null
    const receiver = [row.receiverName, row.receiverPhone].filter(Boolean).join(' · ')
    return {
      id: row.id,
      address: line.trim(),
      label: receiver ? `${receiver} — ${line.trim()}` : line.trim(),
      lastUsedAt: null,
      isProfileAddress: Boolean(row.isDefault),
      receiverName: row.receiverName || '',
      receiverPhone: row.receiverPhone || '',
    }
  }).filter(Boolean)

  const fromCustomerEmbed = (customer.addresses ?? []).map((row) => {
    const line = [row.addressLine, row.ward, row.district, row.province].filter(Boolean).join(', ')
    if (!isUsableShippingAddress(line)) return null
    const receiver = [row.receiverName, row.receiverPhone].filter(Boolean).join(' · ')
    return {
      id: row.id,
      address: line.trim(),
      label: receiver ? `${receiver} — ${line.trim()}` : line.trim(),
      lastUsedAt: null,
      isProfileAddress: Boolean(row.isDefault),
      receiverName: row.receiverName || '',
      receiverPhone: row.receiverPhone || '',
    }
  }).filter(Boolean)

  const shippingAddresses = fromAddressApi.length > 0 ? fromAddressApi : fromCustomerEmbed

  // Không đẩy addressLine placeholder CRM ("Chưa có địa chỉ giao hàng") vào list COD.
  if (isUsableShippingAddress(customer.address) && !shippingAddresses.length) {
    shippingAddresses.push({
      id: 'profile',
      address: customer.address.trim(),
      label: customer.address.trim(),
      lastUsedAt: null,
      isProfileAddress: true,
      receiverName: '',
      receiverPhone: '',
    })
  }

  // Prefer default address first for COD checkout.
  shippingAddresses.sort((a, b) => Number(b.isProfileAddress) - Number(a.isProfileAddress))

  return mapPosCustomerContext({
    customerId: customer.customerId,
    customerCode: customer.customerCode,
    fullName: customer.fullName,
    customerType: customer.customerType,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    tierCode: customer.tierCode,
    tierId: customer.tierId,
    tierDiscountPercent,
    totalSpend: customer.totalSpend,
    currentDebt: customer.currentDebt,
    outstandingBalance: customer.currentDebt,
    recentOrders,
    unpaidOrders,
    shippingAddresses,
  })
}

export async function fetchPosCustomers({ search, customerType, limit = 20, signal } = {}) {
  const term = search?.trim()

  // Offline fallback: đọc từ IndexedDB
  if (!navigator.onLine) {
    const phoneTerm = term?.replace(/\D/g, '') ?? ''
    if (phoneTerm.length === 10 && phoneTerm.startsWith('0')) {
      const byPhone = await getOfflineCustomerByPhone(phoneTerm)
      if (byPhone) {
        const mapped = mapOfflineCustomer(byPhone)
        return !customerType || mapped.customerType === customerType ? [mapped] : []
      }
    }
    const results = await searchCustomersFromCache(term ?? '', limit)
    return results
      .map(mapOfflineCustomer)
      .filter((customer) => !customerType || customer.customerType === customerType)
      .slice(0, limit)
  }

  const query = buildPosCustomerSearchQuery({
    search: term,
    customerType,
    page: 1,
    pageSize: limit,
  })
  const data = await apiRequestAuth(`/api/customers/checkout-search?${query.toString()}`, {
    method: 'GET',
    signal,
  })
  const paged = toPagedResult(data)
  return paged.items.map(mapPosCustomer).filter(Boolean)
}

export async function cancelPendingPosTransfer(orderId) {
  const order = await apiRequestAuth(
    `/api/pos/orders/${orderId}/transfer-payment/cancel`,
    { method: 'POST' },
  )
  return mapOrderDetail(order)
}

export async function createPosCustomer(payload) {
  const body = buildCreateCustomerBody({
    fullName: payload.fullName,
    phone: payload.phone,
    address: payload.address,
    customerType: payload.customerType,
  })

  try {
    const created = await apiRequestAuth('/api/customers/pos-quick', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return mapPosCustomer(mapCustomer(created))
  } catch (error) {
    if (error.statusCode === 409 && payload.phone) {
      try {
        const existing = await fetchCustomerByPhone(payload.phone, { silentAuthErrors: true })
        if (existing) {
          return {
            customer: mapPosCustomer(existing),
            reusedExisting: true,
          }
        }
      } catch {
        // fall through to original error
      }
    }
    throw error
  }
}

export async function fetchPromotionByCode(code) {
  const query = new URLSearchParams()
  query.set('code', String(code || '').trim())
  const data = await apiRequestAuth(`/api/promotions/lookup?${query.toString()}`, { method: 'GET' })
  return mapPromotion(data)
}

export async function applyPromotionPreview({
  promotionId = null,
  promotionCode = null,
  customerId = null,
  items = [],
  manualDiscount = 0,
}) {
  const data = await apiRequestAuth('/api/promotions/apply-preview', {
    method: 'POST',
    body: JSON.stringify(buildPromotionPreviewBody({
      promotionId,
      promotionCode,
      customerId,
      items,
      manualDiscount,
    })),
  })
  return mapPromotion(data)
}

export async function fetchApplicablePromotions({ customerId = null, items = [], manualDiscount = 0 } = {}) {
  const data = await apiRequestAuth('/api/promotions/applicable', {
    method: 'POST',
    body: JSON.stringify(buildPromotionPreviewBody({
      customerId,
      items,
      manualDiscount,
    })),
  })
  return Array.isArray(data) ? data.map(mapPromotion).filter(Boolean) : []
}

export async function fetchAvailablePromotions() {
  const data = await apiRequestAuth('/api/promotions/available', { method: 'GET' })
  return Array.isArray(data) ? data.map(mapPromotion).filter(Boolean) : []
}

/** Catalog cửa hàng — gồm cả SP đang ẩn ở kho nhưng đã đồng bộ (để khớp SKU). */
async function fetchStoreProductsForPos() {
  const pageSize = 100
  let page = 1
  let allItems = []
  let totalCount

  do {
    const data = await apiRequestAuth(
      `/api/v1/store/products?page=${page}&pageSize=${pageSize}`,
      { method: 'GET' },
    )
    const paged = toPagedResult(data)
    const batch = paged.items ?? []
    allItems = allItems.concat(batch)
    totalCount = paged.totalCount ?? 0
    if (batch.length === 0) break
    page += 1
  } while (allItems.length < totalCount && page <= 20)

  return allItems
}

export async function fetchPosProducts({ storeId, search, limit = 30 }) {
  // Offline fallback: đọc từ IndexedDB
  if (!navigator.onLine) {
    const cached = await getProductsFromCache(search ?? '', limit)
    return cached.map(p => mapPosProduct({
      productId: p.skuId,
      sku: p.skuCode,
      productName: p.name,
      packagingType: p.unit,
      price: p.price,
      stockQuantity: p.qtyOnHand ?? 0,
      imageUrl: p.imageUrl ?? '',
      categoryId: p.categoryId ?? null,
      productType: p.productType ?? '',
      inventoryUnit: p.inventoryUnit ?? '',
      isSellable: p.isSellable ?? true,
      priceUnit: p.priceUnit ?? p.inventoryUnit ?? '',
    })).filter((product) => product.isSellable !== false && isFinishedGoods(product))
  }

  void storeId

  const skuPageSize = Math.min(100, Math.max(1, Number(limit) || 30))
  const query = new URLSearchParams()
  if (search?.trim()) query.set('search', search.trim())
  query.set('page', '1')
  query.set('pageSize', String(skuPageSize))
  query.set('isActive', 'true')
  query.set('productType', 'THANH_PHAM')

  const [data, productItems] = await Promise.all([
    apiRequestAuth(`/api/v1/store/skus?${query.toString()}`, { method: 'GET' }),
    fetchStoreProductsForPos().catch(() => []),
  ])
  const paged = toPagedResult(data)
  const skus = paged.items
  const productById = new Map(
    productItems.map((product) => {
      const id = product.id ?? product.Id
      return [id, product]
    }),
  )

  let stockBySkuId = new Map()
  try {
    const stocks = await apiRequestAuth('/api/v1/store/sku-stocks', { method: 'GET' })
    if (Array.isArray(stocks)) {
      stockBySkuId = new Map(
        stocks.map((row) => [row.skuId ?? row.SkuId, Number(row.quantityOnHand ?? row.QuantityOnHand ?? 0)]),
      )
    }
  } catch {
    // Inventory service may be unavailable during local dev.
  }

  return skus
    .map((sku) => {
      const parentProductId = sku.productId ?? sku.ProductId
      const product = productById.get(parentProductId)
      const skuId = sku.id ?? sku.Id
      const skuCode = sku.skuCode ?? sku.SkuCode ?? ''
      const productName =
        sku.productName
        ?? sku.ProductName
        ?? product?.name
        ?? product?.Name
        ?? ''
      if (!skuId || (!productName && !skuCode)) return null

      const productImages = product?.images ?? product?.Images ?? []
      const firstProductImage = Array.isArray(productImages)
        ? (productImages[0]?.imageUrl ?? productImages[0]?.ImageUrl ?? productImages[0]?.url ?? productImages[0]?.Url ?? '')
        : ''

      return mapPosProduct({
        productId: skuId,
        sku: skuCode,
        productName,
        packagingType: sku.packagingType ?? sku.PackagingType ?? '',
        price: sku.basePrice ?? sku.BasePrice ?? sku.retailPrice ?? sku.RetailPrice,
        stockQuantity: stockBySkuId.get(skuId) ?? 0,
        imageUrl:
          sku.imageUrl
          ?? sku.ImageUrl
          ?? firstProductImage
          ?? product?.imageUrl
          ?? product?.ImageUrl
          ?? product?.thumbnailUrl
          ?? product?.ThumbnailUrl
          ?? product?.primaryImageUrl
          ?? product?.PrimaryImageUrl
          ?? '',
        categoryId: sku.categoryId ?? sku.CategoryId ?? product?.categoryId ?? product?.CategoryId ?? null,
        categoryName: sku.categoryName ?? sku.CategoryName ?? product?.categoryName ?? product?.CategoryName ?? '',
        costPrice: sku.costPrice ?? sku.CostPrice ?? 0,
        productType: sku.productType ?? sku.ProductType ?? product?.productType ?? product?.ProductType ?? '',
        inventoryUnit: sku.inventoryUnit ?? sku.InventoryUnit ?? product?.inventoryUnit ?? product?.InventoryUnit ?? '',
        isSellable: sku.isSellable ?? sku.IsSellable ?? product?.isSellable ?? product?.IsSellable ?? true,
        priceUnit:
          sku.priceUnit
          || sku.PriceUnit
          || product?.priceUnit
          || product?.PriceUnit
          || sku.inventoryUnit
          || sku.InventoryUnit
          || product?.inventoryUnit
          || product?.InventoryUnit
          || '',
      })
    })
    .filter(Boolean)
    .filter((product) => product.isSellable !== false && isFinishedGoods(product))
}

export function resolvePosStoreId() {
  const session = loadAuthSession()
  const fromSession = session?.storeId ?? session?.user?.storeId ?? session?.profile?.storeId
  if (Number.isFinite(Number(fromSession)) && Number(fromSession) > 0) {
    return Number(fromSession)
  }

  const fromEnv = Number(import.meta.env.VITE_POS_STORE_ID || 1)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 1
}
