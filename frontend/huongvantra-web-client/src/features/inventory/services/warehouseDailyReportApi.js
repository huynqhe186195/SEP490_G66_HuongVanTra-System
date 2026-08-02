import { apiRequestAuth } from '../../../lib/apiClient.js'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function mapOpenItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    code: raw.code ?? raw.Code ?? '',
    status: raw.status ?? raw.Status ?? '',
    timestampUtc: raw.timestampUtc ?? raw.TimestampUtc ?? null,
    actorName: raw.actorName ?? raw.ActorName ?? '',
  }
}

function mapReport(raw) {
  if (!raw || typeof raw !== 'object') return null
  const summary = raw.summary ?? raw.Summary ?? {}
  const snapshot = raw.endingSnapshot ?? raw.EndingSnapshot ?? {}
  const open = raw.openCarry ?? raw.OpenCarry ?? {}

  return {
    businessDate: raw.businessDate ?? raw.BusinessDate ?? '',
    timezone: raw.timezone ?? raw.Timezone ?? 'Asia/Ho_Chi_Minh',
    generatedAtUtc: raw.generatedAtUtc ?? raw.GeneratedAtUtc ?? null,
    summary: {
      supplierReceiptsCompleted: Number(summary.supplierReceiptsCompleted ?? summary.SupplierReceiptsCompleted ?? 0),
      productionOrdersCompleted: Number(summary.productionOrdersCompleted ?? summary.ProductionOrdersCompleted ?? 0),
      stockTransfersCompleted: Number(summary.stockTransfersCompleted ?? summary.StockTransfersCompleted ?? 0),
      stockAdjustmentReviews: Number(summary.stockAdjustmentReviews ?? summary.StockAdjustmentReviews ?? 0),
      stockDeductQueuesConfirmed: Number(summary.stockDeductQueuesConfirmed ?? summary.StockDeductQueuesConfirmed ?? 0),
      warehouseStocktakesCompleted: Number(summary.warehouseStocktakesCompleted ?? summary.WarehouseStocktakesCompleted ?? 0),
      ledgerMovementCount: Number(summary.ledgerMovementCount ?? summary.LedgerMovementCount ?? 0),
      openCarryCount: Number(summary.openCarryCount ?? summary.OpenCarryCount ?? 0),
    },
    supplierReceipts: asArray(raw.supplierReceipts ?? raw.SupplierReceipts).map((r) => ({
      id: String(r.id ?? r.Id ?? ''),
      code: r.code ?? r.Code ?? '',
      status: r.status ?? r.Status ?? '',
      receivedDate: r.receivedDate ?? r.ReceivedDate ?? null,
      completedAtUtc: r.completedAtUtc ?? r.CompletedAtUtc ?? null,
      actorName: r.actorName ?? r.ActorName ?? '',
      lineCount: Number(r.lineCount ?? r.LineCount ?? 0),
      totalAmount: Number(r.totalAmount ?? r.TotalAmount ?? 0),
    })),
    productionOrders: asArray(raw.productionOrders ?? raw.ProductionOrders).map((r) => ({
      id: String(r.id ?? r.Id ?? ''),
      code: r.code ?? r.Code ?? '',
      status: r.status ?? r.Status ?? '',
      completedAtUtc: r.completedAtUtc ?? r.CompletedAtUtc ?? null,
      actorName: r.actorName ?? r.ActorName ?? '',
      materialLineCount: Number(r.materialLineCount ?? r.MaterialLineCount ?? 0),
      outputLineCount: Number(r.outputLineCount ?? r.OutputLineCount ?? 0),
    })),
    stockTransfers: asArray(raw.stockTransfers ?? raw.StockTransfers).map((r) => ({
      id: String(r.id ?? r.Id ?? ''),
      code: r.code ?? r.Code ?? '',
      status: r.status ?? r.Status ?? '',
      completedAtUtc: r.completedAtUtc ?? r.CompletedAtUtc ?? null,
      actorName: r.actorName ?? r.ActorName ?? '',
      sourceRequestCode: r.sourceRequestCode ?? r.SourceRequestCode ?? '',
      skuCount: Number(r.skuCount ?? r.SkuCount ?? 0),
      totalQuantity: Number(r.totalQuantity ?? r.TotalQuantity ?? 0),
    })),
    stockAdjustmentReviews: asArray(raw.stockAdjustmentReviews ?? raw.StockAdjustmentReviews).map((r) => ({
      id: String(r.id ?? r.Id ?? ''),
      code: r.code ?? r.Code ?? '',
      status: r.status ?? r.Status ?? '',
      reviewedAtUtc: r.reviewedAtUtc ?? r.ReviewedAtUtc ?? null,
      reviewedByName: r.reviewedByName ?? r.ReviewedByName ?? '',
      itemCount: Number(r.itemCount ?? r.ItemCount ?? 0),
    })),
    stockDeductConfirmations: asArray(raw.stockDeductConfirmations ?? raw.StockDeductConfirmations).map((r) => ({
      queueId: String(r.queueId ?? r.QueueId ?? ''),
      orderId: String(r.orderId ?? r.OrderId ?? ''),
      orderCode: r.orderCode ?? r.OrderCode ?? '',
      confirmedAtUtc: r.confirmedAtUtc ?? r.ConfirmedAtUtc ?? null,
      confirmedByName: r.confirmedByName ?? r.ConfirmedByName ?? '',
    })),
    warehouseStocktakes: asArray(raw.warehouseStocktakes ?? raw.WarehouseStocktakes).map((r) => ({
      id: String(r.id ?? r.Id ?? ''),
      code: r.code ?? r.Code ?? '',
      status: r.status ?? r.Status ?? '',
      countDate: r.countDate ?? r.CountDate ?? null,
      reviewedAtUtc: r.reviewedAtUtc ?? r.ReviewedAtUtc ?? null,
      reviewedByName: r.reviewedByName ?? r.ReviewedByName ?? '',
      itemCount: Number(r.itemCount ?? r.ItemCount ?? 0),
    })),
    ledgerByType: asArray(raw.ledgerByType ?? raw.LedgerByType).map((r) => ({
      transactionType: r.transactionType ?? r.TransactionType ?? '',
      entryCount: Number(r.entryCount ?? r.EntryCount ?? 0),
      netQuantityDelta: Number(r.netQuantityDelta ?? r.NetQuantityDelta ?? 0),
    })),
    endingSnapshot: {
      totalSkuCount: Number(snapshot.totalSkuCount ?? snapshot.TotalSkuCount ?? 0),
      totalWarehouseQuantity: Number(snapshot.totalWarehouseQuantity ?? snapshot.TotalWarehouseQuantity ?? 0),
      lowStockSkuCount: Number(snapshot.lowStockSkuCount ?? snapshot.LowStockSkuCount ?? 0),
      totalWarehouseValue: Number(snapshot.totalWarehouseValue ?? snapshot.TotalWarehouseValue ?? 0),
      expiringBatchCount30Days: Number(snapshot.expiringBatchCount30Days ?? snapshot.ExpiringBatchCount30Days ?? 0),
      pendingDeductQueueCount: Number(snapshot.pendingDeductQueueCount ?? snapshot.PendingDeductQueueCount ?? 0),
      isPointInTime: Boolean(snapshot.isPointInTime ?? snapshot.IsPointInTime ?? false),
      asOfUtc: snapshot.asOfUtc ?? snapshot.AsOfUtc ?? null,
    },
    openCarry: {
      pendingSupplierReceipts: asArray(open.pendingSupplierReceipts ?? open.PendingSupplierReceipts).map(mapOpenItem).filter(Boolean),
      pendingProductionOrders: asArray(open.pendingProductionOrders ?? open.PendingProductionOrders).map(mapOpenItem).filter(Boolean),
      openStockAdjustmentRequests: asArray(open.openStockAdjustmentRequests ?? open.OpenStockAdjustmentRequests).map(mapOpenItem).filter(Boolean),
      openSuggestions: asArray(open.openSuggestions ?? open.OpenSuggestions).map(mapOpenItem).filter(Boolean),
      waitingDeductQueues: asArray(open.waitingDeductQueues ?? open.WaitingDeductQueues).map(mapOpenItem).filter(Boolean),
      pendingSupplierReceiptsTotal: Number(open.pendingSupplierReceiptsTotal ?? open.PendingSupplierReceiptsTotal ?? 0),
      pendingProductionOrdersTotal: Number(open.pendingProductionOrdersTotal ?? open.PendingProductionOrdersTotal ?? 0),
      openStockAdjustmentRequestsTotal: Number(open.openStockAdjustmentRequestsTotal ?? open.OpenStockAdjustmentRequestsTotal ?? 0),
      openSuggestionsTotal: Number(open.openSuggestionsTotal ?? open.OpenSuggestionsTotal ?? 0),
      waitingDeductQueuesTotal: Number(open.waitingDeductQueuesTotal ?? open.WaitingDeductQueuesTotal ?? 0),
    },
  }
}

