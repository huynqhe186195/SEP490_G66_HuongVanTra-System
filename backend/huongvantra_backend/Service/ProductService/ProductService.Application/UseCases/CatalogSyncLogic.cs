using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class CatalogSyncLogic(
    ICategoryRepository _categoryRepository,
    IProductRepository _productRepository,
    IProductSkuRepository _skuRepository,
    IProductEventPublisher _eventPublisher)
{
    public async Task<CatalogPendingSyncResponse> GetPendingAsync(CancellationToken ct = default)
    {
        var categories = await _categoryRepository.CountPendingStoreSyncAsync(ct);
        var products = await _productRepository.CountPendingStoreSyncAsync(ct);
        var skus = await _skuRepository.CountPendingStoreSyncAsync(ct);
        return new CatalogPendingSyncResponse(categories, products, skus);
    }

    public async Task<CatalogSyncResponse> SyncToStoreAsync(CancellationToken ct = default)
    {
        var syncedAt = DateTime.UtcNow;

        var categoriesSynced = await _categoryRepository.SyncPendingToStoreAsync(syncedAt, ct);
        var productsSynced = await _productRepository.SyncPendingToStoreAsync(syncedAt, ct);
        var syncedSkus = await _skuRepository.SyncPendingToStoreAsync(syncedAt, ct);

        // Sửa lệch: SKU đã sync nhưng SP/DM cha chưa (dữ liệu cũ hoặc SP đang ẩn)
        productsSynced += await _productRepository.SyncProductsWithSyncedSkusAsync(syncedAt, ct);
        categoriesSynced += await _categoryRepository.SyncCategoriesWithSyncedProductsAsync(syncedAt, ct);

        foreach (var sku in syncedSkus)
            await _eventPublisher.PublishSkuCreatedAsync(sku.Id, sku.SkuCode, sku.WeightInGrams);

        return new CatalogSyncResponse(
            categoriesSynced,
            productsSynced,
            syncedSkus.Count,
            syncedAt);
    }

    public static void EnsureNotWarehouseSource(bool isWarehouseCatalogView)
    {
        if (isWarehouseCatalogView)
            throw new ProductValidationException("Thủ kho là nguồn dữ liệu — không cần đồng bộ catalog cửa hàng.");
    }
}
