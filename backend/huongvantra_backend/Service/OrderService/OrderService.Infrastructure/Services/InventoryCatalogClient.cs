using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using OrderService.Application.Interfaces;

namespace OrderService.Infrastructure.Services;

public class InventoryCatalogClient(HttpClient httpClient, ILogger<InventoryCatalogClient> logger) : IInventoryCatalogClient
{
    public async Task DeductMaterialsAsync(IEnumerable<(Guid SkuId, int Quantity)> items, CancellationToken ct = default)
    {
        var body = new DeductMaterialsRequest(
            items.Select(i => new DeductMaterialItem(i.SkuId, i.Quantity)).ToList());

        var response = await httpClient.PostAsJsonAsync("api/v1/inventory/deduct-materials", body, ct);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(ct);
            logger.LogError("Inventory deduct-materials failed {Status}: {Error}", response.StatusCode, error);
            response.EnsureSuccessStatusCode();
        }
    }

    private sealed record DeductMaterialsRequest(List<DeductMaterialItem> Items);
    private sealed record DeductMaterialItem(Guid SkuId, int Quantity);
}