/** @param {string} [date] YYYY-MM-DD theo lịch VN */
export async function fetchWarehouseDailyReport(date) {
  const query = new URLSearchParams()
  if (date) query.set('date', date)
  const qs = query.toString()
  const path = qs
    ? `/api/v1/inventory/reports/warehouse-daily?${qs}`
    : '/api/v1/inventory/reports/warehouse-daily'
  const data = await apiRequestAuth(path)
  return mapReport(data)
}

function mapSubmissionListItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    businessDate: raw.businessDate ?? raw.BusinessDate ?? '',
    sentAtUtc: raw.sentAtUtc ?? raw.SentAtUtc ?? null,
    sentByName: raw.sentByName ?? raw.SentByName ?? '',
    sentByRoleName: raw.sentByRoleName ?? raw.SentByRoleName ?? '',
    doneTotal: Number(raw.doneTotal ?? raw.DoneTotal ?? 0),
    openCarryCount: Number(raw.openCarryCount ?? raw.OpenCarryCount ?? 0),
    totalWarehouseQuantity: Number(raw.totalWarehouseQuantity ?? raw.TotalWarehouseQuantity ?? 0),
    lowStockSkuCount: Number(raw.lowStockSkuCount ?? raw.LowStockSkuCount ?? 0),
    expiringBatchCount30Days: Number(raw.expiringBatchCount30Days ?? raw.ExpiringBatchCount30Days ?? 0),
  }
}

