using OrderService.Domain.Entities;

namespace OrderService.Application.Interfaces;

/// <summary>
/// G5.2 — kho lưu trữ Outbox phục vụ dispatcher: claim/lease theo lô và cập nhật
/// vòng đời message. Tách interface để dispatcher không phụ thuộc provider cụ thể
/// và có thể kiểm thử bằng test double mô phỏng claim nguyên tử.
/// </summary>
public interface IOutboxStore
{
    /// <summary>
    /// Claim tối đa <paramref name="batchSize"/> message đang eligible
    /// (Pending tới hạn, hoặc Processing đã hết lease) một cách nguyên tử,
    /// gán lease cho <paramref name="workerId"/> đến <c>now + leaseDuration</c>.
    /// Trả về các message đã claim để publish.
    /// </summary>
    Task<IReadOnlyList<OutboxMessage>> ClaimBatchAsync(
        string workerId,
        int batchSize,
        DateTime nowUtc,
        TimeSpan leaseDuration,
        CancellationToken ct = default);

    /// <summary>Đánh dấu publish thành công (Status=Published, PublishedAtUtc, xóa lease).</summary>
    Task MarkPublishedAsync(Guid id, DateTime nowUtc, CancellationToken ct = default);

    /// <summary>
    /// Lên lịch retry: Status=Pending, RetryCount=<paramref name="retryCount"/>,
    /// NextAttemptAtUtc=<paramref name="nextAttemptUtc"/>, ghi LastError, xóa lease.
    /// </summary>
    Task ScheduleRetryAsync(
        Guid id,
        int retryCount,
        DateTime nextAttemptUtc,
        string error,
        DateTime nowUtc,
        CancellationToken ct = default);

    /// <summary>Đánh dấu thất bại vĩnh viễn (Status=Failed, ghi LastError, xóa lease).</summary>
    Task MarkFailedAsync(
        Guid id,
        int retryCount,
        string error,
        DateTime nowUtc,
        CancellationToken ct = default);
}
