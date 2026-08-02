import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import {
  getStockFlowStatusClass,
  getStockRequestLineStatusLabel,
  getStockRequestStatusLabel,
} from '../utils/stockFlowLabels.js'

function mapRequestItem(row) {
  const requested = Number(row.requestedQuantity ?? row.RequestedQuantity ?? row.quantityDelta ?? row.QuantityDelta ?? 0)
  const fulfilled = Number(row.fulfilledQuantity ?? row.FulfilledQuantity ?? 0)
  const rejected = Number(row.rejectedQuantity ?? row.RejectedQuantity ?? 0)
  const remainingRaw = row.remainingQuantity ?? row.RemainingQuantity
  const approved = Number(row.approvedQuantity ?? row.ApprovedQuantity ?? 0)
  const draftReserved = Number(row.draftReservedQuantity ?? row.DraftReservedQuantity ?? 0)
  return {
    id: row.id ?? row.Id,
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    skuSnapshotName: row.skuSnapshotName ?? row.SkuSnapshotName ?? '',
    quantityDelta: Number(row.quantityDelta ?? row.QuantityDelta ?? 0),
    requestedQuantity: requested,
    approvedQuantity: approved,
    fulfilledQuantity: fulfilled,
    rejectedQuantity: rejected,
    remainingQuantity: Number(remainingRaw ?? Math.max(0, requested - fulfilled - rejected)),
    draftReservedQuantity: draftReserved,
    availableToTransferQuantity: Number(
      row.availableToTransferQuantity
      ?? row.AvailableToTransferQuantity
      ?? Math.max(0, approved - fulfilled - draftReserved),
    ),
    status: String(row.status ?? row.Status ?? 'pending').toLowerCase(),
    reviewNote: row.reviewNote ?? row.ReviewNote ?? '',
    rejectionReason: row.rejectionReason ?? row.RejectionReason ?? '',
    closedReason: row.closedReason ?? row.ClosedReason ?? '',
    quantityOnHandSnapshot: Number(row.quantityOnHandSnapshot ?? row.QuantityOnHandSnapshot ?? 0),
    quantityOnHandAfter: row.quantityOnHandAfter ?? row.QuantityOnHandAfter ?? null,
    warehouseQuantityOnHandAfter:
      row.warehouseQuantityOnHandAfter ?? row.WarehouseQuantityOnHandAfter ?? null,
    exportSlipId: row.exportSlipId ?? row.ExportSlipId ?? null,
    exportSlipCode: row.exportSlipCode ?? row.ExportSlipCode ?? '',
  }
}

/** Dòng đã kết thúc xử lý; dùng cho cột Tiến độ và Còn thiếu (đếm theo dòng, không cộng số lượng). */
const CLOSED_LINE_STATUSES = new Set(['fulfilled', 'rejected', 'closedpartial', 'cancelled'])


