using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.Interfaces;

public interface IPosCashSessionRepository
{
    Task<PosCashSession?> GetOpenAsync(CancellationToken ct = default);
    Task<PosCashSession?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<(List<PosCashSession> Items, int TotalCount)> GetPagedAsync(
        DateTime? fromUtc,
        DateTime? toUtcExclusive,
        PosCashSessionStatus? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task AddAsync(PosCashSession session, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
