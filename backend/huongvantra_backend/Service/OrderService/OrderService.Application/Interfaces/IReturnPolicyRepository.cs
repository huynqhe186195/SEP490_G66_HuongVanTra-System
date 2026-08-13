using OrderService.Domain.Entities;

namespace OrderService.Application.Interfaces;

public interface IReturnPolicyRepository
{
    Task<ReturnPolicy?> GetActiveAsync(CancellationToken ct = default);
}
