import Dexie from 'dexie'

export const db = new Dexie('hvt_offline')

db.version(1).stores({
  products:     'skuId, skuCode, isActive, productType, cachedAt',
  customers:    'customerId, phone, cachedAt',
  sync_queue:   '++id, type, status, createdAt',
  draft_orders: 'tempId, status, createdAt',
  app_meta:     'key',
})

db.version(2).stores({
  products:       'skuId, skuCode, isActive, productType, cachedAt',
  customers:      'customerId, phone, cachedAt',
  sync_queue:     '++id, type, status, createdAt',
  draft_orders:   'tempId, status, createdAt',
  app_meta:       'key',
  pos_workspaces: 'userId, updatedAt',
})

// v3 only adds queue metadata. Stock reservations live with the cached SKU so a
// second offline checkout on this device cannot spend the same shelf quantity.
db.version(3).stores({
  products:       'skuId, skuCode, isActive, productType, cachedAt',
  customers:      'customerId, phone, cachedAt',
  sync_queue:     '++id, type, status, createdAt, tempId',
  draft_orders:   'tempId, status, createdAt',
  app_meta:       'key',
  pos_workspaces: 'userId, updatedAt',
})

// ── app_meta helpers ────────────────────────────────────────────────────────

export async function getMeta(key) {
  const row = await db.app_meta.get(key)
  return row?.value ?? null
}

export async function setMeta(key, value) {
  await db.app_meta.put({ key, value })
}

// ── products ────────────────────────────────────────────────────────────────

export async function cacheProducts(products) {
  const now = Date.now()
  await db.transaction('rw', db.products, db.app_meta, async () => {
    // A network refresh can race the reconnect queue. Preserve pending local
    // reservations so a stale/partial refresh never makes stock sellable twice.
    const cached = await db.products.bulkGet(products.map(p => p.skuId))
    await db.products.bulkPut(products.map((p, index) => ({
      ...p,
      offlineReservedQuantity: Number(cached[index]?.offlineReservedQuantity ?? 0),
      cachedAt: now,
    })))
    await db.app_meta.put({ key: 'lastProductSync', value: now })
  })
}

export async function getProductsFromCache(search = '', limit = 80) {
  let query = db.products.where('isActive').equals(1)
  const all = await query.toArray()
  if (!search) return all.slice(0, limit)
  const q = search.toLowerCase()
  return all
    .filter(p => p.skuCode?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q))
    .slice(0, limit)
}

// ── customers ───────────────────────────────────────────────────────────────

export async function cacheCustomers(customers) {
  const now = Date.now()
  await db.transaction('rw', db.customers, db.app_meta, async () => {
    await db.customers.clear()
    if (customers.length > 0) {
      await db.customers.bulkPut(customers.map(c => ({ ...c, cachedAt: now })))
    }
    await db.app_meta.put({ key: 'lastCustomerSync', value: now })
  })
}

export async function getCustomerByPhone(phone) {
  return db.customers.where('phone').equals(phone).first()
}

export async function searchCustomersFromCache(query, limit = 20) {
  const q = query.toLowerCase()
  const phoneQuery = query.replace(/\D/g, '')
  const all = await db.customers.toArray()
  return all
    .filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.customerCode?.toLowerCase().includes(q) ||
      (phoneQuery.length > 0 && c.phone?.includes(phoneQuery))
    )
    .slice(0, limit)
}

// ── sync_queue ───────────────────────────────────────────────────────────────

export async function enqueue(type, payload, idempotencyKey) {
  await db.sync_queue.add({
    type,
    payload,
    idempotencyKey,
    status: 'PENDING',
    createdAt: Date.now(),
    retries: 0,
    lastError: null,
  })
  const count = await db.sync_queue.where('status').anyOf(['PENDING', 'PROCESSING']).count()
  await setMeta('pendingSyncCount', count)
  window.dispatchEvent(new CustomEvent('hvt-sync-queue-changed', { detail: { remaining: count } }))
}

