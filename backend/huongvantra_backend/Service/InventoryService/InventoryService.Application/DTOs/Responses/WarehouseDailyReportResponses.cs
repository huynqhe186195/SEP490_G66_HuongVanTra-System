namespace InventoryService.Application.DTOs.Responses;

public sealed record WarehouseDailyReportResponse(
    DateOnly BusinessDate,
    string Timezone,
    DateTime GeneratedAtUtc,
    WarehouseDailyReportSummary Summary,
    IReadOnlyList<WarehouseDailyReceiptRow> SupplierReceipts,
    IReadOnlyList<WarehouseDailyProductionRow> ProductionOrders,
    IReadOnlyList<WarehouseDailyTransferRow> StockTransfers,
    IReadOnlyList<WarehouseDailyAdjustmentReviewRow> StockAdjustmentReviews,
    IReadOnlyList<WarehouseDailyDeductRow> StockDeductConfirmations,
    IReadOnlyList<WarehouseDailyStocktakeRow> WarehouseStocktakes,
    IReadOnlyList<WarehouseDailyLedgerTypeRow> LedgerByType,
    WarehouseDailyEndingSnapshot EndingSnapshot,
    WarehouseDailyOpenCarry OpenCarry);

public sealed record WarehouseDailyReportSummary(
    int SupplierReceiptsCompleted,
    int ProductionOrdersCompleted,
    int StockTransfersCompleted,
    int StockAdjustmentReviews,
    int StockDeductQueuesConfirmed,
    int WarehouseStocktakesCompleted,
    int LedgerMovementCount,
    int OpenCarryCount);

public sealed record WarehouseDailyReceiptRow(
    Guid Id,
    string Code,
    string Status,
    DateTime ReceivedDate,
    DateTime? CompletedAtUtc,
    string? ActorName,
    int LineCount,
    decimal TotalAmount);

public sealed record WarehouseDailyProductionRow(
    Guid Id,
    string Code,
    string Status,
    DateTime? CompletedAtUtc,
    string? ActorName,
    int MaterialLineCount,
    int OutputLineCount);

public sealed record WarehouseDailyTransferRow(
    Guid Id,
    string Code,
    string Status,
    DateTime? CompletedAtUtc,
    string? ActorName,
    string? SourceRequestCode,
    int SkuCount,
    int TotalQuantity);

public sealed record WarehouseDailyAdjustmentReviewRow(
    Guid Id,
    string Code,
    string Status,
    DateTime? ReviewedAtUtc,
    string? ReviewedByName,
    int ItemCount);

public sealed record WarehouseDailyDeductRow(
    Guid QueueId,
    Guid OrderId,
    string OrderCode,
    DateTime? ConfirmedAtUtc,
    string? ConfirmedByName);

public sealed record WarehouseDailyStocktakeRow(
    Guid Id,
    string Code,
    string Status,
    DateTime CountDate,
    DateTime? ReviewedAtUtc,
    string? ReviewedByName,
    int ItemCount);

public sealed record WarehouseDailyLedgerTypeRow(
    string TransactionType,
    int EntryCount,
    int NetQuantityDelta);

public sealed record WarehouseDailyEndingSnapshot(
    int TotalSkuCount,
    int TotalWarehouseQuantity,
    int LowStockSkuCount,
    decimal TotalWarehouseValue,
    int ExpiringBatchCount30Days,
    int PendingDeductQueueCount,
    /// <summary>True khi số liệu được tái dựng về cuối ngày (ngày quá khứ).</summary>
    bool IsPointInTime = false,
    DateTime? AsOfUtc = null);

public sealed record WarehouseDailyOpenCarry(
    IReadOnlyList<WarehouseDailyOpenItem> PendingSupplierReceipts,
    IReadOnlyList<WarehouseDailyOpenItem> PendingProductionOrders,
    IReadOnlyList<WarehouseDailyOpenItem> OpenStockAdjustmentRequests,
    IReadOnlyList<WarehouseDailyOpenItem> OpenSuggestions,
    IReadOnlyList<WarehouseDailyOpenItem> WaitingDeductQueues,
    int PendingSupplierReceiptsTotal = 0,
    int PendingProductionOrdersTotal = 0,
    int OpenStockAdjustmentRequestsTotal = 0,
    int OpenSuggestionsTotal = 0,
    int WaitingDeductQueuesTotal = 0)
{
    public int TotalCount =>
        PendingSupplierReceiptsTotal
        + PendingProductionOrdersTotal
        + OpenStockAdjustmentRequestsTotal
        + OpenSuggestionsTotal
        + WaitingDeductQueuesTotal;
}

public sealed record WarehouseDailyOpenItem(
    Guid Id,
    string Code,
    string Status,
    DateTime? TimestampUtc,
    string? ActorName);

public sealed record CreateWarehouseDailyReportSubmissionRequest(DateOnly? Date);

public sealed record WarehouseDailyReportSubmissionListItem(
    Guid Id,
    DateOnly BusinessDate,
    DateTime SentAtUtc,
    string SentByName,
    string? SentByRoleName,
    int DoneTotal,
    int OpenCarryCount,
    int TotalWarehouseQuantity,
    int LowStockSkuCount,
    int ExpiringBatchCount30Days);

public sealed record WarehouseDailyReportSubmissionDetail(
    Guid Id,
    DateOnly BusinessDate,
    DateTime SentAtUtc,
    Guid SentBy,
    string SentByName,
    string? SentByRoleName,
    int DoneTotal,
    int OpenCarryCount,
    int TotalWarehouseQuantity,
    int LowStockSkuCount,
    int ExpiringBatchCount30Days,
    WarehouseDailyReportResponse Report);
