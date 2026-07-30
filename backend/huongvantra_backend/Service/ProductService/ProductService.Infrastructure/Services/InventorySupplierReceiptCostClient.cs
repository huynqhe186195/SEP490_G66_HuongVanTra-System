using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using ProductService.Application.Interfaces;
using ProductService.Domain.Exceptions;

namespace ProductService.Infrastructure.Services;

public class InventorySupplierReceiptCostClient(
    HttpClient httpClient,
    ILogger<InventorySupplierReceiptCostClient> logger)
    : IInventorySupplierReceiptCostClient
{
    public async Task<InventorySupplierReceiptCostLinesResponse> GetApprovedLinesAsync(
        Guid? skuId,
        string? bearerToken,
        CancellationToken ct = default)
    {
        var url = skuId.HasValue && skuId.Value != Guid.Empty
            ? $"api/v1/inventory/supplier-receipt-cost-lines?skuId={skuId.Value}"
            : "api/v1/inventory/supplier-receipt-cost-lines";

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (!string.IsNullOrWhiteSpace(bearerToken))
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);

        HttpResponseMessage response;
        try
        {
            response = await httpClient.SendAsync(request, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to call InventoryService supplier receipt cost lines.");
            throw new ProductValidationException("Không thể đọc dữ liệu phiếu nhập NCC từ InventoryService.");
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            logger.LogWarning(
                "InventoryService supplier receipt cost lines failed with {StatusCode}: {Body}",
                response.StatusCode,
                body);
            throw new ProductValidationException("InventoryService không trả về dữ liệu phiếu nhập NCC.");
        }

        var result = await response.Content.ReadFromJsonAsync<InventorySupplierReceiptCostLinesResponse>(cancellationToken: ct);
        return result ?? new InventorySupplierReceiptCostLinesResponse([]);
    }
}
