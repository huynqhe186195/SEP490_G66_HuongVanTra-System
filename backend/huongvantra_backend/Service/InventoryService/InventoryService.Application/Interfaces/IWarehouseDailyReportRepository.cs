using InventoryService.Application.DTOs.Responses;

namespace InventoryService.Application.Interfaces;

/// <summary>
/// Truy vấn tổng hợp cho báo cáo cuối ngày thủ kho (read-only).
/// </summary>
public interface IWarehouseDailyReportRepository
{
    Task<IReadOnlyList<WarehouseDailyReceiptRow>> GetCompletedSupplierReceiptsAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default);

    Task<IReadOnlyList<WarehouseDailyProductionRow>> GetCompletedProductionOrdersAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default);

    Task<IReadOnlyList<WarehouseDailyTransferRow>> GetCompletedStockTransfersAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default);

    Task<IReadOnlyList<WarehouseDailyAdjustmentReviewRow>> GetReviewedStockAdjustmentRequestsAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default);

    Task<IReadOnlyList<WarehouseDailyDeductRow>> GetConfirmedDeductQueuesAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default);

    Task<IReadOnlyList<WarehouseDailyStocktakeRow>> GetCompletedWarehouseStocktakesAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        DateOnly businessDate,
        CancellationToken ct = default);

    Task<IReadOnlyList<WarehouseDailyLedgerTypeRow>> GetWarehouseLedgerSummaryAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default);

    Task<int> CountWarehouseLedgerEntriesAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default);

    /// <param name="asOfUtcExclusive">Mốc UTC exclusive (cuối ngày VN).</param>
    /// <param name="reconstructPointInTime">
    /// True = tái dựng tồn/còn dở tại mốc (ngày quá khứ); false = snapshot hiện tại.
    /// </param>
    Task<WarehouseDailyEndingSnapshot> GetEndingSnapshotAsync(
        DateTime asOfUtcExclusive,
        bool reconstructPointInTime,
        DateOnly businessDate,
        CancellationToken ct = default);

    Task<WarehouseDailyOpenCarry> GetOpenCarryAsync(
        DateTime asOfUtcExclusive,
        bool reconstructPointInTime,
        CancellationToken ct = default);
}
