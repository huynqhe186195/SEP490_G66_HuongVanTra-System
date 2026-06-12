using OrderService.Domain.Entities;

namespace OrderService.Application.Interfaces;

public interface IReturnOrderRepository
{
    Task<string> GenerateReturnCodeAsync(CancellationToken ct = default);
    Task AddAsync(ReturnOrder returnOrder, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
