import { getPosWorkspace, savePosWorkspace } from '../../../lib/offlineDb.js'

const EMPTY_BY_MODE = {
  counter: 'CASH',
  takeaway: 'COD',
}

export function createEmptyPersistedPosSession(mode = 'counter') {
  return {
    searchValue: '',
    cartItems: [],
    customBundles: [],
    orderDiscountPercent: 0,
    orderDiscountAmountFixed: 0,
    promoCodeInput: '',
    appliedPromotion: null,
    selectedCustomer: null,
    customerSearchValue: '',
    customerSearchType: '',
    paymentMethod: EMPTY_BY_MODE[mode] || 'CASH',
    amountPaidInput: '',
    transferAmountInput: '',
    overpaymentAction: 'return_change',
    debtSettlement: null,
    shippingAddress: '',
    orderNote: '',
    pendingQrOrderId: null,
  }
}

function minimalCustomer(customer) {
  if (!customer?.customerId) return null
  return {
    customerId: customer.customerId,
    customerCode: customer.customerCode ?? '',
    fullName: customer.fullName ?? '',
    phone: customer.phone ?? '',
    customerType: customer.customerType ?? '',
    tierId: customer.tierId ?? null,
    tierCode: customer.tierCode ?? null,
    tierName: customer.tierName ?? null,
    tierDiscountPercent: Number(customer.tierDiscountPercent || 0),
    currentDebt: Number(customer.currentDebt || 0),
    address: customer.address ?? '',
  }
}

function minimalPromotion(promotion) {
  if (!promotion) return null
  return {
    id: promotion.id ?? null,
    promoCode: promotion.promoCode ?? '',
    promoName: promotion.promoName ?? '',
    discountType: promotion.discountType ?? '',
    discountValue: Number(promotion.discountValue || 0),
    maxDiscountAmount: Number(promotion.maxDiscountAmount || 0),
    minimumOrderAmount: Number(promotion.minimumOrderAmount || 0),
    discountAmount: Number(promotion.discountAmount || 0),
  }
}

function sanitizeCartItem(item) {
  return {
    productId: item.productId ?? item.skuId ?? null,
    sku: item.sku ?? '',
    productName: item.productName ?? '',
    packagingType: item.packagingType ?? '',
    name: item.name ?? '',
    qty: Number(item.qty || 0),
    step: Number(item.step || 1),
    price: Number(item.price || 0),
    costPrice: Number(item.costPrice || 0),
    stockQuantity: Number(item.stockQuantity || 0),
    inventoryUnit: item.inventoryUnit ?? '',
    priceUnit: item.priceUnit ?? '',
    unit: item.unit ?? '',
    categoryId: item.categoryId ?? null,
    categoryName: item.categoryName ?? '',
    imageUrl: item.imageUrl ?? '',
    isGift: Boolean(item.isGift),
    lineDiscountType: item.lineDiscountType ?? 'percent',
    lineDiscountValue: Number(item.lineDiscountValue || 0),
    isUnavailable: Boolean(item.isUnavailable),
  }
}

function sanitizeSession(session, mode) {
  const base = createEmptyPersistedPosSession(mode)
  return {
    ...base,
    searchValue: String(session?.searchValue || ''),
    cartItems: Array.isArray(session?.cartItems)
      ? session.cartItems.map(sanitizeCartItem).filter((item) => item.productId && item.qty > 0)
      : [],
    customBundles: Array.isArray(session?.customBundles) ? session.customBundles : [],
    orderDiscountPercent: Number(session?.orderDiscountPercent || 0),
    orderDiscountAmountFixed: Number(session?.orderDiscountAmountFixed || 0),
    promoCodeInput: String(session?.promoCodeInput || ''),
    appliedPromotion: minimalPromotion(session?.appliedPromotion),
    selectedCustomer: minimalCustomer(session?.selectedCustomer),
    customerSearchValue: String(session?.customerSearchValue || ''),
    customerSearchType: String(session?.customerSearchType || ''),
    paymentMethod: String(session?.paymentMethod || base.paymentMethod),
    amountPaidInput: String(session?.amountPaidInput || ''),
    transferAmountInput: String(session?.transferAmountInput || ''),
    overpaymentAction: String(session?.overpaymentAction || 'return_change'),
    debtSettlement: session?.debtSettlement ?? null,
    shippingAddress: String(session?.shippingAddress || ''),
    orderNote: String(session?.orderNote || ''),
    pendingQrOrderId: session?.pendingQrOrderId ?? null,
  }
}

function normalizeModeWorkspace(value, mode) {
  const rawTabs = Array.isArray(value?.tabs) ? value.tabs : []
  const uniqueTabs = rawTabs
    .filter((tab) => Number.isFinite(Number(tab?.id)))
    .map((tab) => ({ id: Number(tab.id), label: String(tab.label || 'Khách lẻ') }))
    .filter((tab, index, rows) => rows.findIndex((row) => row.id === tab.id) === index)
  const tabs = uniqueTabs.length ? uniqueTabs : [{ id: 1, label: 'Khách lẻ' }]
  const sessions = Object.fromEntries(tabs.map((tab) => [
    tab.id,
    sanitizeSession(value?.sessions?.[tab.id] ?? value?.sessions?.[String(tab.id)], mode),
  ]))
  const requestedActiveId = Number(value?.activeTabId)
  return {
    tabs,
    sessions,
    activeTabId: tabs.some((tab) => tab.id === requestedActiveId)
      ? requestedActiveId
      : tabs[0].id,
  }
}

