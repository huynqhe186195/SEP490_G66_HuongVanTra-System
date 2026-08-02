using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.Interfaces;
using InventoryService.Application.UseCases;
using Moq;
using Xunit;

namespace InventoryService.Application.Tests;

public sealed class WarehouseDailyReportLogicTests
{
    [Fact]
    public void ToUtcDayRange_VietnamDay_MapsToUtcExclusiveWindow()
    {
        var date = new DateOnly(2026, 8, 1);
        var (fromUtc, toUtc) = WarehouseDailyReportLogic.ToUtcDayRange(date);

        Assert.Equal(DateTimeKind.Utc, fromUtc.Kind);
        Assert.Equal(DateTimeKind.Utc, toUtc.Kind);
        // 2026-08-01 00:00 VN = 2026-07-31 17:00 UTC
        Assert.Equal(new DateTime(2026, 7, 31, 17, 0, 0, DateTimeKind.Utc), fromUtc);
        Assert.Equal(new DateTime(2026, 8, 1, 17, 0, 0, DateTimeKind.Utc), toUtc);
        Assert.Equal(TimeSpan.FromDays(1), toUtc - fromUtc);
    }

    [Fact]
    public async Task GetAsync_AggregatesCompletedSectionsAndOpenCarry()
    {
        var date = new DateOnly(2026, 8, 1);
        var (fromUtc, toUtc) = WarehouseDailyReportLogic.ToUtcDayRange(date);
        var isPast = date < WarehouseDailyReportLogic.VietnamToday();

        var receipts = new List<WarehouseDailyReceiptRow>
        {
            new(Guid.NewGuid(), "PN-1", "Completed", date.ToDateTime(TimeOnly.MinValue), fromUtc.AddHours(1), "A", 2, 1000m),
        };
        var production = new List<WarehouseDailyProductionRow>
        {
            new(Guid.NewGuid(), "SX-1", "Completed", fromUtc.AddHours(2), "B", 3, 1),
        };
        var transfers = new List<WarehouseDailyTransferRow>
        {
            new(Guid.NewGuid(), "DC-1", "Completed", fromUtc.AddHours(3), "C", "YC-1", 1, 5),
        };
        var adjustments = new List<WarehouseDailyAdjustmentReviewRow>
        {
            new(Guid.NewGuid(), "YC-2", "Approved", fromUtc.AddHours(4), "D", 2),
        };
        var deducts = new List<WarehouseDailyDeductRow>
        {
            new(Guid.NewGuid(), Guid.NewGuid(), "DH-1", fromUtc.AddHours(5), "E"),
        };
        var stocktakes = new List<WarehouseDailyStocktakeRow>
        {
            new(Guid.NewGuid(), "KK-1", "Completed", date.ToDateTime(TimeOnly.MinValue), fromUtc.AddHours(6), "F", 4),
        };
        var ledger = new List<WarehouseDailyLedgerTypeRow>
        {
            new("SUPPLIER_RECEIPT", 3, 10),
            new("STOCK_TRANSFER_WAREHOUSE_OUT", 2, -5),
        };
        var snapshot = new WarehouseDailyEndingSnapshot(10, 100, 2, 5000m, 1, 3, isPast, toUtc);
        var openCarry = new WarehouseDailyOpenCarry(
            [new WarehouseDailyOpenItem(Guid.NewGuid(), "PN-OPEN", "Draft", fromUtc, "X")],
            [],
            [],
            [new WarehouseDailyOpenItem(Guid.NewGuid(), "GY-1", "Open", fromUtc, null)],
            [new WarehouseDailyOpenItem(Guid.NewGuid(), "DH-WAIT", "Waiting", fromUtc, "KH")],
            PendingSupplierReceiptsTotal: 1,
            PendingProductionOrdersTotal: 0,
            OpenStockAdjustmentRequestsTotal: 0,
            OpenSuggestionsTotal: 1,
            WaitingDeductQueuesTotal: 1);

        var repo = new Mock<IWarehouseDailyReportRepository>(MockBehavior.Strict);
        repo.Setup(r => r.GetCompletedSupplierReceiptsAsync(fromUtc, toUtc, It.IsAny<CancellationToken>()))
            .ReturnsAsync(receipts);
        repo.Setup(r => r.GetCompletedProductionOrdersAsync(fromUtc, toUtc, It.IsAny<CancellationToken>()))
            .ReturnsAsync(production);
        repo.Setup(r => r.GetCompletedStockTransfersAsync(fromUtc, toUtc, It.IsAny<CancellationToken>()))
            .ReturnsAsync(transfers);
        repo.Setup(r => r.GetReviewedStockAdjustmentRequestsAsync(fromUtc, toUtc, It.IsAny<CancellationToken>()))
            .ReturnsAsync(adjustments);
        repo.Setup(r => r.GetConfirmedDeductQueuesAsync(fromUtc, toUtc, It.IsAny<CancellationToken>()))
            .ReturnsAsync(deducts);
        repo.Setup(r => r.GetCompletedWarehouseStocktakesAsync(fromUtc, toUtc, date, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stocktakes);
        repo.Setup(r => r.GetWarehouseLedgerSummaryAsync(fromUtc, toUtc, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ledger);
        repo.Setup(r => r.CountWarehouseLedgerEntriesAsync(fromUtc, toUtc, It.IsAny<CancellationToken>()))
            .ReturnsAsync(5);
        repo.Setup(r => r.GetEndingSnapshotAsync(toUtc, isPast, date, It.IsAny<CancellationToken>()))
            .ReturnsAsync(snapshot);
        repo.Setup(r => r.GetOpenCarryAsync(toUtc, isPast, It.IsAny<CancellationToken>()))
            .ReturnsAsync(openCarry);

        var logic = new WarehouseDailyReportLogic(repo.Object);
        var report = await logic.GetAsync(date);

        Assert.Equal(date, report.BusinessDate);
        Assert.Equal(WarehouseDailyReportLogic.TimezoneId, report.Timezone);
        Assert.Equal(1, report.Summary.SupplierReceiptsCompleted);
        Assert.Equal(1, report.Summary.ProductionOrdersCompleted);
        Assert.Equal(1, report.Summary.StockTransfersCompleted);
        Assert.Equal(1, report.Summary.StockAdjustmentReviews);
        Assert.Equal(1, report.Summary.StockDeductQueuesConfirmed);
        Assert.Equal(1, report.Summary.WarehouseStocktakesCompleted);
        Assert.Equal(5, report.Summary.LedgerMovementCount);
        Assert.Equal(3, report.Summary.OpenCarryCount);
        Assert.Equal(2, report.LedgerByType.Count);
        Assert.Equal(100, report.EndingSnapshot.TotalWarehouseQuantity);
        Assert.Single(report.OpenCarry.PendingSupplierReceipts);
        Assert.Single(report.OpenCarry.WaitingDeductQueues);
        repo.VerifyAll();
    }
}
