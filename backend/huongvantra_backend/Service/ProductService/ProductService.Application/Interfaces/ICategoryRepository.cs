using ProductService.Application;
using ProductService.Domain.Entities;

namespace ProductService.Application.Interfaces;

public interface ICategoryRepository
{
    Task<List<Category>> GetAllAsync(bool? isDeleted = null, CatalogViewScope scope = CatalogViewScope.Warehouse);
    Task<int> CountPendingStoreSyncAsync(CancellationToken ct = default);
    Task<int> SyncPendingToStoreAsync(DateTime syncedAt, CancellationToken ct = default);
    Task<int> SyncCategoriesWithSyncedProductsAsync(DateTime syncedAt, CancellationToken ct = default);
    Task<Category?> GetByIdAsync(int id, bool includeDeleted = false);
    Task<bool> ExistsNameAsync(string name, int? excludeId = null, bool includeDeleted = true);
    Task<Category> CreateAsync(Category category);
    Task<Category> UpdateAsync(Category category);
    Task DeleteAsync(Category category);
    Task RestoreAsync(Category category);
}
