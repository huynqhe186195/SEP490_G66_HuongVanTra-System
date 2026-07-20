import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  buildCreateCustomerBody,
  fetchCustomerById,
  fetchCustomerByPhone,
  mapCustomer,
} from '../../customers/services/customersApi.js'
import {
  buildCreateOrderBody,
  createOrder,
  fetchOrder,
  fetchOrders,
} from '../../orders/services/ordersApi.js'
import { mapPromotion } from '../utils/posPromotionUtils.js'
import {
  getProductsFromCache,
  getCustomerByPhone as getOfflineCustomerByPhone,
  searchCustomersFromCache,
  enqueue,
  saveDraftOrder,
} from '../../../lib/offlineDb.js'

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
    items: items.map((item) => ({
      skuId: item.skuId ?? item.productId,
      quantity: Math.max(1, Math.round(Number(item.quantity ?? item.qty ?? 1))),
      unitPrice: Number(item.unitPrice ?? item.price ?? 0),
      subTotal:
        item.subTotal ??
        item.lineTotal ??
        Number(item.unitPrice ?? item.price ?? 0) * Number(item.quantity ?? item.qty ?? 1),
      categoryId: item.categoryId ?? item.CategoryId ?? null,
    })),
  }
}

function mapPaymentMethod(method) {
  const value = String(method || '').toUpperCase()
  if (value === 'CASH') return 'Cash'
  if (value === 'TRANSFER') return 'VietQR'
  if (value === 'COD') return 'COD'
  return 'Cash'
}

function mapPosLineItem(item) {
  return {
    productId: item.productId ?? item.skuId,
    sku: item.sku ?? item.skuSnapshotCode ?? '',
    productName: item.productName ?? '',
    packagingType: item.packagingType ?? '',
    name: item.name ?? item.skuSnapshotName ?? '',
    quantity: Number(item.quantity ?? item.qty ?? 1),
    unitPrice: Number(item.unitPrice ?? item.price ?? 0),
    isGift: Boolean(item.isGift),
    categoryName: item.categoryName ?? item.CategoryName ?? '',
    costPrice: Number(item.costPrice ?? 0),
  }
}

function buildOrderRequestFromPosPayload(
  payload,
  { orderChannel, shippingAddress, paymentMethod, paidAmount, transferQrAmount, codDebtSettlementJson },
) {
  const lines = (payload.items ?? []).map(mapPosLineItem)
  const payment = payload.payments?.[0]

  return buildCreateOrderBody({
    customerId: payload.customerId,
    customerSnapshotName: payload.customerSnapshotName?.trim() || null,
    orderChannel,
    shippingAddress,
    note: payload.note?.trim() || null,
    discountAmount: Number(payload.manualDiscount ?? 0),
    promotionId: payload.promotionId,
    promotionCode: payload.promotionCode,
    paidAmount: paidAmount ?? Number(payment?.amount ?? 0),
    transferQrAmount: transferQrAmount ?? 0,
    paymentMethod: paymentMethod ?? mapPaymentMethod(payment?.paymentMethod),
    codDebtSettlementJson: codDebtSettlementJson ?? null,
    items: lines.map((line) => ({
      skuId: line.productId,
      skuSnapshotName:
        line.productName && line.packagingType
          ? `${line.productName} — ${line.packagingType}`
          : line.name || line.sku || 'Sản phẩm',
      skuSnapshotCode: line.sku || null,
      categorySnapshotName: line.categoryName || null,
      quantity: Math.max(1, Math.round(line.quantity)),
      costPrice: Number(line.costPrice ?? 0),
      unitPrice: line.isGift ? 0 : line.unitPrice,
      isGift: Boolean(line.isGift),
    })),
  })
}

