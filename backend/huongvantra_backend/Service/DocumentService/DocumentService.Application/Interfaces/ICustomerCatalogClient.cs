namespace DocumentService.Application.Interfaces;

public interface ICustomerCatalogClient
{
    Task<CustomerCatalogProfile?> GetCustomerAsync(Guid customerId, CancellationToken ct = default);
}

public sealed record CustomerCatalogProfile(
    Guid Id,
    string FullName,
    string CustomerCode,
    string CustomerGroup)
{
    public bool IsDoanhNghiep =>
        string.Equals(CustomerGroup, "DoanhNghiep", StringComparison.OrdinalIgnoreCase);
}
