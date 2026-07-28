import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function mapStocktakeLine(row) {
  if (!row || typeof row !== 'object') return null
  return {
    id: row.id ?? row.Id,
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    skuSnapshotName: row.skuSnapshotName ?? row.SkuSnapshotName ?? '',
    productTypeSnapshot: row.productTypeSnapshot ?? row.ProductTypeSnapshot ?? '',
    inventoryUnitSnapshot: row.inventoryUnitSnapshot ?? row.InventoryUnitSnapshot ?? '',
    systemQuantitySnapshot: Number(row.systemQuantitySnapshot ?? row.SystemQuantitySnapshot ?? 0),
    actualQuantity: Number(row.actualQuantity ?? row.ActualQuantity ?? 0),
    variance: Number(row.variance ?? row.Variance ?? 0),
    reasonCode: row.reasonCode ?? row.ReasonCode ?? '',
    note: row.note ?? row.Note ?? '',
    warehouseQtyBefore: row.warehouseQtyBefore ?? row.WarehouseQtyBefore ?? null,
    warehouseQtyAfter: row.warehouseQtyAfter ?? row.WarehouseQtyAfter ?? null,
    shelfQtyBefore: row.shelfQtyBefore ?? row.ShelfQtyBefore ?? null,
    shelfQtyAfter: row.shelfQtyAfter ?? row.ShelfQtyAfter ?? null,
    stockExportSlipId: row.stockExportSlipId ?? row.StockExportSlipId ?? null,
    stockExportSlipCode: row.stockExportSlipCode ?? row.StockExportSlipCode ?? '',
    stockImportSlipId: row.stockImportSlipId ?? row.StockImportSlipId ?? null,
    stockImportSlipCode: row.stockImportSlipCode ?? row.StockImportSlipCode ?? '',
    warehouseBatchId: row.warehouseBatchId ?? row.WarehouseBatchId ?? null,
    warehouseBatchLotCode: row.warehouseBatchLotCode ?? row.WarehouseBatchLotCode ?? '',
  }
}

export function mapStocktakeRequest(row) {
  if (!row || typeof row !== 'object') return null
  const items = (row.items ?? row.Items ?? []).map(mapStocktakeLine).filter(Boolean)
  return {
    id: row.id ?? row.Id,
    requestCode: row.requestCode ?? row.RequestCode ?? '',
    location: row.location ?? row.Location ?? 'Warehouse',
    countDate: row.countDate ?? row.CountDate ?? null,
    reason: row.reason ?? row.Reason ?? '',
    note: row.note ?? row.Note ?? '',
    status: row.status ?? row.Status ?? '',
    createdBy: row.createdBy ?? row.CreatedBy ?? null,
    createdByName: row.createdByName ?? row.CreatedByName ?? '',
    createdByRoleName: row.createdByRoleName ?? row.CreatedByRoleName ?? '',
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    updatedAt: row.updatedAt ?? row.UpdatedAt ?? null,
    submittedBy: row.submittedBy ?? row.SubmittedBy ?? null,
    submittedAt: row.submittedAt ?? row.SubmittedAt ?? null,
    reviewedBy: row.reviewedBy ?? row.ReviewedBy ?? null,
    reviewedByName: row.reviewedByName ?? row.ReviewedByName ?? '',
    reviewedByRoleName: row.reviewedByRoleName ?? row.ReviewedByRoleName ?? '',
    reviewedAt: row.reviewedAt ?? row.ReviewedAt ?? null,
    reviewNote: row.reviewNote ?? row.ReviewNote ?? '',
    totalPositiveVariance: Number(row.totalPositiveVariance ?? row.TotalPositiveVariance ?? 0),
    totalNegativeVariance: Number(row.totalNegativeVariance ?? row.TotalNegativeVariance ?? 0),
    totalAbsoluteVariance: Number(row.totalAbsoluteVariance ?? row.TotalAbsoluteVariance ?? 0),
    items,
  }
}

export async function fetchStocktakeRequests(params = {}) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.location) query.set('location', params.location)
  if (params.mine) query.set('mine', 'true')
  if (params.search?.trim()) query.set('search', params.search.trim())
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 10))
  const data = await apiRequestAuth(`/api/v1/inventory/stocktake-requests?${query.toString()}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapStocktakeRequest).filter(Boolean),
  }
}

export async function fetchStocktakeRequestById(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stocktake-requests/${id}`, { method: 'GET' })
  return mapStocktakeRequest(data)
}

