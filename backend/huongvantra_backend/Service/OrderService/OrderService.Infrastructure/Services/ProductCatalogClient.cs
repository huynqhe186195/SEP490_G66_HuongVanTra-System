using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using OrderService.Application.Interfaces;

namespace OrderService.Infrastructure.Services;

public class ProductCatalogClient(HttpClient httpClient, ILogger<ProductCatalogClient> logger) : IProductCatalogClient
{
    public async Task<IReadOnlyList<ProductSkuCatalogProfile>> GetSkuProfilesAsync(
        IEnumerable<Guid> skuIds,
        CancellationToken ct = default)
    {
        var targetIds = skuIds
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();
        if (targetIds.Count == 0)
            return [];

        try
        {
            var query = string.Join(
                "&",
                targetIds.Select(id => $"skuIds={Uri.EscapeDataString(id.ToString())}"));
            var response = await httpClient.GetFromJsonAsync<List<ProductSkuCatalogResponse>>(
                $"api/v1/skus/order-catalog?{query}",
                cancellationToken: ct);

            return response?
                .Select(item => new ProductSkuCatalogProfile(
                    item.SkuId,
                    item.CategoryId,
                    item.InventoryUnit))
                .ToList() ?? [];
        }
        catch (Exception ex) when (
            ex is HttpRequestException or NotSupportedException or JsonException ||
            ex is TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Unable to resolve order catalog for {SkuCount} SKU(s)", targetIds.Count);
            return [];
        }
    }

    private sealed record ProductSkuCatalogResponse(
        Guid SkuId,
        int? CategoryId,
        string InventoryUnit);
}
