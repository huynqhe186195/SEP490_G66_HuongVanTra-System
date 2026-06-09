using Microsoft.EntityFrameworkCore;
using ProductService.Application;
using ProductService.Application.Interfaces;
using ProductService.Domain.Entities;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.Repositories;

public class ProductSkuRepository(ProductDbContext _db) : IProductSkuRepository
{
    public async Task<(List<ProductSku> Items, int TotalCount)> GetPagedAsync(
        string? search, Guid? productId, bool? isActive,
        int page, int pageSize, CatalogViewScope scope = CatalogViewScope.Warehouse)
    {
        var query = _db.ProductSkus.AsQueryable();

        if (scope == CatalogViewScope.Store)
            query = query.Where(sku => sku.SyncedToStoreAt != null);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(sku =>
                sku.SkuCode.ToLower().Contains(s) ||
                sku.PackagingType.ToLower().Contains(s));
        }

        if (productId.HasValue)
            query = query.Where(sku => sku.ProductId == productId.Value);

        if (isActive == true)
            query = query.Where(sku => sku.IsActive && sku.Product.IsActive);
        else if (isActive == false)
            query = query.Where(sku => !sku.IsActive);

        var totalCount = await query.CountAsync();
        var items = await query
            .Include(sku => sku.Product)
            .ThenInclude(product => product.Category)
            .OrderBy(sku => sku.SkuCode)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<List<ProductSku>> GetAllAsync(bool includeInactive = false, CatalogViewScope scope = CatalogViewScope.Warehouse)
    {
        var query = _db.ProductSkus.AsQueryable();
        if (!includeInactive) query = query.Where(s => s.IsActive);
        if (scope == CatalogViewScope.Store)
            query = query.Where(s => s.SyncedToStoreAt != null);
        return await query
            .Include(s => s.Product)
            .ThenInclude(product => product.Category)
            .OrderBy(s => s.SkuCode)
            .ToListAsync();
    }

    public async Task<ProductSku?> GetByIdAsync(Guid id, CatalogViewScope scope = CatalogViewScope.Warehouse)
    {
        var query = _db.ProductSkus
            .Include(s => s.Product)
            .ThenInclude(product => product.Category)
            .Where(s => s.Id == id);

        if (scope == CatalogViewScope.Store)
            query = query.Where(s => s.SyncedToStoreAt != null);

        return await query.FirstOrDefaultAsync();
    }

    public async Task<ProductSku?> GetBySkuCodeAsync(string skuCode, CatalogViewScope scope = CatalogViewScope.Warehouse)
    {
        var query = _db.ProductSkus
            .Include(s => s.Product)
            .ThenInclude(product => product.Category)
            .Where(s => s.SkuCode == skuCode);

        if (scope == CatalogViewScope.Store)
            query = query.Where(s => s.SyncedToStoreAt != null);

        return await query.FirstOrDefaultAsync();
    }

    public async Task<List<ProductSku>> GetByProductIdAsync(Guid productId, CatalogViewScope scope = CatalogViewScope.Warehouse)
    {
        var query = _db.ProductSkus
            .Include(s => s.Product)
            .ThenInclude(product => product.Category)
            .Where(s => s.ProductId == productId);

        if (scope == CatalogViewScope.Store)
            query = query.Where(s => s.SyncedToStoreAt != null);

        return await query.OrderBy(s => s.SkuCode).ToListAsync();
    }

    public Task<int> CountPendingStoreSyncAsync(CancellationToken ct = default) =>
        _db.ProductSkus.CountAsync(s => !s.IsDeleted && s.IsActive && s.SyncedToStoreAt == null, ct);

    public async Task<List<ProductSku>> SyncPendingToStoreAsync(DateTime syncedAt, CancellationToken ct = default)
    {
        var pending = await _db.ProductSkus
            .Where(s => !s.IsDeleted && s.IsActive && s.SyncedToStoreAt == null)
            .ToListAsync(ct);

        foreach (var sku in pending)
        {
            sku.SyncedToStoreAt = syncedAt;
            sku.UpdatedAt = syncedAt;
        }

        if (pending.Count > 0)
            await _db.SaveChangesAsync(ct);

        return pending;
    }

    public async Task<bool> ExistsSkuCodeAsync(string skuCode, Guid? excludeId = null)
    {
        var query = _db.ProductSkus.Where(s => s.SkuCode == skuCode);
        if (excludeId.HasValue) query = query.Where(s => s.Id != excludeId.Value);
        return await query.AnyAsync();
    }

    public async Task<ProductSku> CreateAsync(ProductSku sku)
    {
        _db.ProductSkus.Add(sku);
        await _db.SaveChangesAsync();
        return sku;
    }

    public async Task<ProductSku> UpdateAsync(ProductSku sku)
    {
        _db.ProductSkus.Update(sku);
        await _db.SaveChangesAsync();
        return sku;
    }

    public async Task DeleteAsync(ProductSku sku)
    {
        sku.IsDeleted = true;
        sku.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }
}
