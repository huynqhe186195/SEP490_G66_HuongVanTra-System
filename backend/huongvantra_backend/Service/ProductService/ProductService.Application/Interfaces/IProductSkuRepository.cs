using ProductService.Application;
using ProductService.Domain.Entities;

namespace ProductService.Application.Interfaces;

public interface IProductSkuRepository
{
    Task<(List<ProductSku> Items, int TotalCount)> GetPagedAsync(
        string? search, Guid? productId, bool? isActive,
        int page, int pageSize, CatalogViewScope scope = CatalogViewScope.Warehouse);
    Task<List<ProductSku>> GetAllAsync(bool includeInactive = false, CatalogViewScope scope = CatalogViewScope.Warehouse);
    Task<ProductSku?> GetByIdAsync(Guid id, CatalogViewScope scope = CatalogViewScope.Warehouse);
    Task<ProductSku?> GetBySkuCodeAsync(string skuCode, CatalogViewScope scope = CatalogViewScope.Warehouse);
    Task<List<ProductSku>> GetByProductIdAsync(Guid productId, CatalogViewScope scope = CatalogViewScope.Warehouse);
    Task<int> CountPendingStoreSyncAsync(CancellationToken ct = default);
    Task<List<ProductSku>> SyncPendingToStoreAsync(DateTime syncedAt, CancellationToken ct = default);
    Task<bool> ExistsSkuCodeAsync(string skuCode, Guid? excludeId = null);
    Task<ProductSku> CreateAsync(ProductSku sku);
    Task<ProductSku> UpdateAsync(ProductSku sku);
    Task DeleteAsync(ProductSku sku);
}
