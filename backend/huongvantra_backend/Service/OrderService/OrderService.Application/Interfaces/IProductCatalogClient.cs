namespace OrderService.Application.Interfaces;

public interface IProductCatalogClient
{
    Task<int?> GetSkuCategoryIdAsync(Guid skuId, CancellationToken ct = default);
}
