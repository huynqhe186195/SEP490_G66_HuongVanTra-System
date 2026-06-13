using Microsoft.EntityFrameworkCore;
using ProductService.Application;
using ProductService.Application.Interfaces;
using ProductService.Domain.Entities;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.Repositories;

public class ProductRepository(ProductDbContext _db) : IProductRepository
{
    public async Task<(List<Product> Items, int TotalCount)> GetPagedAsync(
        string? search, int? categoryId, bool? isActive, bool? isDeleted,
        int page, int pageSize, CatalogViewScope scope = CatalogViewScope.Warehouse)
    {
        IQueryable<Product> query = isDeleted == true
            ? IncludeAggregate(_db.Products.IgnoreQueryFilters())
            : IncludeAggregate(_db.Products);

        if (isDeleted == true)
            query = query.Where(p => p.IsDeleted);
        else if (isDeleted == false)
            query = query.Where(p => !p.IsDeleted);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(s) ||
                (p.Origin != null && p.Origin.ToLower().Contains(s)) ||
                (p.Description != null && p.Description.ToLower().Contains(s)));
        }

        if (categoryId.HasValue)
            query = query.Where(p => p.CategoryId == categoryId.Value);

        if (isDeleted != true && isActive.HasValue)
            query = query.Where(p => p.IsActive == isActive.Value);

        if (scope == CatalogViewScope.Store)
            query = query.Where(p => p.SyncedToStoreAt != null);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<List<Product>> GetAllAsync(bool includeInactive = false, CatalogViewScope scope = CatalogViewScope.Warehouse)
    {
        var query = IncludeAggregate(_db.Products);
        if (!includeInactive) query = query.Where(p => p.IsActive);
        if (scope == CatalogViewScope.Store)
            query = query.Where(p => p.SyncedToStoreAt != null);
        return await query.OrderBy(p => p.Name).ToListAsync();
    }

    public Task<int> CountPendingStoreSyncAsync(CancellationToken ct = default) =>
        _db.Products.CountAsync(p => !p.IsDeleted && p.SyncedToStoreAt == null, ct);

    public async Task<int> SyncPendingToStoreAsync(DateTime syncedAt, CancellationToken ct = default)
    {
        var pending = await _db.Products
            .Where(p => !p.IsDeleted && p.SyncedToStoreAt == null)
            .ToListAsync(ct);

        foreach (var product in pending)
        {
            product.SyncedToStoreAt = syncedAt;
            product.UpdatedAt = syncedAt;
        }

        if (pending.Count > 0)
            await _db.SaveChangesAsync(ct);

        return pending.Count;
    }

    public async Task<int> SyncProductsWithSyncedSkusAsync(DateTime syncedAt, CancellationToken ct = default)
    {
        var pending = await _db.Products
            .Where(p => !p.IsDeleted && p.SyncedToStoreAt == null
                && p.Skus.Any(s => !s.IsDeleted && s.SyncedToStoreAt != null))
            .ToListAsync(ct);

        foreach (var product in pending)
        {
            product.SyncedToStoreAt = syncedAt;
            product.UpdatedAt = syncedAt;
        }

        if (pending.Count > 0)
            await _db.SaveChangesAsync(ct);

        return pending.Count;
    }

    public async Task<bool> ExistsNameAsync(string name, Guid? excludeProductId = null, bool includeDeleted = true)
    {
        var normalized = name.Trim().ToLower();
        IQueryable<Product> query = includeDeleted
            ? _db.Products.IgnoreQueryFilters()
            : _db.Products;

        query = query.Where(p => p.Name.ToLower() == normalized);
        if (excludeProductId.HasValue)
            query = query.Where(p => p.Id != excludeProductId.Value);

        return await query.AnyAsync();
    }

    public async Task<bool> ExistsVariantSkuCodeAsync(string skuCode, Guid? excludeId = null)
    {
        var query = _db.ProductVariants.Where(v => v.SkuCode == skuCode);
        if (excludeId.HasValue) query = query.Where(v => v.Id != excludeId.Value);
        return await query.AnyAsync();
    }

    public async Task<Product?> GetByIdAsync(Guid id, bool includeDeleted = false)
    {
        var query = includeDeleted
            ? IncludeAggregate(_db.Products.IgnoreQueryFilters())
            : IncludeAggregate(_db.Products);

        return await query.FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<Product> CreateAsync(Product product)
    {
        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        return (await GetByIdAsync(product.Id))!;
    }

    public async Task<Product> UpdateAsync(Product product)
    {
        _db.Products.Update(product);
        await _db.SaveChangesAsync();
        return (await GetByIdAsync(product.Id, includeDeleted: true))!;
    }

    public async Task DeleteAsync(Product product)
    {
        product.IsDeleted = true;
        product.IsActive = false;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task RestoreAsync(Product product)
    {
        product.IsDeleted = false;
        product.IsActive = true;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    private static IQueryable<Product> IncludeAggregate(IQueryable<Product> query) =>
        query.Include(p => p.Category)
            .Include(p => p.Skus)
            .Include(p => p.Images)
            .Include(p => p.Units)
            .Include(p => p.Variants)
            .ThenInclude(v => v.Units);
}