function mapRequest(row) {
  const items = (row.items ?? row.Items ?? []).map(mapRequestItem)
  const sum = (selector) => items.reduce((total, item) => total + selector(item), 0)
  return {
    id: row.id ?? row.Id,
    requestCode: row.requestCode ?? row.RequestCode ?? '',
    reason: row.reason ?? row.Reason ?? '',
    status: String(row.status ?? row.Status ?? '').toLowerCase(),
    requestedBy: row.requestedBy ?? row.RequestedBy,
    requestedAt: row.requestedAt ?? row.RequestedAt ?? null,
    requestedByName: row.requestedByName ?? row.RequestedByName ?? '',
    requestedByRoleName: row.requestedByRoleName ?? row.RequestedByRoleName ?? '',
    reviewedBy: row.reviewedBy ?? row.ReviewedBy ?? null,
    reviewedAt: row.reviewedAt ?? row.ReviewedAt ?? null,
    reviewedByName: row.reviewedByName ?? row.ReviewedByName ?? '',
    reviewedByRoleName: row.reviewedByRoleName ?? row.ReviewedByRoleName ?? '',
    reviewNote: row.reviewNote ?? row.ReviewNote ?? '',
    items,
    itemCount: items.length,
    totalRequestedQuantity: Number(row.totalRequestedQuantity ?? row.TotalRequestedQuantity ?? sum((i) => i.requestedQuantity)),
    totalApprovedQuantity: Number(row.totalApprovedQuantity ?? row.TotalApprovedQuantity ?? sum((i) => i.approvedQuantity)),
    totalFulfilledQuantity: Number(row.totalFulfilledQuantity ?? row.TotalFulfilledQuantity ?? sum((i) => i.fulfilledQuantity)),
    totalRejectedQuantity: Number(row.totalRejectedQuantity ?? row.TotalRejectedQuantity ?? sum((i) => i.rejectedQuantity)),
    totalRemainingQuantity: Number(row.totalRemainingQuantity ?? row.TotalRemainingQuantity ?? sum((i) => i.remainingQuantity)),
    totalAvailableToTransferQuantity: Number(
      row.totalAvailableToTransferQuantity
      ?? row.TotalAvailableToTransferQuantity
      ?? sum((i) => i.availableToTransferQuantity),
    ),
    // Tiến độ và Còn thiếu đếm theo số dòng sản phẩm, không cộng tổng số lượng khác đơn vị.
    processedItemCount: items.filter((item) => CLOSED_LINE_STATUSES.has(item.status)).length,
    remainingItemCount: items.filter(
      (item) => !CLOSED_LINE_STATUSES.has(item.status) && item.remainingQuantity > 0,
    ).length,
    totalDelta: sum((item) => item.quantityDelta),
    hasIncrease: items.some((item) => item.quantityDelta > 0),
    hasDecrease: items.some((item) => item.quantityDelta < 0),
    exportSlipCodes: items.map((item) => item.exportSlipCode).filter(Boolean),
  }
}

function mapRelatedTransfer(row) {
  return {
    transferId: row.transferId ?? row.TransferId,
    transferCode: row.transferCode ?? row.TransferCode ?? '',
    status: String(row.status ?? row.Status ?? '').toLowerCase(),
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    completedAt: row.completedAt ?? row.CompletedAt ?? null,
    createdByName: row.createdByName ?? row.CreatedByName ?? '',
    totalQuantity: Number(row.totalQuantity ?? row.TotalQuantity ?? 0),
    lines: (row.lines ?? row.Lines ?? []).map((line) => ({
      lineId: line.lineId ?? line.LineId,
      sourceRequestLineId: line.sourceRequestLineId ?? line.SourceRequestLineId ?? null,
      skuId: line.skuId ?? line.SkuId,
      skuCode: line.skuCode ?? line.SkuCode ?? '',
      skuName: line.skuName ?? line.SkuName ?? '',
      quantity: Number(line.quantity ?? line.Quantity ?? 0),
    })),
  }
}

export function getAdjustmentStatusLabel(status) {
  return getStockRequestStatusLabel(status)
}

export function getAdjustmentLineStatusLabel(status) {
  return getStockRequestLineStatusLabel(status)
}

export function getAdjustmentStatusClass(status) {
  return getStockFlowStatusClass(status)
}

