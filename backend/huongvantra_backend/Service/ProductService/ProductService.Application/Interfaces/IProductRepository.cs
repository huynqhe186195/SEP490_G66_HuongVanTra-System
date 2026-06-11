using ProductService.Application;
using ProductService.Domain.Entities;

namespace ProductService.Application.Interfaces;

public interface IProductRepository
{
    Task<(List<Product> Items, int TotalCount)> GetPagedAsync(
        string? search, int? categoryId, bool? isActive, bool? isDeleted,
        int page, int pageSize, CatalogViewScope scope = CatalogViewScope.Warehouse);
    Task<List<Product>> GetAllAsync(bool includeInactive = false, CatalogViewScope scope = CatalogViewScope.Warehouse);
    Task<int> CountPendingStoreSyncAsync(CancellationToken ct = default);
    Task<int> SyncPendingToStoreAsync(DateTime syncedAt, CancellationToken ct = default);
    Task<int> SyncProductsWithSyncedSkusAsync(DateTime syncedAt, CancellationToken ct = default);
    Task<Product?> GetByIdAsync(Guid id, bool includeDeleted = false);
    Task<bool> ExistsNameAsync(string name, Guid? excludeProductId = null, bool includeDeleted = true);
    Task<bool> ExistsVariantSkuCodeAsync(string skuCode, Guid? excludeId = null);
    Task<Product> CreateAsync(Product product);
    Task<Product> UpdateAsync(Product product);
    Task DeleteAsync(Product product);
    Task RestoreAsync(Product product);
}
