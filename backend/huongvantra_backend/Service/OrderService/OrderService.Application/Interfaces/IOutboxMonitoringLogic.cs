using OrderService.Application.DTOs.Responses;
using OrderService.Domain.Enums;

namespace OrderService.Application.Interfaces;

/// <summary>
/// G7 — nghiệp vụ giám sát Outbox: liệt kê, xem chi tiết, thống kê và
/// yêu cầu retry thủ công các message publish thất bại.
/// </summary>
public interface IOutboxMonitoringLogic
{
    Task<PagedResponse<OutboxMessageSummaryResponse>> GetPagedAsync(
        OutboxMessageStatus? status,
        string? eventType,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<OutboxMessageDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<OutboxStatsResponse> GetStatsAsync(CancellationToken ct = default);

    /// <summary>
    /// Đưa một message về hàng đợi để dispatcher publish lại ngay.
    /// Chỉ áp dụng cho message chưa Published; message đã Published trả về no-op.
    /// </summary>
    Task<OutboxRetryResultResponse> RetryAsync(Guid id, CancellationToken ct = default);
}
