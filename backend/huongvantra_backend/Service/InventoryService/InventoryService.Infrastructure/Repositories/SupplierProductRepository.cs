using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class SupplierProductRepository(InventoryDbContext _db) : ISupplierProductRepository
{
    public Task<SupplierProduct?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.SupplierProducts
            .Include(p => p.Supplier)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<(List<SupplierProduct> Items, int TotalCount)> GetPagedBySupplierAsync(
        Guid? supplierId,
        string? search,
        string? productType,
        bool includeInactive,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _db.SupplierProducts.AsNoTracking()
            .Include(p => p.Supplier)
            .AsQueryable();

        if (supplierId.HasValue)
            query = query.Where(p => p.SupplierId == supplierId.Value);

        if (!includeInactive)
            query = query.Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(productType))
        {
            var type = productType.Trim();
            query = query.Where(p => p.ProductTypeSnapshot == type);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(p =>
                p.SkuCodeSnapshot.ToLower().Contains(keyword) ||
                p.SkuNameSnapshot.ToLower().Contains(keyword) ||
                (p.SupplierItemCode != null && p.SupplierItemCode.ToLower().Contains(keyword)) ||
                (p.SupplierItemName != null && p.SupplierItemName.ToLower().Contains(keyword)));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(p => p.SkuNameSnapshot)
            .ThenBy(p => p.SkuCodeSnapshot)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public Task<List<SupplierProduct>> GetActiveBySupplierAsync(Guid supplierId, CancellationToken ct = default) =>
        _db.SupplierProducts.AsNoTracking()
            .Where(p => p.SupplierId == supplierId && p.IsActive)
            .OrderBy(p => p.SkuNameSnapshot)
            .ToListAsync(ct);

    public Task<List<SupplierProduct>> GetBySkuIdAsync(Guid skuId, CancellationToken ct = default) =>
        _db.SupplierProducts.AsNoTracking()
            .Include(p => p.Supplier)
            .Where(p => p.SkuId == skuId && p.IsActive)
            .OrderBy(p => p.QuotedPrice)
            .ToListAsync(ct);

    public Task<bool> ExistsAsync(
        Guid supplierId,
        Guid skuId,
        Guid? excludeId = null,
        CancellationToken ct = default) =>
        _db.SupplierProducts.AsNoTracking()
            .AnyAsync(
                p => p.SupplierId == supplierId
                    && p.SkuId == skuId
                    && (excludeId == null || p.Id != excludeId),
                ct);

    public Task<bool> NormalizedItemCodeExistsAsync(
        Guid supplierId,
        string normalizedItemCode,
        Guid? excludeId = null,
        CancellationToken ct = default) =>
        _db.SupplierProducts.AsNoTracking()
            .AnyAsync(
                p => p.SupplierId == supplierId
                    && p.NormalizedSupplierItemCode == normalizedItemCode
                    && (excludeId == null || p.Id != excludeId),
                ct);

    public async Task ClearPrimarySourceAsync(Guid skuId, Guid keepId, CancellationToken ct = default)
    {
        var others = await _db.SupplierProducts
            .Where(p => p.SkuId == skuId && p.IsPrimarySource && p.Id != keepId)
            .ToListAsync(ct);

        foreach (var other in others)
        {
            other.IsPrimarySource = false;
            other.UpdatedAt = DateTime.UtcNow;
        }
    }

    public Task<List<SupplierProductPriceHistory>> GetPriceHistoryAsync(
        Guid supplierProductId,
        CancellationToken ct = default) =>
        _db.SupplierProductPriceHistories.AsNoTracking()
            .Where(h => h.SupplierProductId == supplierProductId)
            .OrderByDescending(h => h.ChangedAt)
            .ToListAsync(ct);

    public async Task AddAsync(SupplierProduct entity, CancellationToken ct = default) =>
        await _db.SupplierProducts.AddAsync(entity, ct);

    public async Task AddPriceHistoryAsync(SupplierProductPriceHistory entry, CancellationToken ct = default) =>
        await _db.SupplierProductPriceHistories.AddAsync(entry, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
