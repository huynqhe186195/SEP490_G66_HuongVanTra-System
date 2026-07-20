using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using ProductService.Application.Interfaces;
using ProductService.Domain.Exceptions;

namespace ProductService.Infrastructure.Services;

public class InventoryProductDeletionValidationClient(
    HttpClient httpClient,
    ILogger<InventoryProductDeletionValidationClient> logger)
    : IInventoryProductDeletionValidationClient
{
    public async Task<InventoryProductDeletionValidationResponse> ValidateAsync(
        List<Guid> skuIds,
        string? bearerToken,
        CancellationToken ct = default)
    {
        if (skuIds.Count == 0)
            return new InventoryProductDeletionValidationResponse([]);

        using var request = new HttpRequestMessage(HttpMethod.Post, "api/v1/inventory/product-deletion-validation");
        request.Content = JsonContent.Create(new InventoryProductDeletionValidationRequest(skuIds));

        if (!string.IsNullOrWhiteSpace(bearerToken))
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);

        HttpResponseMessage response;
        try
        {
            response = await httpClient.SendAsync(request, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to call InventoryService product deletion validation.");
            throw new ProductValidationException("Không thể kiểm tra tồn kho trước khi xóa hàng hóa.");
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            logger.LogWarning(
                "InventoryService product deletion validation failed with {StatusCode}: {Body}",
                response.StatusCode,
                body);
            throw new ProductValidationException("InventoryService không cho phép kiểm tra xóa hàng hóa.");
        }

        var result = await response.Content.ReadFromJsonAsync<InventoryProductDeletionValidationResponse>(cancellationToken: ct);
        return result ?? new InventoryProductDeletionValidationResponse([]);
    }
}
