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

    public void AddHistory(ProductCostPriceHistory history) =>
        db.ProductCostPriceHistories.Add(history);

    public async Task SaveChangesAsync(CancellationToken cancellationToken) =>
        await db.SaveChangesAsync(cancellationToken);
}
