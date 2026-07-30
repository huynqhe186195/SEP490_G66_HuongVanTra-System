namespace OrderService.Application.Interfaces;

public interface ICustomerCatalogClient
{
    Task<CustomerCatalogProfile?> GetCustomerAsync(Guid customerId, CancellationToken ct = default);
}

public sealed record CustomerCatalogProfile(
    Guid Id,
    string? FullName,
    string? Email,
    string? CustomerGroup,
    int? TierId,
    string? TierName,
    decimal TierDiscountPercent,
    decimal CurrentDebt = 0m)
{
    public bool IsVipCustomer =>
        string.Equals(CustomerGroup, "DoiNgoai", StringComparison.OrdinalIgnoreCase);

    public bool IsDoanhNghiep =>
        string.Equals(CustomerGroup, "DoanhNghiep", StringComparison.OrdinalIgnoreCase);
}
