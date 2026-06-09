namespace ProductService.Application.DTOs.Responses;

public record CatalogSyncResponse(
    int CategoriesSynced,
    int ProductsSynced,
    int SkusSynced,
    DateTime SyncedAt);

public record CatalogPendingSyncResponse(
    int Categories,
    int Products,
    int Skus);
