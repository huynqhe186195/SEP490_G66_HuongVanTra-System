using Microsoft.EntityFrameworkCore;
using ProductService.Application;
using ProductService.Application.Interfaces;
using ProductService.Domain.Entities;
using ProductService.Domain.Enums;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.Repositories;

public class ProductRepository(ProductDbContext _db) : IProductRepository
{
    public async Task<(List<Product> Items, int TotalCount)> GetPagedAsync(
        string? search, int? categoryId, bool? isActive, bool? isDeleted,
        int page, int pageSize, CatalogViewScope scope = CatalogViewScope.Warehouse,
        ProductType? productType = null)
    {
        IQueryable<Product> query = isDeleted == true
            ? IncludeAggregate(_db.Products.IgnoreQueryFilters()).Where(p => p.IsDeleted)
            : scope == CatalogViewScope.Warehouse
                ? IncludeAggregate(_db.Products.IgnoreQueryFilters())
                : IncludeAggregate(_db.Products);

        if (isDeleted == false)
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

        if (productType.HasValue)
            query = query.Where(p => p.ProductType == productType.Value);

        if (scope == CatalogViewScope.Store)
            query = query.Where(p => p.SyncedToStoreAt != null || p.ProductType == ProductType.NGUYEN_LIEU);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(p => p.CreatedAt)
            .ThenBy(p => p.Name)
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
            query = query.Where(p => p.SyncedToStoreAt != null || p.ProductType == ProductType.NGUYEN_LIEU);
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
                && p.Variants.Any(v => !v.IsDeleted && v.SyncedToStoreAt != null))
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

    public Task<int> CountPendingVariantSyncAsync(CancellationToken ct = default) =>
        _db.ProductVariants.CountAsync(v => !v.IsDeleted && v.IsActive && v.SyncedToStoreAt == null, ct);

    public async Task<List<ProductVariant>> SyncPendingVariantsToStoreAsync(DateTime syncedAt, CancellationToken ct = default)
    {
        var pending = await _db.ProductVariants
            .Include(v => v.Product)
                .ThenInclude(p => p.Category)
            .Where(v => !v.IsDeleted && v.IsActive && v.SyncedToStoreAt == null)
            .ToListAsync(ct);

        foreach (var v in pending)
        {
            v.SyncedToStoreAt = syncedAt;
            v.UpdatedAt = syncedAt;
        }

        if (pending.Count > 0)
            await _db.SaveChangesAsync(ct);

        return pending;
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

    public async Task<bool> ExistsVariantSkuCodeAsync(string skuCode, Guid? excludeVariantId = null, Guid? excludeProductId = null)
    {
        var query = _db.ProductVariants.Where(v => v.SkuCode == skuCode);
        if (excludeVariantId.HasValue) query = query.Where(v => v.Id != excludeVariantId.Value);
        if (excludeProductId.HasValue) query = query.Where(v => v.ProductId != excludeProductId.Value);
        return await query.AnyAsync();
    }

    public async Task<Product?> GetByIdAsync(Guid id, bool includeDeleted = false)
    {
        var query = includeDeleted
            ? IncludeAggregate(_db.Products.IgnoreQueryFilters())
            : IncludeAggregate(_db.Products);

        return await query.FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<ProductVariant?> GetVariantByIdAsync(Guid id, bool includeDeleted = false)
    {
        var query = includeDeleted
            ? _db.ProductVariants.IgnoreQueryFilters()
            : _db.ProductVariants;

        return await query
            .Include(v => v.Product)
            .Include(v => v.BomLines)
                .ThenInclude(b => b.Material)
            .FirstOrDefaultAsync(v => v.Id == id);
    }

    public async Task<List<Product>> GetProductsByIdsAsync(IEnumerable<Guid> ids, bool includeDeleted = false)
    {
        var targetIds = ids.ToHashSet();
        var query = includeDeleted
            ? _db.Products.IgnoreQueryFilters()
            : _db.Products;

        return await query
            .Where(p => targetIds.Contains(p.Id))
            .ToListAsync();
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

    public async Task<ProductVariant> ReplaceVariantBomAsync(Guid variantId, List<ProductVariantBomLine> lines)
    {
        var variant = await _db.ProductVariants
            .Include(v => v.BomLines)
            .FirstAsync(v => v.Id == variantId);

        var now = DateTime.UtcNow;
        foreach (var line in variant.BomLines)
        {
            line.IsDeleted = true;
            line.UpdatedAt = now;
        }

        foreach (var line in lines)
        {
            line.ProductVariantId = variantId;
            line.CreatedAt = now;
            line.UpdatedAt = now;
            _db.ProductVariantBomLines.Add(line);
        }

        variant.UpdatedAt = now;
        await _db.SaveChangesAsync();
        return (await GetVariantByIdAsync(variantId))!;
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
            .Include(p => p.Images)
            .Include(p => p.Units)
            .Include(p => p.Variants)
                .ThenInclude(v => v.Units)
            .Include(p => p.Variants)
                .ThenInclude(v => v.BomLines)
                    .ThenInclude(b => b.Material);
}
