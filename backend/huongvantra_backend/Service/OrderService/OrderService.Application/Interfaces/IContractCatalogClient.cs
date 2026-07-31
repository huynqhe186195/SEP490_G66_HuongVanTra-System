namespace OrderService.Application.Interfaces;

public interface IContractCatalogClient
{
    Task<ContractCatalogProfile?> GetActiveContractAsync(Guid customerId, CancellationToken ct = default);
}

public sealed record ContractCatalogProfile(
    Guid Id,
    string ContractCode,
    decimal? DiscountPercent,
    decimal? CreditLimit,
    int? PaymentTermDays,
    DateOnly? ExpiryDate);