/**
 * Persist an offline CASH POS order and reserve its cached Shelf stock in one
 * IndexedDB transaction. This is intentionally narrow: it is not a generic
 * offline queue for COD, VietQR, debt, promotion, or BOM/custom bundles.
 */
export async function enqueueOfflineCashPosOrder({ tempId, payload, idempotencyKey }) {
  const requestedBySku = new Map()
  for (const line of payload?.items ?? []) {
    const skuId = String(line?.skuId ?? '')
    const quantity = Number(line?.quantity ?? 0)
    if (!skuId || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Đơn offline có dòng hàng không hợp lệ.')
    }
    requestedBySku.set(skuId, (requestedBySku.get(skuId) ?? 0) + quantity)
  }
  if (!requestedBySku.size) throw new Error('Đơn offline không có sản phẩm để kiểm tra tồn Kệ.')

  await db.transaction('rw', db.products, db.sync_queue, db.draft_orders, db.app_meta, async () => {
    for (const [skuId, requested] of requestedBySku) {
      const product = await db.products.get(skuId)
      const cachedQuantity = Number(product?.qtyOnHand)
      const reservedQuantity = Number(product?.offlineReservedQuantity ?? 0)
      const available = cachedQuantity - reservedQuantity
      if (!product || !Number.isFinite(cachedQuantity) || requested > available) {
        throw new Error(`Tồn Kệ offline không đủ hoặc chưa được tải cho SKU ${skuId}. Kết nối mạng để đồng bộ trước khi bán.`)
      }
      await db.products.update(skuId, { offlineReservedQuantity: reservedQuantity + requested })
    }

    const createdAt = Date.now()
    await db.draft_orders.put({ tempId, status: 'PENDING_SYNC', payload, createdAt })
    await db.sync_queue.add({
      type: 'CREATE_ORDER',
      payload,
      idempotencyKey,
      tempId,
      status: 'PENDING',
      createdAt,
      retries: 0,
      lastError: null,
    })
    const count = await db.sync_queue.where('status').anyOf(['PENDING', 'PROCESSING']).count()
    await db.app_meta.put({ key: 'pendingSyncCount', value: count })
  })

  const count = await getPendingCount()
  window.dispatchEvent(new CustomEvent('hvt-sync-queue-changed', { detail: { remaining: count } }))
}

/** Keep the cached shelf balance conservative after the server confirms a queued sale. */
export async function commitOfflineCashPosStock(items = []) {
  await db.transaction('rw', db.products, async () => {
    for (const line of items) {
      const skuId = String(line?.skuId ?? '')
      const quantity = Number(line?.quantity ?? 0)
      const product = skuId ? await db.products.get(skuId) : null
      if (!product || !Number.isFinite(quantity) || quantity <= 0) continue
      const reserved = Number(product.offlineReservedQuantity ?? 0)
      await db.products.update(skuId, {
        qtyOnHand: Math.max(0, Number(product.qtyOnHand ?? 0) - quantity),
        offlineReservedQuantity: Math.max(0, reserved - quantity),
      })
    }
  })
}

export async function getPendingQueue() {
  return db.sync_queue
    .where('status').equals('PENDING')
    .sortBy('createdAt')
}

export async function updateQueueItem(id, changes) {
  await db.sync_queue.update(id, changes)
}

export async function getPendingCount() {
  return db.sync_queue.where('status').anyOf(['PENDING', 'PROCESSING']).count()
}

// ── draft_orders ─────────────────────────────────────────────────────────────

export async function saveDraftOrder(order) {
  await db.draft_orders.put(order)
}

export async function getDraftOrder(tempId) {
  return db.draft_orders.get(tempId)
}

export async function updateDraftOrder(tempId, changes) {
  await db.draft_orders.update(tempId, changes)
}

// ── POS workspace (isolated by authenticated UserId) ───────────────────────

export async function getPosWorkspace(userId) {
  if (!userId) return null
  return db.pos_workspaces.get(String(userId))
}

export async function savePosWorkspace(userId, workspace) {
  if (!userId) return
  await db.pos_workspaces.put({
    ...workspace,
    userId: String(userId),
    updatedAt: Date.now(),
  })
}
