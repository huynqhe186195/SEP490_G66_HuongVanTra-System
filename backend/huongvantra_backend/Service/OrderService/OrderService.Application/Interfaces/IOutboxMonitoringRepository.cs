using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.Interfaces;

/// <summary>
/// G7 — truy vấn/giám sát Outbox phục vụ trang quản trị đồng bộ tồn kho.
/// Tách khỏi <see cref="IOutboxStore"/> (vòng đời dispatcher) để giữ mỗi interface một vai trò.
/// </summary>
public interface IOutboxMonitoringRepository
{
    /// <summary>Danh sách message phân trang, lọc theo trạng thái/loại event, mới nhất trước.</summary>
    Task<(List<OutboxMessage> Items, int TotalCount)> GetPagedAsync(
        OutboxMessageStatus? status,
        string? eventType,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<OutboxMessage?> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Đếm số message theo từng trạng thái.</summary>
    Task<Dictionary<OutboxMessageStatus, int>> CountByStatusAsync(CancellationToken ct = default);

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
