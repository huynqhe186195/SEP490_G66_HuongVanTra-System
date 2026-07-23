using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.Interfaces;

public interface IReturnOrderRepository
{
    Task<string> GenerateReturnCodeAsync(CancellationToken ct = default);
    Task<ReturnOrder?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<ReturnOrder>> GetBySourceOrderIdAsync(Guid sourceOrderId, CancellationToken ct = default);
    Task<(List<(ReturnOrder Item, OrderChannel SourceChannel)> Items, int Total)> GetPagedAsync(
        string? search, string? sourceChannel, Guid? employeeId, bool includeAllCodOrders,
        int page, int pageSize, CancellationToken ct = default);
    Task<string?> GetExchangeOrderCodeAsync(Guid exchangeOrderId, CancellationToken ct = default);
    Task AddAsync(ReturnOrder returnOrder, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