/** Trạng thái kiểm kê kệ đầu/cuối ngày (toàn cửa hàng). */
export async function fetchShelfDayStocktakeStatus(date) {
  const { vietnamTodayDateInput } = await import('../../pos/utils/submitDailyShelfStocktake.js')
  const day = date || vietnamTodayDateInput()
  const query = new URLSearchParams()
  if (day) query.set('date', day)
  const qs = query.toString()
  try {
    const data = await apiRequestAuth(
      `/api/v1/inventory/stocktake-requests/shelf-day-status${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
    )
    return {
      date: String(data?.date ?? data?.Date ?? day).slice(0, 10),
      dayStartDone: Boolean(data?.dayStartDone ?? data?.DayStartDone),
      dayEndDone: Boolean(data?.dayEndDone ?? data?.DayEndDone),
      dayStartId: data?.dayStartId ?? data?.DayStartId ?? null,
      dayStartRequestCode: data?.dayStartRequestCode ?? data?.DayStartRequestCode ?? '',
      dayEndId: data?.dayEndId ?? data?.DayEndId ?? null,
      dayEndRequestCode: data?.dayEndRequestCode ?? data?.DayEndRequestCode ?? '',
    }
  } catch {
    // Fallback khi BE chưa có endpoint: suy ra từ danh sách phiếu Shelf của mình.
    return fetchShelfDayStocktakeStatusFallback(day)
  }
}

async function fetchShelfDayStocktakeStatusFallback(day) {
  const { vietnamTodayDateInput, SHELF_DAY_START_REASON, SHELF_DAY_END_REASON } = await import(
    '../../pos/utils/submitDailyShelfStocktake.js'
  )
  const today = day || vietnamTodayDateInput()
  const paged = await fetchStocktakeRequests({
    location: 'Shelf',
    mine: true,
    page: 1,
    pageSize: 50,
  })
  const items = paged.items || []
  const active = items.filter((row) => {
    const status = String(row.status || '')
    return status === 'PendingApproval' || status === 'Completed' || status === '1' || status === '2'
  })

  const isStart = (reason) => {
    const r = String(reason || '').toLowerCase()
    return r.includes('đầu ngày') || r.includes('dau ngay') || r.includes('đầu ca') || r.includes('dau ca')
      || String(reason || '').includes(SHELF_DAY_START_REASON)
  }
  const isEnd = (reason) => {
    const r = String(reason || '').toLowerCase()
    return r.includes('cuối ngày') || r.includes('cuoi ngay')
      || String(reason || '').includes(SHELF_DAY_END_REASON)
  }

  const sameDay = (row) => String(row.countDate || '').slice(0, 10) === today

  const dayStart = active.find((row) => isStart(row.reason) && sameDay(row))
  const dayEnd = active.find((row) => isEnd(row.reason) && sameDay(row))
  return {
    date: today,
    dayStartDone: Boolean(dayStart),
    dayEndDone: Boolean(dayEnd),
    dayStartId: dayStart?.id || null,
    dayStartRequestCode: dayStart?.requestCode || '',
    dayEndId: dayEnd?.id || null,
    dayEndRequestCode: dayEnd?.requestCode || '',
  }
}

/** Gộp status API với optimistic local — chỉ giữ optimistic trong cùng ngày VN. */
export function mergeShelfDayStatus(prev, status) {
  const apiDate = status?.date ? String(status.date).slice(0, 10) : null
  const prevDate = prev?.date ? String(prev.date).slice(0, 10) : null
  const sameDay = Boolean(apiDate && prevDate && apiDate === prevDate)

  return {
    ...status,
    date: apiDate || prevDate || null,
    dayStartDone: Boolean(status?.dayStartDone || (sameDay && prev?.dayStartDone)),
    dayEndDone: Boolean(status?.dayEndDone || (sameDay && prev?.dayEndDone)),
    dayStartId: status?.dayStartId ?? (sameDay ? prev?.dayStartId : null) ?? null,
    dayStartRequestCode: status?.dayStartRequestCode || (sameDay ? prev?.dayStartRequestCode : '') || '',
    dayEndId: status?.dayEndId ?? (sameDay ? prev?.dayEndId : null) ?? null,
    dayEndRequestCode: status?.dayEndRequestCode || (sameDay ? prev?.dayEndRequestCode : '') || '',
  }
}

export async function createStocktakeRequest(payload) {
  const data = await apiRequestAuth('/api/v1/inventory/stocktake-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapStocktakeRequest(data)
}

export async function submitStocktakeRequest(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stocktake-requests/${id}/submit`, { method: 'POST' })
  return mapStocktakeRequest(data)
}

export async function approveStocktakeRequest(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stocktake-requests/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return mapStocktakeRequest(data)
}

export async function rejectStocktakeRequest(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stocktake-requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return mapStocktakeRequest(data)
}

export async function cancelStocktakeRequest(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stocktake-requests/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return mapStocktakeRequest(data)
}

/** Manager/Admin mở lại ngày bán — hủy marker kiểm kệ cuối ngày. */
export async function reopenShelfDay(reason, date) {
  const { vietnamTodayDateInput } = await import('../../pos/utils/submitDailyShelfStocktake.js')
  const day = date || vietnamTodayDateInput()
  const query = new URLSearchParams()
  if (day) query.set('date', day)
  const data = await apiRequestAuth(
    `/api/v1/inventory/stocktake-requests/reopen-shelf-day?${query.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify({ reason: reason?.trim() || null }),
    },
  )
  return {
    date: String(data?.date ?? data?.Date ?? day).slice(0, 10),
    dayStartDone: Boolean(data?.dayStartDone ?? data?.DayStartDone),
    dayEndDone: Boolean(data?.dayEndDone ?? data?.DayEndDone),
    dayStartId: data?.dayStartId ?? data?.DayStartId ?? null,
    dayStartRequestCode: data?.dayStartRequestCode ?? data?.DayStartRequestCode ?? '',
    dayEndId: data?.dayEndId ?? data?.DayEndId ?? null,
    dayEndRequestCode: data?.dayEndRequestCode ?? data?.DayEndRequestCode ?? '',
  }
}