export async function fetchStockAdjustmentRequestById(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-adjustment-requests/${id}`, {
    method: 'GET',
  })
  return mapRequest(data)
}

export async function fetchStockAdjustmentRequests({
  status,
  mine,
  search,
  page = 1,
  pageSize = 10,
  createdBy,
  creatorRole,
  fromDate,
  toDate,
  onlyRemaining,
  sort,
} = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (mine) params.set('mine', 'true')
  if (search?.trim()) params.set('search', search.trim())
  if (createdBy) params.set('createdBy', createdBy)
  if (creatorRole?.trim()) params.set('creatorRole', creatorRole.trim())
  if (fromDate) params.set('fromDate', fromDate)
  if (toDate) params.set('toDate', toDate)
  if (onlyRemaining) params.set('onlyRemaining', 'true')
  if (sort?.trim()) params.set('sort', sort.trim())
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  const query = params.toString()
  const path = `/api/v1/inventory/stock-adjustment-requests${query ? `?${query}` : ''}`
  const data = await apiRequestAuth(path, { method: 'GET' })
  if (Array.isArray(data)) {
    return {
      items: data.map(mapRequest),
      page,
      pageSize,
      totalCount: data.length,
    }
  }

  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapRequest),
  }
}

/** Tùy chọn đổ vào bộ lọc màn hình audit: người tạo và vai trò người tạo đã có dữ liệu. */
export async function fetchStockAdjustmentRequestFilterOptions() {
  const data = await apiRequestAuth('/api/v1/inventory/stock-adjustment-requests/filter-options', {
    method: 'GET',
  })
  const creators = data?.creators ?? data?.Creators ?? []
  const creatorRoles = data?.creatorRoles ?? data?.CreatorRoles ?? []
  return {
    creators: creators.map((row) => ({
      id: row.id ?? row.Id,
      name: row.name ?? row.Name ?? '',
      roleName: row.roleName ?? row.RoleName ?? '',
    })),
    creatorRoles: creatorRoles.filter(Boolean),
  }
}

export async function createStockAdjustmentRequest(payload) {
  const data = await apiRequestAuth('/api/v1/inventory/stock-adjustment-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapRequest(data)
}

/** Kiểm tra trùng SKU trước khi gửi, để chặn sớm thay vì báo lỗi sau bước xác nhận. */
export async function checkStockAdjustmentDuplicates(skuIds) {
  const data = await apiRequestAuth('/api/v1/inventory/stock-adjustment-requests/check-duplicates', {
    method: 'POST',
    body: JSON.stringify({ skuIds }),
  })
  return {
    blocking: Boolean(data?.blocking),
    warning: Boolean(data?.warning),
    message: data?.message ?? '',
    duplicates: (data?.duplicates ?? []).map((row) => ({
      skuId: row.skuId,
      skuCode: row.skuCode ?? '',
      skuSnapshotName: row.skuSnapshotName ?? '',
      requestId: row.requestId,
      requestCode: row.requestCode ?? '',
      requestStatus: row.requestStatus ?? '',
      lineStatus: row.lineStatus ?? '',
      requestedAt: row.requestedAt,
      requestedByName: row.requestedByName ?? '',
      remainingQuantity: Number(row.remainingQuantity ?? 0),
      isUntouched: Boolean(row.isUntouched),
    })),
  }
}

/** Warehouse duyệt/từ chối theo từng dòng. Không làm thay đổi tồn kho. */
export async function reviewStockAdjustmentRequest(id, { reviewNote, lines } = {}) {
  const body = {
    reviewNote: reviewNote?.trim() || null,
    lines: (lines ?? []).map((line) => ({
      itemId: line.itemId,
      approved: Boolean(line.approved),
      approvedQuantity: line.approvedQuantity == null ? null : Number(line.approvedQuantity),
      note: line.note?.trim() || null,
    })),
  }
  const data = await apiRequestAuth(`/api/v1/inventory/stock-adjustment-requests/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return mapRequest(data)
}

/** Đóng phần còn lại khi Kho không thể cấp thêm; bắt buộc có lý do. */
export async function closeStockAdjustmentRemaining(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-adjustment-requests/${id}/close-remaining`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return mapRequest(data)
}

/** Danh sách Phiếu điều chuyển đã sinh ra từ yêu cầu này (một yêu cầu có thể có nhiều phiếu). */
export async function fetchStockAdjustmentRequestTransfers(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-adjustment-requests/${id}/transfers`, {
    method: 'GET',
  })
  return (Array.isArray(data) ? data : []).map(mapRelatedTransfer)
}

export async function rejectStockAdjustmentRequest(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-adjustment-requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return data
}

export async function cancelStockAdjustmentRequest(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-adjustment-requests/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return data
}
