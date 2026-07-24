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
  await db.products.bulkPut(products.map(p => ({ ...p, cachedAt: now })))
  await setMeta('lastProductSync', now)
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
