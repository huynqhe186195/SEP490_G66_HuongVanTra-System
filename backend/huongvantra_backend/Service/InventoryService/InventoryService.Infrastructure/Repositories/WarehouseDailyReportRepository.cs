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
    private const int OpenCarryListCap = 50;

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

    public async Task<WarehouseDailyEndingSnapshot> GetEndingSnapshotAsync(
        DateTime asOfUtcExclusive,
        bool reconstructPointInTime,
        DateOnly businessDate,
        CancellationToken ct = default)
    {
        if (!reconstructPointInTime)
            return await GetLiveEndingSnapshotAsync(ct);

        return await GetPointInTimeEndingSnapshotAsync(asOfUtcExclusive, businessDate, ct);
    }

    public async Task<WarehouseDailyOpenCarry> GetOpenCarryAsync(
        DateTime asOfUtcExclusive,
        bool reconstructPointInTime,
        CancellationToken ct = default)
    {
        if (!reconstructPointInTime)
            return await GetLiveOpenCarryAsync(ct);

        return await GetPointInTimeOpenCarryAsync(asOfUtcExclusive, ct);
    }

    private async Task<WarehouseDailyEndingSnapshot> GetLiveEndingSnapshotAsync(CancellationToken ct)
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
            pendingDeduct,
            IsPointInTime: false,
            AsOfUtc: DateTime.UtcNow);
    }

    private async Task<WarehouseDailyEndingSnapshot> GetPointInTimeEndingSnapshotAsync(
        DateTime asOfUtcExclusive,
        DateOnly businessDate,
        CancellationToken ct)
    {
        var skus = await db.SkuStocks.AsNoTracking().ToListAsync(ct);
        var deltasAfter = await db.InventoryLedgerEntries.AsNoTracking()
            .Where(e => e.Location == LocationWarehouse && e.OccurredAtUtc >= asOfUtcExclusive)
            .GroupBy(e => e.SkuId)
            .Select(g => new { SkuId = g.Key, Delta = g.Sum(x => x.QuantityDelta) })
            .ToDictionaryAsync(x => x.SkuId, x => x.Delta, ct);

        var totalWarehouseQty = 0;
        var lowStock = 0;
        foreach (var sku in skus)
        {
            var eodQty = sku.WarehouseQuantityOnHand - deltasAfter.GetValueOrDefault(sku.SkuId, 0);
            totalWarehouseQty += eodQty;
            if (eodQty <= sku.WarehouseLowStockThreshold)
                lowStock++;
        }

        // Giá trị: lô đã tồn tại trước mốc (ước lượng — qty lô có thể đổi sau EOD).
        var warehouseValue = await db.WarehouseBatchItems.AsNoTracking()
            .Where(i => i.QuantityOnHand > 0
                && i.UnitCost.HasValue
                && i.Batch != null
                && i.Batch.Location == LocationWarehouse
                && i.Batch.CreatedAt < asOfUtcExclusive)
            .SumAsync(i => i.QuantityOnHand * i.UnitCost!.Value, ct);

        var expiryLimit = businessDate.AddDays(30).ToDateTime(TimeOnly.MinValue);
        var expiring = await db.WarehouseBatches.AsNoTracking()
            .CountAsync(b => b.Location == LocationWarehouse
                && b.Status == "active"
                && b.CreatedAt < asOfUtcExclusive
                && b.ExpiresAt != null
                && b.ExpiresAt <= expiryLimit, ct);

        var pendingDeduct = await CountOpenDeductAtAsync(asOfUtcExclusive, ct);

        return new WarehouseDailyEndingSnapshot(
            skus.Count,
            totalWarehouseQty,
            lowStock,
            warehouseValue,
            expiring,
            pendingDeduct,
            IsPointInTime: true,
            AsOfUtc: asOfUtcExclusive);
    }

    private async Task<WarehouseDailyOpenCarry> GetLiveOpenCarryAsync(CancellationToken ct)
    {
        var pendingReceiptsQuery = db.SupplierReceipts.AsNoTracking()
            .Where(r => r.Status == SupplierReceiptStatus.Draft
                || r.Status == SupplierReceiptStatus.PendingApproval);
        var pendingReceiptsTotal = await pendingReceiptsQuery.CountAsync(ct);
        var pendingReceipts = await pendingReceiptsQuery
            .OrderByDescending(r => r.UpdatedAt)
            .Take(OpenCarryListCap)
            .Select(r => new WarehouseDailyOpenItem(
                r.Id,
                r.ReceiptCode,
                r.Status.ToString(),
                r.UpdatedAt,
                r.CreatedByName))
            .ToListAsync(ct);

        var pendingPoQuery = db.ProductionOrders.AsNoTracking()
            .Where(o => o.Status == ProductionOrderStatus.Draft
                || o.Status == ProductionOrderStatus.PendingApproval
                || o.Status == ProductionOrderStatus.Approved);
        var pendingPoTotal = await pendingPoQuery.CountAsync(ct);
        var pendingPo = await pendingPoQuery
            .OrderByDescending(o => o.UpdatedAt)
            .Take(OpenCarryListCap)
            .Select(o => new WarehouseDailyOpenItem(
                o.Id,
                o.ProductionCode,
                o.Status.ToString(),
                o.UpdatedAt,
                o.CreatedByName))
            .ToListAsync(ct);

        var openRequestsQuery = db.StockAdjustmentRequests.AsNoTracking()
            .Where(r => r.Status == StockAdjustmentRequestStatus.Pending
                || r.Status == StockAdjustmentRequestStatus.Approved
                || r.Status == StockAdjustmentRequestStatus.Processing
                || r.Status == StockAdjustmentRequestStatus.PartiallyFulfilled);
        var openRequestsTotal = await openRequestsQuery.CountAsync(ct);
        var openRequests = await openRequestsQuery
            .OrderByDescending(r => r.RequestedAt)
            .Take(OpenCarryListCap)
            .Select(r => new WarehouseDailyOpenItem(
                r.Id,
                r.RequestCode,
                r.Status.ToString(),
                r.RequestedAt,
                r.RequestedByName))
            .ToListAsync(ct);

        var openSuggestionsQuery = db.ShelfReplenishmentSuggestions.AsNoTracking()
            .Where(s => s.Status == ShelfReplenishmentSuggestionStatus.Open);
        var openSuggestionsTotal = await openSuggestionsQuery.CountAsync(ct);
        var openSuggestions = await openSuggestionsQuery
            .OrderByDescending(s => s.CreatedAt)
            .Take(OpenCarryListCap)
            .Select(s => new WarehouseDailyOpenItem(
                s.Id,
                s.SuggestionCode,
                s.Status.ToString(),
                s.CreatedAt,
                null))
            .ToListAsync(ct);

        var waitingQueuesQuery = db.StockDeductQueues.AsNoTracking()
            .Where(q => !q.IsDeducted
                && (q.QueueStatus == QueueStatus.Waiting || q.QueueStatus == QueueStatus.Insufficient));
        var waitingQueuesTotal = await waitingQueuesQuery.CountAsync(ct);
        var waitingQueues = await waitingQueuesQuery
            .OrderByDescending(q => q.CreatedAt)
            .Take(OpenCarryListCap)
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
            waitingQueues,
            pendingReceiptsTotal,
            pendingPoTotal,
            openRequestsTotal,
            openSuggestionsTotal,
            waitingQueuesTotal);
    }

    private async Task<WarehouseDailyOpenCarry> GetPointInTimeOpenCarryAsync(
        DateTime asOfUtcExclusive,
        CancellationToken ct)
    {
        var receiptQuery = db.SupplierReceipts.AsNoTracking()
            .Where(r => r.CreatedAt < asOfUtcExclusive
                && (
                    r.Status == SupplierReceiptStatus.Draft
                    || r.Status == SupplierReceiptStatus.PendingApproval
                    || ((r.Status == SupplierReceiptStatus.Completed
                            || r.Status == SupplierReceiptStatus.Rejected
                            || r.Status == SupplierReceiptStatus.Cancelled)
                        && (r.ReviewedAt ?? r.UpdatedAt) >= asOfUtcExclusive)));
        var receiptsTotal = await receiptQuery.CountAsync(ct);
        var receipts = await receiptQuery
            .OrderByDescending(r => r.UpdatedAt)
            .Take(OpenCarryListCap)
            .Select(r => new WarehouseDailyOpenItem(
                r.Id,
                r.ReceiptCode,
                r.Status.ToString(),
                r.UpdatedAt,
                r.CreatedByName))
            .ToListAsync(ct);

        var poQuery = db.ProductionOrders.AsNoTracking()
            .Where(o => o.CreatedAt < asOfUtcExclusive
                && (
                    o.Status == ProductionOrderStatus.Draft
                    || o.Status == ProductionOrderStatus.PendingApproval
                    || o.Status == ProductionOrderStatus.Approved
                    || (o.Status == ProductionOrderStatus.Completed
                        && o.CompletedAt != null
                        && o.CompletedAt >= asOfUtcExclusive)
                    || ((o.Status == ProductionOrderStatus.Rejected
                            || o.Status == ProductionOrderStatus.Cancelled)
                        && (o.ReviewedAt ?? o.UpdatedAt) >= asOfUtcExclusive)));
        var poTotal = await poQuery.CountAsync(ct);
        var pos = await poQuery
            .OrderByDescending(o => o.UpdatedAt)
            .Take(OpenCarryListCap)
            .Select(o => new WarehouseDailyOpenItem(
                o.Id,
                o.ProductionCode,
                o.Status.ToString(),
                o.UpdatedAt,
                o.CreatedByName))
            .ToListAsync(ct);

        var requestQuery = db.StockAdjustmentRequests.AsNoTracking()
            .Where(r => r.RequestedAt < asOfUtcExclusive
                && (
                    r.Status == StockAdjustmentRequestStatus.Pending
                    || r.Status == StockAdjustmentRequestStatus.Approved
                    || r.Status == StockAdjustmentRequestStatus.Processing
                    || r.Status == StockAdjustmentRequestStatus.PartiallyFulfilled
                    || ((r.Status == StockAdjustmentRequestStatus.Fulfilled
                            || r.Status == StockAdjustmentRequestStatus.Completed
                            || r.Status == StockAdjustmentRequestStatus.Rejected
                            || r.Status == StockAdjustmentRequestStatus.ClosedPartial
                            || r.Status == StockAdjustmentRequestStatus.Cancelled)
                        && r.ReviewedAt != null
                        && r.ReviewedAt >= asOfUtcExclusive)));
        var requestTotal = await requestQuery.CountAsync(ct);
        var requests = await requestQuery
            .OrderByDescending(r => r.RequestedAt)
            .Take(OpenCarryListCap)
            .Select(r => new WarehouseDailyOpenItem(
                r.Id,
                r.RequestCode,
                r.Status.ToString(),
                r.RequestedAt,
                r.RequestedByName))
            .ToListAsync(ct);

        var suggestionQuery = db.ShelfReplenishmentSuggestions.AsNoTracking()
            .Where(s => s.CreatedAt < asOfUtcExclusive
                && (
                    s.Status == ShelfReplenishmentSuggestionStatus.Open
                    || (s.HandledAt != null && s.HandledAt >= asOfUtcExclusive)));
        var suggestionTotal = await suggestionQuery.CountAsync(ct);
        var suggestions = await suggestionQuery
            .OrderByDescending(s => s.CreatedAt)
            .Take(OpenCarryListCap)
            .Select(s => new WarehouseDailyOpenItem(
                s.Id,
                s.SuggestionCode,
                s.Status.ToString(),
                s.CreatedAt,
                null))
            .ToListAsync(ct);

        var deductQuery = OpenDeductAtQuery(asOfUtcExclusive);
        var deductTotal = await deductQuery.CountAsync(ct);
        var deducts = await deductQuery
            .OrderByDescending(q => q.CreatedAt)
            .Take(OpenCarryListCap)
            .Select(q => new WarehouseDailyOpenItem(
                q.Id,
                q.OrderCode,
                q.QueueStatus.ToString(),
                q.CreatedAt,
                q.CustomerSnapshotName))
            .ToListAsync(ct);

        return new WarehouseDailyOpenCarry(
            receipts,
            pos,
            requests,
            suggestions,
            deducts,
            receiptsTotal,
            poTotal,
            requestTotal,
            suggestionTotal,
            deductTotal);
    }

    private Task<int> CountOpenDeductAtAsync(DateTime asOfUtcExclusive, CancellationToken ct) =>
        OpenDeductAtQuery(asOfUtcExclusive).CountAsync(ct);

    private IQueryable<Domain.Entities.StockDeductQueue> OpenDeductAtQuery(DateTime asOfUtcExclusive) =>
        db.StockDeductQueues.AsNoTracking()
            .Where(q => q.CreatedAt < asOfUtcExclusive
                && (
                    (!q.IsDeducted
                        && (q.QueueStatus == QueueStatus.Waiting || q.QueueStatus == QueueStatus.Insufficient))
                    || (q.ConfirmedAt != null && q.ConfirmedAt >= asOfUtcExclusive)));
}
