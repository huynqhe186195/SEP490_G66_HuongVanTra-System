using OrderService.Application.Interfaces;

namespace OrderService.Infrastructure.Services;

/// <summary>
/// B2B / DocumentService đang cắt khỏi phạm vi runtime.
/// Không gọi HTTP — luôn trả null để tránh 503 khi document-service không chạy.
/// </summary>
public sealed class DisabledContractCatalogClient : IContractCatalogClient
{
    public Task<ContractCatalogProfile?> GetActiveContractAsync(
        Guid customerId,
        CancellationToken ct = default) =>
        Task.FromResult<ContractCatalogProfile?>(null);
}
