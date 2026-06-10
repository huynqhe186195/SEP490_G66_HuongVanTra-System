import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  buildCreateCustomerBody,
  fetchCustomerById,
  mapCustomer,
} from '../../customers/services/customersApi.js'
import {
  buildCreateOrderBody,
  createOrder,
  fetchOrder,
  fetchOrders,
} from '../../orders/services/ordersApi.js'

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
    isGift: item.isGift ?? 0,
  }
}

function buildOrderRequestFromPosPayload(
  payload,
  { orderChannel, shippingAddress, paymentMethod, paidAmount, transferQrAmount },
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
    items: lines.map((line) => ({
      skuId: line.productId,
      skuSnapshotName:
        line.productName && line.packagingType
          ? `${line.productName} — ${line.packagingType}`
          : line.name || line.sku || 'Sản phẩm',
      skuSnapshotCode: line.sku || null,
      quantity: Math.max(1, Math.round(line.quantity)),
      unitPrice: line.unitPrice,
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
    items: (order.items ?? []).map((row) => ({
      productId: row.skuId,
      productName: row.skuSnapshotName,
      sku: row.skuSnapshotCode ?? '',
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      lineTotal: row.subTotal,
      isGift: 0,
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
  if (qrPayload.startsWith('http://') || qrPayload.startsWith('https://')) {
    return qrPayload
  }
  return ''
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
  manualDiscount = 0,
  promotionId = null,
}) {
  return {
    storeId,
    customerId,
    customerSnapshotName: customerSnapshotName?.trim() || null,
    promotionId: promotionId || null,
    manualDiscount: Math.max(0, Math.round(Number(manualDiscount) || 0)),
    shippingAddress: shippingAddress?.trim() || null,
    note: note?.trim() || null,
    items: cartItems.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      quantity: item.qty,
      unitPrice: item.price,
      isGift: 0,
    })),
    payments: [],
  }
}

export function createTakeawayCodOrder(payload) {
  return submitPosOrder(
    { ...payload, payments: [{ paymentMethod: 'COD', amount: 0 }] },
    {
      orderChannel: 'COD',
      shippingAddress: payload.shippingAddress,
      paymentMethod: 'COD',
      paidAmount: 0,
    },
  )
}

export async function createTakeawayVietQrOrder(payload) {
  const result = await submitPosOrder(
    { ...payload, payments: [{ paymentMethod: 'TRANSFER', amount: 0 }] },
    {
      orderChannel: 'Phone',
      shippingAddress: payload.shippingAddress,
      paymentMethod: 'VietQR',
      paidAmount: 0,
    },
  )
  return attachTransferQr(result)
}

export function createPosOrderOffline(payload) {
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
  const data = await apiRequestAuth(`/api/customers?page=1&pageSize=100`, { method: 'GET' })
  const paged = toPagedResult(data)
  let items = paged.items.map(mapCustomer).filter(Boolean)

  const term = search?.trim().toLowerCase()
  if (term) {
    const phoneTerm = term.replace(/\D/g, '')
    items = items.filter((item) => {
      const name = (item.fullName || '').toLowerCase()
      const phone = (item.phone || '').replace(/\s+/g, '')
      const code = (item.customerCode || '').toLowerCase()
      return (
        name.includes(term) ||
        code.includes(term) ||
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
  const created = await apiRequestAuth('/api/customers', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return mapPosCustomer(mapCustomer(created))
}

export async function fetchPromotionByCode(code) {
  const query = new URLSearchParams()
  query.set('code', String(code || '').trim())
  const data = await apiRequestAuth(`/api/promotions/lookup?${query.toString()}`, { method: 'GET' })
  return {
    id: data.id ?? data.Id,
    promoCode: data.promoCode ?? data.PromoCode ?? '',
    discountType: String(data.discountType ?? data.DiscountType ?? 'PERCENTAGE').toUpperCase(),
    discountValue: Number(data.discountValue ?? data.DiscountValue ?? 0),
  }
}

/** Catalog cửa hàng — gồm cả SP đang ẩn ở kho nhưng đã đồng bộ (để khớp SKU). */
async function fetchStoreProductsForPos() {
  const pageSize = 100
  let page = 1
  let allItems = []
  let totalCount = 0

  do {
    const data = await apiRequestAuth(
      `/api/v1/products?page=${page}&pageSize=${pageSize}`,
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
  void storeId

  const skuPageSize = Math.min(100, Math.max(1, Number(limit) || 30))
  const query = new URLSearchParams()
  if (search?.trim()) query.set('search', search.trim())
  query.set('page', '1')
  query.set('pageSize', String(skuPageSize))
  query.set('isActive', 'true')

  const [data, productItems] = await Promise.all([
    apiRequestAuth(`/api/v1/skus?${query.toString()}`, { method: 'GET' }),
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
    const stocks = await apiRequestAuth('/api/v1/inventory/sku-stocks', { method: 'GET' })
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
      if (!product) return null
      return mapPosProduct({
      productId: sku.id ?? sku.Id,
      sku: sku.skuCode ?? sku.SkuCode,
      productName: sku.productName ?? sku.ProductName ?? product?.name ?? product?.Name ?? '',
      packagingType: sku.packagingType ?? sku.PackagingType ?? '',
      price: sku.basePrice ?? sku.BasePrice,
      stockQuantity: stockBySkuId.get(sku.id ?? sku.Id) ?? 0,
      imageUrl: sku.imageUrl ?? sku.ImageUrl ?? '',
      categoryId: product?.categoryId ?? product?.CategoryId ?? null,
      categoryName: sku.categoryName ?? sku.CategoryName ?? product?.categoryName ?? product?.CategoryName ?? '',
    })
    })
    .filter(Boolean)
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
