namespace DocumentService.Application.Interfaces;

public interface IProductCatalogClient
{
    Task<List<ProductCatalogItem>> GetSkusAsync(IEnumerable<Guid> skuIds, CancellationToken ct = default);
}

public sealed record ProductCatalogItem(
    Guid SkuId,
    string SkuCode,
    string ProductName,
    string? UnitName,
    decimal RetailPrice);
