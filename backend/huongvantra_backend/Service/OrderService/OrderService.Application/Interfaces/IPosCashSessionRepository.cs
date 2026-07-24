using OrderService.Domain.Entities;

namespace OrderService.Application.Interfaces;

public interface IPosCashSessionRepository
{
    Task<PosCashSession?> GetOpenAsync(CancellationToken ct = default);
    Task<PosCashSession?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(PosCashSession session, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
