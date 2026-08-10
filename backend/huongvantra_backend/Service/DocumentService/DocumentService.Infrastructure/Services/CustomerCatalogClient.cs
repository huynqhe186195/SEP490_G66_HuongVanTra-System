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

    public async Task<List<CustomerCatalogProfile>> SearchCustomersAsync(string query, CancellationToken ct = default)
    {
        try
        {
            var encodedQuery = Uri.EscapeDataString(query);
            var response = await httpClient.GetFromJsonAsync<PagedCustomerResponse>(
                $"api/customers?search={encodedQuery}&pageSize=20",
                cancellationToken: ct);

            if (response?.Items is null || response.Items.Count == 0)
                return [];

            return response.Items.Select(r => new CustomerCatalogProfile(
                r.Id,
                r.FullName ?? string.Empty,
                r.CustomerCode ?? string.Empty,
                r.CustomerGroup ?? string.Empty,
                r.TaxCode,
                r.RegisteredAddress,
                r.LegalRepresentativeName,
                r.LegalRepresentativePosition,
                r.LegalRepresentativeIdNumber,
                r.LegalRepresentativeIdIssuePlace,
                r.LegalRepresentativeIdIssueDate?.ToString("dd/MM/yyyy"),
                r.BankAccountNumber,
                r.BankName,
                r.PhoneNumber)).ToList();
        }
        catch (Exception ex) when (
            ex is HttpRequestException or NotSupportedException ||
            ex is TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Unable to search customers with query '{Query}'", query);
            return [];
        }
    }

    private sealed record PagedCustomerResponse(List<CustomerCatalogResponse> Items);

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

