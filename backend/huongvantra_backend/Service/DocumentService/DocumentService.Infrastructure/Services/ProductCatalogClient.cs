using System.Net.Http.Json;
using DocumentService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace DocumentService.Infrastructure.Services;

public class ProductCatalogClient(HttpClient httpClient, ILogger<ProductCatalogClient> logger) : IProductCatalogClient
{
    public async Task<List<ProductCatalogItem>> GetSkusAsync(IEnumerable<Guid> skuIds, CancellationToken ct = default)
    {
        var ids = skuIds.Where(id => id != Guid.Empty).Distinct().ToList();
        if (ids.Count == 0)
            return [];

        try
        {
            var query = string.Join("&", ids.Select(id => $"skuIds={id}"));
            var response = await httpClient.GetFromJsonAsync<List<ProductCatalogItem>>(
                $"api/v1/skus/contract-catalog?{query}",
                cancellationToken: ct);

            return response ?? [];
        }
        catch (Exception ex) when (
            ex is HttpRequestException or NotSupportedException ||
            ex is TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Unable to resolve SKUs from ProductService");
            return [];
        }
    }

    public async Task<List<ProductCatalogItem>> SearchSkusAsync(string query, CancellationToken ct = default)
    {
        try
        {
            var encodedQuery = Uri.EscapeDataString(query);
            var response = await httpClient.GetFromJsonAsync<List<ProductCatalogItem>>(
                $"api/v1/skus?search={encodedQuery}&pageSize=20",
                cancellationToken: ct);

            return response ?? [];
        }
        catch (Exception ex) when (
            ex is HttpRequestException or NotSupportedException ||
            ex is TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Unable to search SKUs with query '{Query}'", query);
            return [];
        }
    }
}
