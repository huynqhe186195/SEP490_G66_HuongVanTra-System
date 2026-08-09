using System.Net.Http.Json;
using DocumentService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace DocumentService.Infrastructure.Services;

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
                    response.FullName ?? string.Empty,
                    response.CustomerCode ?? string.Empty,
                    response.CustomerGroup ?? string.Empty,
                    response.TaxCode,
                    response.RegisteredAddress,
                    response.LegalRepresentativeName,
                    response.LegalRepresentativePosition,
                    response.LegalRepresentativeIdNumber,
                    response.LegalRepresentativeIdIssuePlace,
                    response.LegalRepresentativeIdIssueDate?.ToString("dd/MM/yyyy"),
                    response.BankAccountNumber,
                    response.BankName,
                    response.PhoneNumber);
        }
        catch (Exception ex) when (
            ex is HttpRequestException or NotSupportedException ||
            ex is TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Unable to resolve customer {CustomerId} from CustomerService", customerId);
            return null;
        }
    }

    private sealed record CustomerCatalogResponse(
        Guid Id,
        string? FullName,
        string? CustomerCode,
        string? CustomerGroup,
        string? PhoneNumber = null,
        string? TaxCode = null,
        string? RegisteredAddress = null,
        string? LegalRepresentativeName = null,
        string? LegalRepresentativePosition = null,
        string? LegalRepresentativeIdNumber = null,
        string? LegalRepresentativeIdIssuePlace = null,
        DateOnly? LegalRepresentativeIdIssueDate = null,
        string? BankAccountNumber = null,
        string? BankName = null);
}

