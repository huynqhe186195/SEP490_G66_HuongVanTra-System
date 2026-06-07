using ProductService.Domain.Entities;

namespace ProductService.Application.Interfaces;

public interface IProductSkuRepository
{
    Task<(List<ProductSku> Items, int TotalCount)> GetPagedAsync(
        string? search, Guid? productId, bool? isActive,
        int page, int pageSize);
    Task<List<ProductSku>> GetAllAsync(bool includeInactive = false);
    Task<ProductSku?> GetByIdAsync(Guid id);
    Task<ProductSku?> GetBySkuCodeAsync(string skuCode);
    Task<List<ProductSku>> GetByProductIdAsync(Guid productId);
    Task<bool> ExistsSkuCodeAsync(string skuCode, Guid? excludeId = null);
    Task<ProductSku> CreateAsync(ProductSku sku);
    Task<ProductSku> UpdateAsync(ProductSku sku);
    Task DeleteAsync(ProductSku sku);
}
