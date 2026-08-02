using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.Interfaces;

namespace InventoryService.Application.UseCases;

public sealed class WarehouseDailyReportLogic(IWarehouseDailyReportRepository _repo)
{
    public const string TimezoneId = "Asia/Ho_Chi_Minh";
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    public async Task<WarehouseDailyReportResponse> GetAsync(
        DateOnly? date,
        CancellationToken ct = default)
    {
        var businessDate = date ?? VietnamToday();
        var (fromUtc, toUtcExclusive) = ToUtcDayRange(businessDate);

        var receipts = await _repo.GetCompletedSupplierReceiptsAsync(fromUtc, toUtcExclusive, ct);
        var production = await _repo.GetCompletedProductionOrdersAsync(fromUtc, toUtcExclusive, ct);
        var transfers = await _repo.GetCompletedStockTransfersAsync(fromUtc, toUtcExclusive, ct);
        var adjustments = await _repo.GetReviewedStockAdjustmentRequestsAsync(fromUtc, toUtcExclusive, ct);
        var deducts = await _repo.GetConfirmedDeductQueuesAsync(fromUtc, toUtcExclusive, ct);
        var stocktakes = await _repo.GetCompletedWarehouseStocktakesAsync(fromUtc, toUtcExclusive, businessDate, ct);
        var ledgerByType = await _repo.GetWarehouseLedgerSummaryAsync(fromUtc, toUtcExclusive, ct);
        var ledgerCount = await _repo.CountWarehouseLedgerEntriesAsync(fromUtc, toUtcExclusive, ct);
        var snapshot = await _repo.GetEndingSnapshotAsync(ct);
        var openCarry = await _repo.GetOpenCarryAsync(ct);

        var openCarryCount =
            openCarry.PendingSupplierReceipts.Count
            + openCarry.PendingProductionOrders.Count
            + openCarry.OpenStockAdjustmentRequests.Count
            + openCarry.OpenSuggestions.Count
            + openCarry.WaitingDeductQueues.Count;

        var summary = new WarehouseDailyReportSummary(
            receipts.Count,
            production.Count,
            transfers.Count,
            adjustments.Count,
            deducts.Count,
            stocktakes.Count,
            ledgerCount,
            openCarryCount);

        return new WarehouseDailyReportResponse(
            businessDate,
            TimezoneId,
            DateTime.UtcNow,
            summary,
            receipts,
            production,
            transfers,
            adjustments,
            deducts,
            stocktakes,
            ledgerByType,
            snapshot,
            openCarry);
    }

    /// <summary>Ngày hiện tại theo giờ VN (UTC+7).</summary>
    public static DateOnly VietnamToday() =>
        DateOnly.FromDateTime(DateTime.UtcNow.Add(VietnamOffset));

    /// <summary>
    /// [fromUtc, toUtcExclusive) tương ứng một ngày lịch VN.
    /// </summary>
    public static (DateTime FromUtc, DateTime ToUtcExclusive) ToUtcDayRange(DateOnly businessDate)
    {
        var fromLocal = businessDate.ToDateTime(TimeOnly.MinValue);
        var toLocal = businessDate.AddDays(1).ToDateTime(TimeOnly.MinValue);
        var fromUtc = DateTime.SpecifyKind(fromLocal - VietnamOffset, DateTimeKind.Utc);
        var toUtcExclusive = DateTime.SpecifyKind(toLocal - VietnamOffset, DateTimeKind.Utc);
        return (fromUtc, toUtcExclusive);
    }
}
