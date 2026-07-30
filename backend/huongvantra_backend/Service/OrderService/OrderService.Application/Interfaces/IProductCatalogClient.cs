namespace OrderService.Application.Interfaces;

public interface IProductCatalogClient
{
    Task<IReadOnlyList<ProductSkuCatalogProfile>> GetSkuProfilesAsync(
        IEnumerable<Guid> skuIds,
        CancellationToken ct = default);
}

public sealed record ProductSkuCatalogProfile(
    Guid SkuId,
    int? CategoryId,
    string InventoryUnit,
    decimal CostPrice);
