using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.Interfaces;

public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Order?> GetByCodeAsync(string orderCode, CancellationToken ct = default);
    Task<(List<Order> Items, int TotalCount)> GetPagedAsync(
        string? search, Guid? customerId, string? status, string? channel,
        string? excludeChannel, string? codTab, bool returnableOnly,
        string? orderKind, string? excludeOrderKind,
        DateTime? fromDate, DateTime? toDate, Guid? employeeId, bool includeAllCodOrders,
        int page, int pageSize, CancellationToken ct = default,
        IReadOnlyCollection<Guid>? restrictToOrderIds = null);
    Task<List<Order>> GetPendingCodAsync(CancellationToken ct = default);
    Task<(List<Order> Items, int TotalCount)> GetB2BDebtsAsync(
        Guid? customerId, bool overdueOnly, DateTime today,
        int page, int pageSize, CancellationToken ct = default);
    Task<Order?> GetSinglePendingTransferByAmountAsync(
        decimal amount, int toleranceVnd, CancellationToken ct = default);
    Task<Order?> GetLatestPendingTransferAsync(DateTime utcNow, CancellationToken ct = default);
    Task<Order?> GetByIdempotencyKeyAsync(string key, CancellationToken ct = default);
    Task<bool> TryTransitionStatusAsync(
        Guid orderId,
        OrderStatus expectedStatus,
        OrderStatus nextStatus,
        CancellationToken ct = default);
    Task AddAsync(Order order, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
