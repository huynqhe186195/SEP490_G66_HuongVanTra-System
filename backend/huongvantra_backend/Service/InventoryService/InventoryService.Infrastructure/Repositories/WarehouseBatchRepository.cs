using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class WarehouseBatchRepository(InventoryDbContext _db) : IWarehouseBatchRepository
{
    private const string WarehouseLocation = "Warehouse";

    private IQueryable<WarehouseBatch> WithItems() =>
        _db.WarehouseBatches.Include(b => b.Items);

    public Task<WarehouseBatch?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        WithItems().FirstOrDefaultAsync(b => b.Id == id, ct);

    public Task<WarehouseBatch?> GetByBatchCodeAsync(string batchCode, CancellationToken ct = default)
    {
        var normalized = batchCode.Trim().ToUpperInvariant();
        return WithItems().FirstOrDefaultAsync(b => b.BatchCode == normalized, ct);
    }

    public Task<WarehouseBatch?> GetByLotCodeAsync(string lotCode, CancellationToken ct = default)
    {
        var normalized = lotCode.Trim().ToUpperInvariant();
        return WithItems()
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync(b => b.LotCode.ToUpper() == normalized, ct);
    }

    public Task<WarehouseBatch?> FindBySupplierLotIdentityAsync(
        Guid supplierId,
        Guid skuId,
        string normalizedSupplierLotCode,
        CancellationToken ct = default) =>
        WithItems().FirstOrDefaultAsync(
            b => b.SupplierId == supplierId
                && b.SkuId == skuId
                && b.NormalizedSupplierLotCode == normalizedSupplierLotCode,
            ct);

    public async Task<List<WarehouseBatch>> GetListAsync(
        Guid? skuId, string? search, bool availableOnly, CancellationToken ct = default)
    {
        var query = WithItems().AsQueryable();

        if (skuId.HasValue)
            query = query.Where(b => b.Items.Any(i => i.SkuId == skuId.Value));

        if (availableOnly)
            query = query.Where(b => b.Status == "active" && b.Items.Any(i => i.QuantityOnHand > 0));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(b =>
                b.BatchCode.ToLower().Contains(s) ||
                b.LotCode.ToLower().Contains(s) ||
                (b.Supplier != null && b.Supplier.ToLower().Contains(s)) ||
                (b.Note != null && b.Note.ToLower().Contains(s)) ||
                (b.SourceType != null && b.SourceType.ToLower().Contains(s)) ||
                (b.SourceReferenceCode != null && b.SourceReferenceCode.ToLower().Contains(s)) ||
                b.Items.Any(i =>
                    i.SkuCode.ToLower().Contains(s) ||
                    (i.ProductSnapshotName != null && i.ProductSnapshotName.ToLower().Contains(s))));
        }

        return await query
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync(ct);
    }

    public Task<List<WarehouseBatchItem>> GetAvailableItemsForSkuAsync(Guid skuId, CancellationToken ct = default) =>
        GetAvailableItemsForSkuAsync(skuId, WarehouseLocation, ct);

    public Task<List<WarehouseBatchItem>> GetAvailableItemsForSkuAsync(Guid skuId, string location, CancellationToken ct = default) =>
        _db.WarehouseBatchItems
            .Include(i => i.Batch)
            .Where(i =>
                i.SkuId == skuId &&
                i.QuantityOnHand > 0 &&
                i.Batch != null &&
                i.Batch.Status == "active" &&
                i.Batch.Location == location)
            .OrderBy(i => i.Batch!.ExpiresAt ?? DateTime.MaxValue)
            .ThenBy(i => i.Batch!.CreatedAt)
            .ThenBy(i => i.CreatedAt)
            .ToListAsync(ct);

    public Task<bool> ExistsLotCodeAsync(string lotCode, Guid? excludeId = null, CancellationToken ct = default)
    {
        var normalized = lotCode.Trim().ToUpperInvariant();
        var query = _db.WarehouseBatches.Where(b => b.LotCode.ToUpper() == normalized);
        if (excludeId.HasValue)
            query = query.Where(b => b.Id != excludeId.Value);
        return query.AnyAsync(ct);
    }

    public Task<bool> ExistsBatchCodeAsync(string batchCode, Guid? excludeId = null, CancellationToken ct = default)
    {
        var normalized = batchCode.Trim().ToUpperInvariant();
        var query = _db.WarehouseBatches.Where(b => b.BatchCode == normalized);
        if (excludeId.HasValue)
            query = query.Where(b => b.Id != excludeId.Value);
        return query.AnyAsync(ct);
    }

    public Task<int> SumQuantityOnHandAsync(Guid skuId, CancellationToken ct = default) =>
        SumQuantityOnHandAsync(skuId, WarehouseLocation, ct);

    public Task<int> SumQuantityOnHandAsync(Guid skuId, string location, CancellationToken ct = default) =>
        _db.WarehouseBatchItems
            .Where(i => i.SkuId == skuId)
            .Join(
                _db.WarehouseBatches.Where(b => b.Status == "active" && b.Location == location),
                i => i.WarehouseBatchId,
                b => b.Id,
                (i, _) => i.QuantityOnHand)
            .SumAsync(ct);

    public async Task<decimal> CalculateMovingAverageCostAsync(Guid skuId, CancellationToken ct = default)
    {
        var items = await _db.WarehouseBatchItems
            .Where(i => i.SkuId == skuId && i.UnitCost.HasValue && i.Batch != null && i.Batch.Location == WarehouseLocation)
            .Select(i => new { i.InitialQuantity, UnitCost = i.UnitCost ?? 0m })
            .ToListAsync(ct);

        if (items.Count == 0) return 0m;

        var totalQty = items.Sum(i => (decimal)i.InitialQuantity);
        if (totalQty == 0) return 0m;

        var totalValue = items.Sum(i => i.InitialQuantity * i.UnitCost);
        return Math.Round(totalValue / totalQty, 2);
    }

    public async Task<Dictionary<Guid, int>> GetQuantitySumsBySkuAsync(CancellationToken ct = default)
    {
        var rows = await _db.WarehouseBatchItems
            .Join(
                _db.WarehouseBatches.Where(b => b.Status == "active" && b.Location == WarehouseLocation),
                i => i.WarehouseBatchId,
                b => b.Id,
                (i, _) => new { i.SkuId, i.QuantityOnHand })
            .GroupBy(x => x.SkuId)
            .Select(g => new { SkuId = g.Key, Total = g.Sum(x => x.QuantityOnHand) })
            .ToListAsync(ct);

        return rows.ToDictionary(x => x.SkuId, x => x.Total);
    }

    public Task<int> CountActiveLotsForSkuAsync(Guid skuId, CancellationToken ct = default) =>
        _db.WarehouseBatchItems
            .Where(i => i.SkuId == skuId && i.QuantityOnHand > 0 && i.Batch != null && i.Batch.Status == "active")
            .Select(i => i.WarehouseBatchId)
            .Distinct()
            .CountAsync(ct);

    public async Task<decimal> CalculateTotalWarehouseValueAsync(CancellationToken ct = default)
    {
        return await _db.WarehouseBatchItems
            .Where(b => b.QuantityOnHand > 0 && b.UnitCost.HasValue && b.Batch != null && b.Batch.Location == WarehouseLocation)
            .SumAsync(b => b.QuantityOnHand * b.UnitCost!.Value, ct);
    }

    public async Task AddAsync(WarehouseBatch batch, CancellationToken ct = default) =>
        await _db.WarehouseBatches.AddAsync(batch, ct);

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
