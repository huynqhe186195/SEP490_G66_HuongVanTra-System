using Microsoft.EntityFrameworkCore;
using ProductService.Application.Interfaces;
using ProductService.Domain.Entities;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.Repositories;

public class ProductSkuRepository(ProductDbContext _db) : IProductSkuRepository
{
    public async Task<(List<ProductSku> Items, int TotalCount)> GetPagedAsync(
        string? search, Guid? productId, bool? isActive,
        int page, int pageSize)
    {
        var query = _db.ProductSkus.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(sku =>
                sku.SkuCode.ToLower().Contains(s) ||
                sku.PackagingType.ToLower().Contains(s));
        }

        if (productId.HasValue)
            query = query.Where(sku => sku.ProductId == productId.Value);

        if (isActive.HasValue)
            query = query.Where(sku => sku.IsActive == isActive.Value);

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

    public async Task<List<ProductSku>> GetAllAsync(bool includeInactive = false)
    {
        var query = _db.ProductSkus.AsQueryable();
        if (!includeInactive) query = query.Where(s => s.IsActive);
        return await query
            .Include(s => s.Product)
            .ThenInclude(product => product.Category)
            .OrderBy(s => s.SkuCode)
            .ToListAsync();
    }

    public async Task<ProductSku?> GetByIdAsync(Guid id) =>
        await _db.ProductSkus
            .Include(s => s.Product)
            .ThenInclude(product => product.Category)
            .FirstOrDefaultAsync(s => s.Id == id);

    public async Task<ProductSku?> GetBySkuCodeAsync(string skuCode) =>
        await _db.ProductSkus
            .Include(s => s.Product)
            .ThenInclude(product => product.Category)
            .FirstOrDefaultAsync(s => s.SkuCode == skuCode);

    public async Task<List<ProductSku>> GetByProductIdAsync(Guid productId) =>
        await _db.ProductSkus
            .Include(s => s.Product)
            .ThenInclude(product => product.Category)
            .Where(s => s.ProductId == productId)
            .OrderBy(s => s.SkuCode)
            .ToListAsync();

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
