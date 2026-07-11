namespace OrderService.Application.Interfaces;

public interface IInventoryCatalogClient
{
    Task DeductMaterialsAsync(IEnumerable<(Guid SkuId, int Quantity)> items, CancellationToken ct = default);
}
