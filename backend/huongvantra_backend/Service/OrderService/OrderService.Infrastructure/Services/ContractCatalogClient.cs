using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using OrderService.Application.Interfaces;

namespace OrderService.Infrastructure.Services;

public class ContractCatalogClient(HttpClient httpClient, ILogger<ContractCatalogClient> logger) : IContractCatalogClient
{
    public async Task<ContractCatalogProfile?> GetActiveContractAsync(Guid customerId, CancellationToken ct = default)
    {
        try
        {
            var httpResponse = await httpClient.GetAsync($"api/contracts/active-for-customer/{customerId}", ct);
            if (httpResponse.StatusCode == HttpStatusCode.NotFound)
                return null;

            httpResponse.EnsureSuccessStatusCode();

            var response = await httpResponse.Content.ReadFromJsonAsync<ContractCatalogResponse>(ct);
            return response is null
                ? null
                : new ContractCatalogProfile(
                    response.Id,
                    response.ContractCode,
                    response.DiscountPercent,
                    response.CreditLimit,
                    response.PaymentTermDays,
                    response.ExpiryDate);
        }
        catch (Exception ex) when (
            ex is HttpRequestException or NotSupportedException ||
            ex is TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Unable to resolve active contract for customer {CustomerId}", customerId);
            return null;
        }
    }

    private sealed record ContractCatalogResponse(
        Guid Id,
        string ContractCode,
        decimal? DiscountPercent,
        decimal? CreditLimit,
        int? PaymentTermDays,
        DateOnly? ExpiryDate);
}
