using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using OrderService.Application.Interfaces;

namespace OrderService.Infrastructure.Services;

public class CustomerCatalogClient(HttpClient httpClient, ILogger<CustomerCatalogClient> logger) : ICustomerCatalogClient
{
    public async Task<CustomerCatalogProfile?> GetCustomerAsync(Guid customerId, CancellationToken ct = default)
    {
        try
        {
            var response = await httpClient.GetFromJsonAsync<CustomerCatalogResponse>(
                $"api/customers/{customerId}",
                cancellationToken: ct);

            return response is null
                ? null
                : new CustomerCatalogProfile(
                    response.Id,
                    response.FullName,
                    response.Email,
                    response.CustomerGroup,
                    response.TierId ?? response.Tier?.Id,
                    response.TierName ?? response.Tier?.TierName,
                    response.Tier?.DiscountPercent ?? 0m,
                    response.CurrentDebt);
        }
        catch (Exception ex) when (
            ex is HttpRequestException or NotSupportedException ||
            ex is TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Unable to resolve customer {CustomerId} for promotion tier validation", customerId);
            return null;
        }
    }

    private sealed record CustomerCatalogResponse(
        Guid Id,
        string? FullName,
        string? Email,
        string? CustomerGroup,
        int? TierId,
        string? TierName,
        decimal CurrentDebt,
        CustomerTierCatalogResponse? Tier);

    private sealed record CustomerTierCatalogResponse(
        int Id,
        string? TierName,
        decimal DiscountPercent);
}
