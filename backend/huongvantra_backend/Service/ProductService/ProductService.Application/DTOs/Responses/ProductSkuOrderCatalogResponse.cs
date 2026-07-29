namespace ProductService.Application.DTOs.Responses;

public record ProductSkuOrderCatalogResponse(
    Guid SkuId,
    int? CategoryId,
    string InventoryUnit,
    string ProductType,
    bool IsPurchasable,
    bool CanBeBomComponent,
    bool CanUseInCustom,
    bool CanHaveBom);
