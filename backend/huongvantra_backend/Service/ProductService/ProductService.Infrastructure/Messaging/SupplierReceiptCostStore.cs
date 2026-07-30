using System.Data;
using Microsoft.EntityFrameworkCore;
using ProductService.Domain.Entities;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.Messaging;

public interface ISupplierReceiptCostStore
{
    Task ExecuteReadCommittedAsync(
        Func<CancellationToken, Task> operation,
        CancellationToken cancellationToken);

    Task<ProductVariant?> LockVariantAsync(Guid skuId, CancellationToken cancellationToken);

    Task<ProductCostPriceHistory?> FindHistoryAsync(
        Guid eventId,
        Guid sourceReceiptLineId,
        CancellationToken cancellationToken);

    Task<List<ProductCostPriceHistory>> GetReceiptGroupAsync(
        Guid sourceReceiptId,
        Guid skuId,
        CancellationToken cancellationToken);

    Task<ProductCostPriceHistory?> GetLatestAppliedHistoryAsync(
        Guid skuId,
        CancellationToken cancellationToken);

    /// <summary>SkuId của mọi ProductVariant còn hiệu lực — đầu vào cho reconciliation toàn bộ.</summary>
    Task<List<Guid>> GetActiveVariantIdsAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Lịch sử cost đã áp dụng của một SKU, đã lọc các dòng có đủ ActualQuantity và UnitCost.
    /// Dùng để recompute cumulative state mà không cần gọi InventoryService.
    /// </summary>
    Task<List<ProductCostPriceHistory>> GetAppliedHistoryForSkuAsync(
        Guid skuId,
        CancellationToken cancellationToken);

    /// <summary>
    /// SourceReceiptId của các receipt group đang chờ reconciliation
    /// (ProcessingResult = "reconciliation_required", WasApplied = false),
    /// sắp theo business order để re-evaluate tuần tự.
    /// </summary>
    Task<List<Guid>> GetPendingReconciliationReceiptIdsAsync(
        Guid skuId,
        CancellationToken cancellationToken);

    void AddHistory(ProductCostPriceHistory history);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}

public sealed class SupplierReceiptCostStore(ProductDbContext db) : ISupplierReceiptCostStore
{
    public async Task ExecuteReadCommittedAsync(
        Func<CancellationToken, Task> operation,
        CancellationToken cancellationToken)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken);
            try
            {
                await operation(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }

    public async Task<ProductVariant?> LockVariantAsync(
        Guid skuId,
        CancellationToken cancellationToken)
    {
        var variants = await db.ProductVariants
            .FromSqlInterpolated(
                $"SELECT * FROM `ProductVariants` WHERE `Id` = {skuId} AND `IsDeleted` = FALSE FOR UPDATE")
            .IgnoreQueryFilters()
            .AsTracking()
            .ToListAsync(cancellationToken);
        return variants.SingleOrDefault();
    }

    public Task<ProductCostPriceHistory?> FindHistoryAsync(
        Guid eventId,
        Guid sourceReceiptLineId,
        CancellationToken cancellationToken) =>
        db.ProductCostPriceHistories.SingleOrDefaultAsync(
            history =>
                history.EventId == eventId
                || history.SourceReceiptLineId == sourceReceiptLineId,
            cancellationToken);

    public Task<List<ProductCostPriceHistory>> GetReceiptGroupAsync(
        Guid sourceReceiptId,
        Guid skuId,
        CancellationToken cancellationToken) =>
        db.ProductCostPriceHistories
            .Where(history =>
                history.SourceReceiptId == sourceReceiptId
                && history.SkuId == skuId)
            .OrderBy(history => history.ReceiptLineOrder)
            .ThenBy(history => history.SourceReceiptLineId)
            .ToListAsync(cancellationToken);

    public Task<ProductCostPriceHistory?> GetLatestAppliedHistoryAsync(
        Guid skuId,
        CancellationToken cancellationToken) =>
        db.ProductCostPriceHistories
            .AsNoTracking()
            .Where(history => history.SkuId == skuId && history.WasApplied)
            .OrderByDescending(history => history.SourceApprovedAt)
            .ThenByDescending(history => history.SourceReceiptId)
            .ThenByDescending(history => history.ReceiptLineOrder)
            .ThenByDescending(history => history.SourceReceiptLineId)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<List<Guid>> GetActiveVariantIdsAsync(CancellationToken cancellationToken) =>
        db.ProductVariants
            .AsNoTracking()
            .OrderBy(variant => variant.SkuCode)
            .Select(variant => variant.Id)
            .ToListAsync(cancellationToken);

    public Task<List<ProductCostPriceHistory>> GetAppliedHistoryForSkuAsync(
        Guid skuId,
        CancellationToken cancellationToken) =>
        db.ProductCostPriceHistories
            .AsNoTracking()
            .Where(history =>
                history.SkuId == skuId
                && history.WasApplied
                && history.IncomingQuantity > 0
                && history.IncomingUnitCost > 0)
            .OrderBy(history => history.SourceApprovedAt)
            .ThenBy(history => history.SourceReceiptId)
            .ThenBy(history => history.ReceiptLineOrder)
            .ThenBy(history => history.SourceReceiptLineId)
            .ToListAsync(cancellationToken);

    public async Task<List<Guid>> GetPendingReconciliationReceiptIdsAsync(
        Guid skuId,
        CancellationToken cancellationToken)
    {
        var groups = await db.ProductCostPriceHistories
            .AsNoTracking()
            .Where(history =>
                history.SkuId == skuId
                && !history.WasApplied
                && history.ProcessingResult == "reconciliation_required")
            .GroupBy(history => history.SourceReceiptId)
            .Select(group => new
            {
                SourceReceiptId = group.Key,
                ApprovedAt = group.Min(history => history.SourceApprovedAt)
            })
            .ToListAsync(cancellationToken);

        return groups
            .OrderBy(group => group.ApprovedAt)
            .ThenBy(group => group.SourceReceiptId.ToString("D"), StringComparer.Ordinal)
            .Select(group => group.SourceReceiptId)
            .ToList();
    }

    public void AddHistory(ProductCostPriceHistory history) =>
        db.ProductCostPriceHistories.Add(history);

    public async Task SaveChangesAsync(CancellationToken cancellationToken) =>
        await db.SaveChangesAsync(cancellationToken);
}
