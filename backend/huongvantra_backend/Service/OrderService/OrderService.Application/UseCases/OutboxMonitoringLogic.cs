using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.UseCases;

/// <summary>
/// G7 — nghiệp vụ giám sát Outbox cho trang quản trị đồng bộ tồn kho.
/// Retry thủ công đưa message (Failed hoặc còn Pending nhưng bị kẹt) về trạng thái
/// Pending, xoá lease và đặt <c>NextAttemptAtUtc = now</c> để dispatcher nhận ngay lượt sau.
/// </summary>
public sealed class OutboxMonitoringLogic(IOutboxMonitoringRepository _repo) : IOutboxMonitoringLogic
{
    public async Task<PagedResponse<OutboxMessageSummaryResponse>> GetPagedAsync(
        OutboxMessageStatus? status,
        string? eventType,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, total) = await _repo.GetPagedAsync(status, eventType, page, pageSize, ct);
        var totalPages = (int)Math.Ceiling(total / (double)pageSize);

        return new PagedResponse<OutboxMessageSummaryResponse>(
            items.Select(ToSummary).ToList(), page, pageSize, total, totalPages);
    }

    public async Task<OutboxMessageDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var message = await _repo.GetByIdAsync(id, ct);
        return message is null ? null : ToDetail(message);
    }

    public async Task<OutboxStatsResponse> GetStatsAsync(CancellationToken ct = default)
    {
        var counts = await _repo.CountByStatusAsync(ct);
        int Get(OutboxMessageStatus s) => counts.TryGetValue(s, out var c) ? c : 0;

        return new OutboxStatsResponse(
            Get(OutboxMessageStatus.Pending),
            Get(OutboxMessageStatus.Processing),
            Get(OutboxMessageStatus.Published),
            Get(OutboxMessageStatus.Failed));
    }

    public async Task<OutboxRetryResultResponse> RetryAsync(Guid id, CancellationToken ct = default)
    {
        var message = await _repo.GetByIdAsync(id, ct);
        if (message is null)
            return new OutboxRetryResultResponse(id, "NotFound", "Không tìm thấy message.");

        if (message.Status == OutboxMessageStatus.Published)
            return new OutboxRetryResultResponse(
                id, message.Status.ToString(), "Message đã publish thành công, không cần retry.");

        message.Status = OutboxMessageStatus.Pending;
        message.NextAttemptAtUtc = DateTime.UtcNow;
        message.LockedBy = null;
        message.LockedUntilUtc = null;
        await _repo.SaveChangesAsync(ct);

        return new OutboxRetryResultResponse(
            id, OutboxMessageStatus.Pending.ToString(), "Đã đưa message về hàng đợi để publish lại.");
    }

    private static OutboxMessageSummaryResponse ToSummary(OutboxMessage m) => new(
        m.Id, m.EventType, m.AggregateId, m.Status.ToString(), m.RetryCount,
        m.OccurredAtUtc, m.LastAttemptAtUtc, m.NextAttemptAtUtc, m.PublishedAtUtc,
        m.LastError, m.LockedBy, m.LockedUntilUtc);

    private static OutboxMessageDetailResponse ToDetail(OutboxMessage m) => new(
        m.Id, m.EventType, m.AggregateId, m.Status.ToString(), m.RetryCount,
        m.OccurredAtUtc, m.LastAttemptAtUtc, m.NextAttemptAtUtc, m.PublishedAtUtc,
        m.LastError, m.LockedBy, m.LockedUntilUtc, m.Payload);
}
