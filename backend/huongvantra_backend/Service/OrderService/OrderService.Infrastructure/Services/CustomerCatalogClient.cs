using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using OrderService.Application.Interfaces;
using OrderService.Domain.Exceptions;

namespace OrderService.Infrastructure.Services;

public class CustomerCatalogClient(HttpClient httpClient, ILogger<CustomerCatalogClient> logger) : ICustomerCatalogClient
{
    public async Task<CustomerCatalogProfile?> GetCustomerAsync(Guid customerId, CancellationToken ct = default)
    {
        HttpResponseMessage httpResponse;
        try
        {
            httpResponse = await httpClient.GetAsync($"api/customers/{customerId}", ct);
        }
        catch (Exception ex) when (
            ex is HttpRequestException ||
            ex is TaskCanceledException && !ct.IsCancellationRequested)
        {
            // Không được nuốt lỗi: khách doanh nghiệp sẽ lọt qua toàn bộ ràng buộc hợp đồng/hạn mức.
            logger.LogError(ex, "CustomerService unreachable while resolving customer {CustomerId}", customerId);
            throw new OrderDependencyUnavailableException("Khách hàng", ex);
        }

        if (httpResponse.StatusCode == HttpStatusCode.NotFound)
            return null;

        if (!httpResponse.IsSuccessStatusCode)
        {
            logger.LogError("CustomerService returned {StatusCode} for customer {CustomerId}",
                (int)httpResponse.StatusCode, customerId);
            throw new OrderDependencyUnavailableException("Khách hàng");
        }

        try
        {
            var response = await httpResponse.Content.ReadFromJsonAsync<CustomerCatalogResponse>(ct);

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
        catch (Exception ex) when (ex is NotSupportedException or System.Text.Json.JsonException)
        {
            logger.LogError(ex, "Invalid customer payload for {CustomerId}", customerId);
            throw new OrderDependencyUnavailableException("Khách hàng", ex);
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