export function normalizePosWorkspaceRecord(record) {
  return {
    salesMode: record?.salesMode === 'takeaway' ? 'takeaway' : 'counter',
    workspaceByMode: {
      counter: normalizeModeWorkspace(record?.workspaceByMode?.counter, 'counter'),
      takeaway: normalizeModeWorkspace(record?.workspaceByMode?.takeaway, 'takeaway'),
    },
    restoredOrderIds: Array.isArray(record?.restoredOrderIds)
      ? [...new Set(record.restoredOrderIds.filter(Boolean).map(String))]
      : [],
  }
}

export async function loadPersistedPosWorkspace(userId) {
  return normalizePosWorkspaceRecord(await getPosWorkspace(userId))
}

export async function persistPosWorkspace(userId, value) {
  if (!userId) return
  const normalized = normalizePosWorkspaceRecord(value)
  await savePosWorkspace(userId, normalized)
}

export async function findPersistedPendingPosCart(userId, orderId) {
  if (!userId || !orderId) return null
  const targetOrderId = String(orderId)
  const current = await loadPersistedPosWorkspace(userId)

  for (const mode of ['counter', 'takeaway']) {
    const modeWorkspace = current.workspaceByMode[mode]
    const tab = modeWorkspace.tabs.find((candidate) =>
      String(modeWorkspace.sessions[candidate.id]?.pendingQrOrderId || '') === targetOrderId)
    if (tab) {
      return {
        workspaceMode: mode,
        workspaceTabId: tab.id,
        orderLabel: tab.label,
        sessionSnapshot: modeWorkspace.sessions[tab.id],
      }
    }
  }

  return null
}

function removeCart(modeWorkspace, tabId, mode) {
  const remainingTabs = modeWorkspace.tabs.filter((tab) => tab.id !== Number(tabId))
  const sessions = { ...modeWorkspace.sessions }
  delete sessions[tabId]
  const nextId = modeWorkspace.tabs.length
    ? Math.max(...modeWorkspace.tabs.map((tab) => tab.id)) + 1
    : 1
  const cleanTab = { id: nextId, label: 'Khách lẻ' }
  return {
    tabs: [...remainingTabs, cleanTab],
    sessions: {
      ...sessions,
      [nextId]: createEmptyPersistedPosSession(mode),
    },
    activeTabId: nextId,
  }
}

export async function completePersistedPosCart(userId, mode, tabId) {
  if (!userId) return
  const current = await loadPersistedPosWorkspace(userId)
  const selectedMode = mode === 'takeaway' ? 'takeaway' : 'counter'
  current.workspaceByMode[selectedMode] = removeCart(
    current.workspaceByMode[selectedMode],
    tabId,
    selectedMode,
  )
  await persistPosWorkspace(userId, current)
}

function sessionFromCancelledOrder(order) {
  const session = createEmptyPersistedPosSession('counter')
  session.cartItems = (order?.items || []).map((item) => sanitizeCartItem({
    productId: item.skuId,
    sku: item.skuSnapshotCode,
    name: item.skuSnapshotName,
    productName: item.skuSnapshotName,
    qty: item.quantity,
    step: 1,
    price: item.unitPrice,
    isGift: item.isGift,
    isUnavailable: true,
  }))
  session.selectedCustomer = order?.customerId
    ? {
        customerId: order.customerId,
        fullName: order.customerSnapshotName || '',
      }
    : null
  session.orderNote = order?.note || ''
  session.shippingAddress = order?.shippingAddress || ''
  session.promoCodeInput = order?.promotionCode || ''
  return session
}

export async function restoreCancelledOrderCart(
  userId,
  {
    order,
    mode = 'counter',
    tabId = null,
    sessionSnapshot = null,
  },
) {
  if (!userId || !order?.id) return
  const orderId = String(order.id)
  const selectedMode = mode === 'takeaway' ? 'takeaway' : 'counter'
  const current = await loadPersistedPosWorkspace(userId)
  const modeWorkspace = current.workspaceByMode[selectedMode]
  let targetTab = modeWorkspace.tabs.find((tab) =>
    String(modeWorkspace.sessions[tab.id]?.pendingQrOrderId || '') === orderId)

  if (!targetTab && current.restoredOrderIds.includes(orderId))
    return

  if (!targetTab && tabId != null) {
    targetTab = modeWorkspace.tabs.find((tab) => tab.id === Number(tabId))
  }

  if (!targetTab) {
    const nextId = modeWorkspace.tabs.length
      ? Math.max(...modeWorkspace.tabs.map((tab) => tab.id)) + 1
      : 1
    targetTab = { id: nextId, label: order.customerSnapshotName || 'Khách lẻ' }
    modeWorkspace.tabs.push(targetTab)
  }

  const restoredSession = sanitizeSession(
    sessionSnapshot || modeWorkspace.sessions[targetTab.id] || sessionFromCancelledOrder(order),
    selectedMode,
  )
  restoredSession.pendingQrOrderId = null
  modeWorkspace.sessions[targetTab.id] = restoredSession
  modeWorkspace.activeTabId = targetTab.id
  current.salesMode = selectedMode
  current.restoredOrderIds = [...new Set([...current.restoredOrderIds, orderId])]
  await persistPosWorkspace(userId, current)
}
