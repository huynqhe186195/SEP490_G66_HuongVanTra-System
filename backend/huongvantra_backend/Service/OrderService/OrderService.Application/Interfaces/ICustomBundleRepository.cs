using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.Interfaces;

public interface ICustomBundleRepository
{
    Task<CustomBundle?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<(List<CustomBundle> Items, int TotalCount)> GetPagedByStatusAsync(
        PackingStatus status, int page, int pageSize, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
