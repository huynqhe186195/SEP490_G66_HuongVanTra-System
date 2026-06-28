using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class CatalogSyncLogic(
    ICategoryRepository _categoryRepository,
    IProductRepository _productRepository,
    IProductEventPublisher _eventPublisher)
{
    public async Task<CatalogPendingSyncResponse> GetPendingAsync(CancellationToken ct = default)
    {
        var categories = await _categoryRepository.CountPendingStoreSyncAsync(ct);
        var products = await _productRepository.CountPendingStoreSyncAsync(ct);
        var variants = await _productRepository.CountPendingVariantSyncAsync(ct);
        return new CatalogPendingSyncResponse(categories, products, variants);
    }

    public async Task<CatalogSyncResponse> SyncToStoreAsync(CancellationToken ct = default)
    {
        var syncedAt = DateTime.UtcNow;

        var categoriesSynced = await _categoryRepository.SyncPendingToStoreAsync(syncedAt, ct);
        var productsSynced = await _productRepository.SyncPendingToStoreAsync(syncedAt, ct);
        var syncedVariants = await _productRepository.SyncPendingVariantsToStoreAsync(syncedAt, ct);

        // Cascade: ensure parent products and categories are synced if their variants are
        productsSynced += await _productRepository.SyncProductsWithSyncedSkusAsync(syncedAt, ct);
        categoriesSynced += await _categoryRepository.SyncCategoriesWithSyncedProductsAsync(syncedAt, ct);

        foreach (var v in syncedVariants)
            await _eventPublisher.PublishSkuCreatedAsync(v.Id, v.SkuCode, v.WeightInGrams);

        return new CatalogSyncResponse(
            categoriesSynced,
            productsSynced,
            syncedVariants.Count,
            syncedAt);
    }

    public static void EnsureNotWarehouseSource(bool isWarehouseCatalogView)
    {
        if (isWarehouseCatalogView)
            throw new ProductValidationException("Thủ kho là nguồn dữ liệu — không cần đồng bộ catalog cửa hàng.");
    }
}
