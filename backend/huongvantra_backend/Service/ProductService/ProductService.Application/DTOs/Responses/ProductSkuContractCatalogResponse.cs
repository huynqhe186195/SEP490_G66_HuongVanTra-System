namespace ProductService.Application.DTOs.Responses;

public record ProductSkuContractCatalogResponse(
    Guid SkuId,
    string SkuCode,
    string ProductName,
    string? UnitName,
    decimal RetailPrice);
