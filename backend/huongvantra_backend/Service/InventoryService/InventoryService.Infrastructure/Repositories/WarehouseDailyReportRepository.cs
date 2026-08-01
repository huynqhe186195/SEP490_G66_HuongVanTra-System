using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.Interfaces;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public sealed class WarehouseDailyReportRepository(InventoryDbContext db) : IWarehouseDailyReportRepository
{
    private const string LocationWarehouse = "Warehouse";
    private const int ListCap = 200;
    private const int OpenCarryCap = 50;

    public async Task<IReadOnlyList<WarehouseDailyReceiptRow>> GetCompletedSupplierReceiptsAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default)
    {
        return await db.SupplierReceipts.AsNoTracking()
            .Where(r => r.Status == SupplierReceiptStatus.Completed
                && r.ReviewedAt != null
                && r.ReviewedAt >= fromUtc
                && r.ReviewedAt < toUtcExclusive)
            .OrderByDescending(r => r.ReviewedAt)
            .Take(ListCap)
            .Select(r => new WarehouseDailyReceiptRow(
                r.Id,
                r.ReceiptCode,
                r.Status.ToString(),
                r.ReceivedDate,
                r.ReviewedAt,
                r.ReviewedByName ?? r.CreatedByName,
                r.Items.Count,
                r.TotalAmount))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<WarehouseDailyProductionRow>> GetCompletedProductionOrdersAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default)
    {
        return await db.ProductionOrders.AsNoTracking()
            .Where(o => o.Status == ProductionOrderStatus.Completed
                && o.CompletedAt != null
                && o.CompletedAt >= fromUtc
                && o.CompletedAt < toUtcExclusive)
            .OrderByDescending(o => o.CompletedAt)
            .Take(ListCap)
            .Select(o => new WarehouseDailyProductionRow(
                o.Id,
                o.ProductionCode,
                o.Status.ToString(),
                o.CompletedAt,
                o.CreatedByName,
                o.Lines.Count,
                o.OutputLines.Count))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<WarehouseDailyTransferRow>> GetCompletedStockTransfersAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default)
    {
        return await db.StockTransfers.AsNoTracking()
            .Where(t => t.Status == StockTransferStatus.Completed
                && t.CompletedAt != null
                && t.CompletedAt >= fromUtc
                && t.CompletedAt < toUtcExclusive)
            .OrderByDescending(t => t.CompletedAt)
            .Take(ListCap)
            .Select(t => new WarehouseDailyTransferRow(
                t.Id,
                t.TransferCode,
                t.Status.ToString(),
                t.CompletedAt,
                t.CompletedByName ?? t.CreatedByName,
                t.SourceRequest != null ? t.SourceRequest.RequestCode : null,
                t.Lines.Count,
                t.Lines.Sum(l => l.Quantity)))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<WarehouseDailyAdjustmentReviewRow>> GetReviewedStockAdjustmentRequestsAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default)
    {
        return await db.StockAdjustmentRequests.AsNoTracking()
            .Where(r => r.ReviewedAt != null
                && r.ReviewedAt >= fromUtc
                && r.ReviewedAt < toUtcExclusive)
            .OrderByDescending(r => r.ReviewedAt)
            .Take(ListCap)
            .Select(r => new WarehouseDailyAdjustmentReviewRow(
                r.Id,
                r.RequestCode,
                r.Status.ToString(),
                r.ReviewedAt,
                r.ReviewedByName,
                r.Items.Count))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<WarehouseDailyDeductRow>> GetConfirmedDeductQueuesAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default)
    {
        return await db.StockDeductQueues.AsNoTracking()
            .Where(q => q.QueueStatus == QueueStatus.Confirmed
                && q.ConfirmedAt != null
                && q.ConfirmedAt >= fromUtc
                && q.ConfirmedAt < toUtcExclusive)
            .OrderByDescending(q => q.ConfirmedAt)
            .Take(ListCap)
            .Select(q => new WarehouseDailyDeductRow(
                q.Id,
                q.OrderId,
                q.OrderCode,
                q.ConfirmedAt,
                q.ConfirmedByName))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<WarehouseDailyStocktakeRow>> GetCompletedWarehouseStocktakesAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        DateOnly businessDate,
        CancellationToken ct = default)
    {
        var countDate = businessDate.ToDateTime(TimeOnly.MinValue);
        var countDateNext = countDate.AddDays(1);

        return await db.StocktakeRequests.AsNoTracking()
            .Where(s => s.Location == LocationWarehouse
                && s.Status == StocktakeStatus.Completed
                && (
                    (s.ReviewedAt != null && s.ReviewedAt >= fromUtc && s.ReviewedAt < toUtcExclusive)
                    || (s.CountDate >= countDate && s.CountDate < countDateNext)
                ))
            .OrderByDescending(s => s.ReviewedAt ?? s.CountDate)
            .Take(ListCap)
            .Select(s => new WarehouseDailyStocktakeRow(
                s.Id,
                s.RequestCode,
                s.Status.ToString(),
                s.CountDate,
                s.ReviewedAt,
                s.ReviewedByName ?? s.CreatedByName,
                s.Items.Count))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<WarehouseDailyLedgerTypeRow>> GetWarehouseLedgerSummaryAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default)
    {
        // GroupBy + new record(...) không translate được trên Pomelo/EF — aggregate anonymous rồi map.
        var rows = await db.InventoryLedgerEntries.AsNoTracking()
            .Where(e => e.Location == LocationWarehouse
                && e.OccurredAtUtc >= fromUtc
                && e.OccurredAtUtc < toUtcExclusive)
            .GroupBy(e => e.TransactionType)
            .Select(g => new
            {
                TransactionType = g.Key,
                EntryCount = g.Count(),
                NetQuantityDelta = g.Sum(x => x.QuantityDelta),
            })
            .OrderByDescending(x => x.EntryCount)
            .ToListAsync(ct);

        return rows
            .Select(r => new WarehouseDailyLedgerTypeRow(
                r.TransactionType,
                r.EntryCount,
                r.NetQuantityDelta))
            .ToList();
    }

    public async Task<int> CountWarehouseLedgerEntriesAsync(
        DateTime fromUtc,
        DateTime toUtcExclusive,
        CancellationToken ct = default)
    {
        return await db.InventoryLedgerEntries.AsNoTracking()
            .CountAsync(e => e.Location == LocationWarehouse
                && e.OccurredAtUtc >= fromUtc
                && e.OccurredAtUtc < toUtcExclusive, ct);
    }

    public async Task<WarehouseDailyEndingSnapshot> GetEndingSnapshotAsync(CancellationToken ct = default)
    {
        var skus = await db.SkuStocks.AsNoTracking().ToListAsync(ct);
        var totalSkus = skus.Count;
        var totalWarehouseQty = skus.Sum(s => s.WarehouseQuantityOnHand);
        var lowStock = skus.Count(s =>
            s.QuantityOnHand <= s.ShelfLowStockThreshold
            || s.WarehouseQuantityOnHand <= s.WarehouseLowStockThreshold);

        var warehouseValue = await db.WarehouseBatchItems.AsNoTracking()
            .Where(i => i.QuantityOnHand > 0
                && i.UnitCost.HasValue
                && i.Batch != null
                && i.Batch.Location == LocationWarehouse)
            .SumAsync(i => i.QuantityOnHand * i.UnitCost!.Value, ct);

        var nowVn = DateTime.UtcNow.AddHours(7).Date;
        var expiryLimit = nowVn.AddDays(30);
        var expiring = await db.WarehouseBatches.AsNoTracking()
            .CountAsync(b => b.Location == LocationWarehouse
                && b.Status == "active"
                && b.ExpiresAt != null
                && b.ExpiresAt <= expiryLimit, ct);

        var pendingDeduct = await db.StockDeductQueues.AsNoTracking()
            .CountAsync(q => !q.IsDeducted
                && (q.QueueStatus == QueueStatus.Waiting || q.QueueStatus == QueueStatus.Insufficient), ct);

        return new WarehouseDailyEndingSnapshot(
            totalSkus,
            totalWarehouseQty,
            lowStock,
            warehouseValue,
            expiring,
            pendingDeduct);
    }

    public async Task<WarehouseDailyOpenCarry> GetOpenCarryAsync(CancellationToken ct = default)
    {
        var pendingReceipts = await db.SupplierReceipts.AsNoTracking()
            .Where(r => r.Status == SupplierReceiptStatus.Draft
                || r.Status == SupplierReceiptStatus.PendingApproval)
            .OrderByDescending(r => r.UpdatedAt)
            .Take(OpenCarryCap)
            .Select(r => new WarehouseDailyOpenItem(
                r.Id,
                r.ReceiptCode,
                r.Status.ToString(),
                r.UpdatedAt,
                r.CreatedByName))
            .ToListAsync(ct);

        var pendingPo = await db.ProductionOrders.AsNoTracking()
            .Where(o => o.Status == ProductionOrderStatus.Draft
                || o.Status == ProductionOrderStatus.PendingApproval
                || o.Status == ProductionOrderStatus.Approved)
            .OrderByDescending(o => o.UpdatedAt)
            .Take(OpenCarryCap)
            .Select(o => new WarehouseDailyOpenItem(
                o.Id,
                o.ProductionCode,
                o.Status.ToString(),
                o.UpdatedAt,
                o.CreatedByName))
            .ToListAsync(ct);

        var openRequests = await db.StockAdjustmentRequests.AsNoTracking()
            .Where(r => r.Status == StockAdjustmentRequestStatus.Pending
                || r.Status == StockAdjustmentRequestStatus.Approved
                || r.Status == StockAdjustmentRequestStatus.Processing
                || r.Status == StockAdjustmentRequestStatus.PartiallyFulfilled)
            .OrderByDescending(r => r.RequestedAt)
            .Take(OpenCarryCap)
            .Select(r => new WarehouseDailyOpenItem(
                r.Id,
                r.RequestCode,
                r.Status.ToString(),
                r.RequestedAt,
                r.RequestedByName))
            .ToListAsync(ct);

        var openSuggestions = await db.ShelfReplenishmentSuggestions.AsNoTracking()
            .Where(s => s.Status == ShelfReplenishmentSuggestionStatus.Open)
            .OrderByDescending(s => s.CreatedAt)
            .Take(OpenCarryCap)
            .Select(s => new WarehouseDailyOpenItem(
                s.Id,
                s.SuggestionCode,
                s.Status.ToString(),
                s.CreatedAt,
                null))
            .ToListAsync(ct);

        var waitingQueues = await db.StockDeductQueues.AsNoTracking()
            .Where(q => !q.IsDeducted
                && (q.QueueStatus == QueueStatus.Waiting || q.QueueStatus == QueueStatus.Insufficient))
            .OrderByDescending(q => q.CreatedAt)
            .Take(OpenCarryCap)
            .Select(q => new WarehouseDailyOpenItem(
                q.Id,
                q.OrderCode,
                q.QueueStatus.ToString(),
                q.CreatedAt,
                q.CustomerSnapshotName))
            .ToListAsync(ct);

        return new WarehouseDailyOpenCarry(
            pendingReceipts,
            pendingPo,
            openRequests,
            openSuggestions,
            waitingQueues);
    }
}