export async function fetchWarehouseDailyReportSubmissions(params = {}) {
  const search = new URLSearchParams()
  // Khoảng ngày báo cáo (ưu tiên). date = exact 1 ngày (tương thích cũ).
  if (params.from || params.fromDate) search.set('fromDate', params.from || params.fromDate)
  if (params.to || params.toDate) search.set('toDate', params.to || params.toDate)
  if (params.date && !params.from && !params.fromDate && !params.to && !params.toDate) {
    search.set('date', params.date)
  }
  if (params.sentBy) search.set('sentBy', params.sentBy)
  search.set('page', String(params.page ?? 1))
  search.set('pageSize', String(Math.min(100, Math.max(1, params.pageSize ?? 20))))
  const data = await apiRequestAuth(`/api/v1/inventory/reports/warehouse-daily/submissions?${search}`)
  const items = Array.isArray(data?.items ?? data?.Items)
    ? (data.items ?? data.Items).map(mapSubmissionListItem).filter(Boolean)
    : []
  return {
    items,
    page: Number(data?.page ?? data?.Page ?? 1),
    pageSize: Number(data?.pageSize ?? data?.PageSize ?? 20),
    totalItems: Number(data?.totalItems ?? data?.TotalItems ?? items.length),
    totalPages: Number(data?.totalPages ?? data?.TotalPages ?? 1),
  }
}

export async function fetchWarehouseDailyReportSubmission(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/reports/warehouse-daily/submissions/${id}`)
  const listMeta = mapSubmissionListItem(data)
  return {
    ...listMeta,
    sentBy: String(data?.sentBy ?? data?.SentBy ?? ''),
    report: mapReport(data?.report ?? data?.Report),
  }
}

/** Tạo snapshot lần gửi báo cáo (server tự lấy dữ liệu ngày). */
export async function createWarehouseDailyReportSubmission(date) {
  const data = await apiRequestAuth('/api/v1/inventory/reports/warehouse-daily/submissions', {
    method: 'POST',
    body: JSON.stringify({ date: date || null }),
  })
  const listMeta = mapSubmissionListItem(data)
  return {
    ...listMeta,
    sentBy: String(data?.sentBy ?? data?.SentBy ?? ''),
    report: mapReport(data?.report ?? data?.Report),
  }
}
