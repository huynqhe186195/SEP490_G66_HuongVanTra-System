namespace OrderService.Application.Interfaces;

public interface ICustomerCatalogClient
{
    Task<CustomerCatalogProfile?> GetCustomerAsync(Guid customerId, CancellationToken ct = default);
}

public sealed record CustomerCatalogProfile(
    Guid Id,
    string? FullName,
    int? TierId,
    string? TierName);