function mapOrderDetailToPosResult(order) {
  const primaryPayment = order.payments?.[0]
  return {
    orderId: order.id,
    orderCode: order.orderCode,
    totalAmount: order.finalAmount,
    paymentStatus: primaryPayment?.paymentStatus ?? '',
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
    items: (order.items ?? []).map((row) => ({
      productId: row.skuId,
      productName: row.skuSnapshotName,
      sku: row.skuSnapshotCode ?? '',
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      lineTotal: row.subTotal,
      isGift: row.isGift ? 1 : 0,
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
    items: (item.items ?? item.Items ?? []).map((row) => ({
      productId: row.productId ?? row.ProductId,
      productName: row.productName ?? row.ProductName ?? '',
      sku: row.sku ?? row.Sku ?? '',
      unitPrice: Number(row.unitPrice ?? row.UnitPrice ?? 0),
      quantity: Number(row.quantity ?? row.Quantity ?? 0),
      lineTotal: Number(row.lineTotal ?? row.LineTotal ?? 0),
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

async function submitPosOrder(payload, options) {
  const body = buildOrderRequestFromPosPayload(payload, options)
  const order = await createOrder(body)
  return mapOrderDetailToPosResult(order)
}

export async function createPosOrderOnline(payload, { qrAmount = 0 } = {}) {
  const payment = payload.payments?.[0]
  const result = await submitPosOrder(payload, {
    orderChannel: 'POS',
    paymentMethod: mapPaymentMethod(payment?.paymentMethod ?? 'TRANSFER'),
    paidAmount: 0,
    transferQrAmount: qrAmount > 0 ? qrAmount : 0,
  })
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
      isGift: item.isGift ? 1 : 0,
    })),
    customBundles: customBundles ?? [],
    payments: [],
  }
}

export function createTakeawayCodOrder(payload, expectedAmount = 0, { codDebtSettlementJson = null } = {}) {
  const amount = Math.max(0, Number(expectedAmount) || 0)
  return submitPosOrder(
    { ...payload, payments: [{ paymentMethod: 'COD', amount }] },
    {
      orderChannel: 'COD',
      shippingAddress: payload.shippingAddress,
      paymentMethod: 'COD',
      paidAmount: amount,
      codDebtSettlementJson,
    },
  )
}

export async function createTakeawayVietQrOrder(payload, { qrAmount = 0 } = {}) {
  const result = await submitPosOrder(
    { ...payload, payments: [{ paymentMethod: 'TRANSFER', amount: 0 }] },
    {
      orderChannel: 'Phone',
      shippingAddress: payload.shippingAddress,
      paymentMethod: 'VietQR',
      paidAmount: 0,
      transferQrAmount: qrAmount > 0 ? qrAmount : 0,
    },
  )
  return attachTransferQr(result, qrAmount)
}

export async function createPosOrderOffline(payload) {
  // Khi offline: lưu vào sync_queue và trả về fake result để UI tiếp tục
  if (!navigator.onLine) {
    const payment = payload.payments?.[0]
    const tempId = `OFFLINE-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const idempotencyKey = crypto.randomUUID()
    const orderPayload = buildOrderRequestFromPosPayload(payload, {
      orderChannel: 'POS',
      paymentMethod: mapPaymentMethod(payment?.paymentMethod ?? 'CASH'),
      paidAmount: Number(payment?.amount ?? 0),
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
      paidAmount: Number(payment?.amount ?? 0),
    }
  }

  const payment = payload.payments?.[0]
  return submitPosOrder(payload, {
    orderChannel: 'POS',
    paymentMethod: mapPaymentMethod(payment?.paymentMethod ?? 'CASH'),
    paidAmount: Number(payment?.amount ?? 0),
  })
}

/** CK tại quầy đã ghi nhận số tiền khách chuyển (không qua QR). */
export function createPosOrderTransferRecorded(payload) {
  const payment = payload.payments?.[0]
  return submitPosOrder(payload, {
    orderChannel: 'POS',
    paymentMethod: mapPaymentMethod(payment?.paymentMethod ?? 'TRANSFER'),
    paidAmount: Number(payment?.amount ?? 0),
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
    const payment = order.payments?.[0]
    const isPaid =
      String(payment?.paymentStatus || '').toLowerCase() === 'success'
      || String(order.orderStatus || '').toLowerCase() === 'completed'

    return mapPosPaymentStatus({
      orderId: order.id,
      orderCode: order.orderCode,
      paymentStatus: payment?.paymentStatus ?? '',
      orderStatus: order.orderStatus,
      isPaid,
      expectedTransferContent: order.orderCode,
      expectedAmount: order.finalAmount,
    })
  }
}

export function mapPosProduct(item) {
  const productName = item.productName ?? item.ProductName ?? ''
  const packagingType = item.packagingType ?? item.PackagingType ?? ''
  const sku = item.sku ?? item.Sku ?? ''
  const fallbackName = item.name ?? item.Name ?? ''
  const displayName =
    productName && packagingType
      ? `${productName} — ${packagingType}`
      : fallbackName || sku

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
    inventoryUnit: item.inventoryUnit ?? item.InventoryUnit ?? '',
    isSellable: item.isSellable ?? item.IsSellable ?? true,
    priceUnit: item.priceUnit ?? item.PriceUnit ?? item.inventoryUnit ?? item.InventoryUnit ?? '',
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
    tierDiscountPercent: Number(mapped.tier?.discountPercent ?? mapped.tierDiscountPercent ?? 0),
    totalSpend: mapped.totalSpend,
    currentDebt: mapped.currentDebt,
  }
}

function mapOfflineCustomer(c) {
  return {
    customerId: c.customerId,
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
      address: row.address ?? row.Address ?? '',
      lastUsedAt: row.lastUsedAt ?? row.LastUsedAt ?? null,
      isProfileAddress: Boolean(row.isProfileAddress ?? row.IsProfileAddress),
    })),
  }
}

export async function fetchPosCustomerContext(customerId) {
  const [customer, ordersResult] = await Promise.all([
    fetchCustomerById(customerId),
    fetchOrders({ customerId, page: 1, pageSize: 10 }),
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

  const shippingAddresses = (customer.addresses ?? []).map((row) => ({
    address: [row.addressLine, row.ward, row.district, row.province].filter(Boolean).join(', '),
    lastUsedAt: null,
    isProfileAddress: Boolean(row.isDefault),
  }))

  if (customer.address && !shippingAddresses.length) {
    shippingAddresses.push({
      address: customer.address,
      lastUsedAt: null,
      isProfileAddress: true,
    })
  }

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

export async function fetchPosCustomers({ search, limit = 20 }) {
  const term = search?.trim()

  // Offline fallback: đọc từ IndexedDB
  if (!navigator.onLine) {
    const phoneTerm = term?.replace(/\D/g, '') ?? ''
    if (phoneTerm.length === 10 && phoneTerm.startsWith('0')) {
      const byPhone = await getOfflineCustomerByPhone(phoneTerm)
      if (byPhone) return [mapOfflineCustomer(byPhone)]
    }
    const results = await searchCustomersFromCache(term ?? '', limit)
    return results.map(mapOfflineCustomer)
  }

  const phoneTerm = term?.replace(/\D/g, '') ?? ''

  if (phoneTerm.length === 10 && phoneTerm.startsWith('0')) {
    try {
      const byPhone = await fetchCustomerByPhone(phoneTerm, { silentAuthErrors: true })
      if (byPhone) {
        return [mapPosCustomer(byPhone)]
      }
    } catch (error) {
      if (error.statusCode !== 403 && error.statusCode !== 404) {
        throw error
      }
    }
  }

  const data = await apiRequestAuth(`/api/customers?page=1&pageSize=100`, { method: 'GET' })
  const paged = toPagedResult(data)
  let items = paged.items.map(mapCustomer).filter(Boolean)

  if (term) {
    const lowerTerm = term.toLowerCase()
    items = items.filter((item) => {
      const name = (item.fullName || '').toLowerCase()
      const phone = (item.phone || '').replace(/\s+/g, '')
      const code = (item.customerCode || '').toLowerCase()
      return (
        name.includes(lowerTerm) ||
        code.includes(lowerTerm) ||
        (phoneTerm.length > 0 && phone.includes(phoneTerm))
      )
    })
  }

  return items.slice(0, limit).map(mapPosCustomer)
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
    })).filter((product) => product.isSellable !== false)
  }

  void storeId

  const skuPageSize = Math.min(100, Math.max(1, Number(limit) || 30))
  const query = new URLSearchParams()
  if (search?.trim()) query.set('search', search.trim())
  query.set('page', '1')
  query.set('pageSize', String(skuPageSize))
  query.set('isActive', 'true')

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

      return mapPosProduct({
        productId: skuId,
        sku: skuCode,
        productName,
        packagingType: sku.packagingType ?? sku.PackagingType ?? '',
        price: sku.basePrice ?? sku.BasePrice ?? sku.retailPrice ?? sku.RetailPrice,
        stockQuantity: stockBySkuId.get(skuId) ?? 0,
        imageUrl: sku.imageUrl ?? sku.ImageUrl ?? product?.imageUrl ?? product?.ImageUrl ?? '',
        categoryId: sku.categoryId ?? sku.CategoryId ?? product?.categoryId ?? product?.CategoryId ?? null,
        categoryName: sku.categoryName ?? sku.CategoryName ?? product?.categoryName ?? product?.CategoryName ?? '',
        costPrice: sku.costPrice ?? sku.CostPrice ?? 0,
        productType: sku.productType ?? sku.ProductType ?? product?.productType ?? product?.ProductType ?? '',
        inventoryUnit: sku.inventoryUnit ?? sku.InventoryUnit ?? product?.inventoryUnit ?? product?.InventoryUnit ?? '',
        isSellable: sku.isSellable ?? sku.IsSellable ?? product?.isSellable ?? product?.IsSellable ?? true,
        priceUnit: sku.priceUnit ?? sku.PriceUnit ?? product?.priceUnit ?? product?.PriceUnit ?? sku.inventoryUnit ?? sku.InventoryUnit ?? '',
      })
    })
    .filter(Boolean)
    .filter((product) => product.isSellable !== false)
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
