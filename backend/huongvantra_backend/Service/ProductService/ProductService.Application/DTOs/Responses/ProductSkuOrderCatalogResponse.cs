namespace ProductService.Application.DTOs.Responses;

public record ProductSkuOrderCatalogResponse(
    Guid SkuId,
    int? CategoryId,
    string InventoryUnit);
