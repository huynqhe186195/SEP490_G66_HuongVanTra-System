using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using OrderService.Application.Interfaces;

namespace OrderService.Infrastructure.Services;

public class ProductCatalogClient(HttpClient httpClient, ILogger<ProductCatalogClient> logger) : IProductCatalogClient
{
    public async Task<int?> GetSkuCategoryIdAsync(Guid skuId, CancellationToken ct = default)
    {
        try
        {
            var response = await httpClient.GetFromJsonAsync<ProductSkuCatalogResponse>(
                $"api/v1/skus/{skuId}",
                cancellationToken: ct);

            return response?.CategoryId;
        }
        catch (Exception ex) when (
            ex is HttpRequestException or NotSupportedException ||
            ex is TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Unable to resolve category for SKU {SkuId}", skuId);
            return null;
        }
    }

    private sealed record ProductSkuCatalogResponse(int? CategoryId);
}
