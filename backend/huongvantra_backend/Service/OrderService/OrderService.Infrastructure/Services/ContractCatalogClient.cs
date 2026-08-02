using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using OrderService.Application.Interfaces;
using OrderService.Domain.Exceptions;

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
            ex is HttpRequestException or NotSupportedException or System.Text.Json.JsonException ||
            ex is TaskCanceledException && !ct.IsCancellationRequested)
        {
            // Không được trả null: khách doanh nghiệp sẽ bị coi như "chưa có hợp đồng" hoặc
            // tệ hơn là lọt qua ràng buộc chiết khấu/hạn mức.
            logger.LogError(ex, "DocumentService unreachable while resolving active contract for customer {CustomerId}", customerId);
            throw new OrderDependencyUnavailableException("Hợp đồng", ex);
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
