const STORAGE_KEY = 'hvt_mock_price_proposals_v1'

function nowIso() {
  return new Date().toISOString()
}

function seedRows() {
  return [
    {
      id: crypto.randomUUID(),
      skuCode: 'TRA-OL-100G',
      productName: 'Tra O Long dac biet 100g',
      currentRetailPrice: 95000,
      proposedRetailPrice: 105000,
      costPriceSnapshot: 62000,
      targetMarginPercent: 30,
      status: 'pending',
      reviewNote: null,
      requestedAt: nowIso(),
      requestedBy: 'accountant',
      reviewedAt: null,
    },
    {
      id: crypto.randomUUID(),
      skuCode: 'TRA-TQ-200G',
      productName: 'Tra Tiet Quan 200g',
      currentRetailPrice: 120000,
      proposedRetailPrice: 129000,
      costPriceSnapshot: 70000,
      targetMarginPercent: 30,
      status: 'approved',
      reviewNote: null,
      requestedAt: nowIso(),
      requestedBy: 'accountant',
      reviewedAt: nowIso(),
    },
  ]
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seeded = seedRows()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
      return seeded
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function getStatusLabel(status) {
  const map = {
    pending: 'Cho duyet',
    approved: 'Da duyet',
    rejected: 'Tu choi',
    cancelled: 'Da huy',
  }
  return map[String(status || '').toLowerCase()] || 'Khong ro'
}

export async function fetchPriceProposalsMock({ status, mine } = {}) {
  let items = readAll()
  if (status) items = items.filter((it) => it.status === status)
  if (mine) items = items.filter((it) => it.requestedBy === 'accountant')
  items.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
  return { items }
}

export async function createPriceProposalMock(payload) {
  const items = readAll()
  const row = {
    id: crypto.randomUUID(),
    skuCode: payload.skuCode,
    productName: payload.productName,
    currentRetailPrice: Number(payload.currentRetailPrice || 0),
    proposedRetailPrice: Number(payload.proposedRetailPrice || 0),
    costPriceSnapshot: Number(payload.costPriceSnapshot || 0),
    targetMarginPercent: Number(payload.targetMarginPercent || 0),
    status: 'pending',
    reviewNote: null,
    requestedAt: nowIso(),
    requestedBy: payload.requestedBy || 'accountant',
    reviewedAt: null,
  }
  items.unshift(row)
  writeAll(items)
  return row
}

export async function cancelPriceProposalMock(id) {
  const items = readAll()
  const next = items.map((it) =>
    it.id === id && it.status === 'pending'
      ? { ...it, status: 'cancelled', reviewedAt: nowIso() }
      : it,
  )
  writeAll(next)
}

export async function approvePriceProposalMock(id) {
  const items = readAll()
  const next = items.map((it) =>
    it.id === id && it.status === 'pending'
      ? { ...it, status: 'approved', reviewedAt: nowIso(), reviewNote: null }
      : it,
  )
  writeAll(next)
}

export async function rejectPriceProposalMock(id, reviewNote) {
  const items = readAll()
  const next = items.map((it) =>
    it.id === id && it.status === 'pending'
      ? { ...it, status: 'rejected', reviewedAt: nowIso(), reviewNote: reviewNote || null }
      : it,
  )
  writeAll(next)
}
