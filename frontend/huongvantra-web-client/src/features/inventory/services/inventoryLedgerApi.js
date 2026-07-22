import { apiRequestAuth } from '../../../lib/apiClient.js'

function mapLedgerEntry(row) {
  return {
    id: row.id ?? row.Id,
    transactionGroupId: row.transactionGroupId ?? row.TransactionGroupId,
    occurredAtUtc: row.occurredAtUtc ?? row.OccurredAtUtc ?? null,
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    skuNameSnapshot: row.skuNameSnapshot ?? row.SkuNameSnapshot ?? '',
    productTypeSnapshot: row.productTypeSnapshot ?? row.ProductTypeSnapshot ?? '',
    inventoryUnitSnapshot: row.inventoryUnitSnapshot ?? row.InventoryUnitSnapshot ?? '',
    location: row.location ?? row.Location ?? '',
    quantityBefore: Number(row.quantityBefore ?? row.QuantityBefore ?? 0),
    quantityDelta: Number(row.quantityDelta ?? row.QuantityDelta ?? 0),
    quantityAfter: Number(row.quantityAfter ?? row.QuantityAfter ?? 0),
    transactionType: row.transactionType ?? row.TransactionType ?? '',
    sourceLocation: row.sourceLocation ?? row.SourceLocation ?? '',
    destinationLocation: row.destinationLocation ?? row.DestinationLocation ?? '',
    referenceType: row.referenceType ?? row.ReferenceType ?? '',
    referenceId: row.referenceId ?? row.ReferenceId ?? null,
    referenceCode: row.referenceCode ?? row.ReferenceCode ?? '',
    batchId: row.batchId ?? row.BatchId ?? null,
    lotCode: row.lotCode ?? row.LotCode ?? '',
    actorId: row.actorId ?? row.ActorId ?? null,
    actorName: row.actorName ?? row.ActorName ?? '',
    actorRole: row.actorRole ?? row.ActorRole ?? '',
    reason: row.reason ?? row.Reason ?? '',
    note: row.note ?? row.Note ?? '',
    correlationId: row.correlationId ?? row.CorrelationId ?? '',
  }
}

export async function fetchInventoryLedger({
  search,
  skuId,
  location,
  transactionType,
  referenceCode,
  actorId,
  fromUtc,
  toUtc,
  page = 1,
  pageSize = 20,
} = {}) {
  const params = new URLSearchParams()
  if (search?.trim()) params.set('search', search.trim())
  if (skuId) params.set('skuId', skuId)
  if (location) params.set('location', location)
  if (transactionType) params.set('transactionType', transactionType)
  if (referenceCode?.trim()) params.set('referenceCode', referenceCode.trim())
  if (actorId) params.set('actorId', actorId)
  if (fromUtc) params.set('fromUtc', fromUtc)
  if (toUtc) params.set('toUtc', toUtc)
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  const data = await apiRequestAuth(`/api/v1/inventory/ledger?${params.toString()}`, { method: 'GET' })
  return {
    items: (data.items ?? data.Items ?? []).map(mapLedgerEntry),
    page: Number(data.page ?? data.Page ?? page),
    pageSize: Number(data.pageSize ?? data.PageSize ?? pageSize),
    totalItems: Number(data.totalItems ?? data.TotalItems ?? 0),
    totalPages: Number(data.totalPages ?? data.TotalPages ?? 1),
  }
}
