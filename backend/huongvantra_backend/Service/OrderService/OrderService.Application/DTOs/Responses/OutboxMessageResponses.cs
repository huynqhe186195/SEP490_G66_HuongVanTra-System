namespace OrderService.Application.DTOs.Responses;

/// <summary>
/// G7 — dòng tóm tắt một OutboxMessage cho trang giám sát đồng bộ tồn kho.
/// Không trả toàn bộ payload trong danh sách để tránh tải nặng; xem chi tiết ở endpoint riêng.
/// OrderChannel / OrderCode lấy từ JSON payload (POS/COD) khi có.
/// </summary>
public record OutboxMessageSummaryResponse(
    Guid Id,
    string EventType,
    Guid AggregateId,
    string Status,
    int RetryCount,
    DateTime OccurredAtUtc,
    DateTime? LastAttemptAtUtc,
    DateTime NextAttemptAtUtc,
    DateTime? PublishedAtUtc,
    string? LastError,
    string? LockedBy,
    DateTime? LockedUntilUtc,
    string? OrderChannel = null,
    string? OrderCode = null);

/// <summary>Chi tiết đầy đủ một OutboxMessage, bao gồm payload JSON.</summary>
public record OutboxMessageDetailResponse(
    Guid Id,
    string EventType,
    Guid AggregateId,
    string Status,
    int RetryCount,
    DateTime OccurredAtUtc,
    DateTime? LastAttemptAtUtc,
    DateTime NextAttemptAtUtc,
    DateTime? PublishedAtUtc,
    string? LastError,
    string? LockedBy,
    DateTime? LockedUntilUtc,
    string Payload);

/// <summary>Thống kê nhanh theo trạng thái phục vụ dashboard giám sát.</summary>
public record OutboxStatsResponse(
    int Pending,
    int Processing,
    int Published,
    int Failed);

/// <summary>Kết quả yêu cầu retry thủ công một message.</summary>
public record OutboxRetryResultResponse(
    Guid Id,
    string Status,
    string Message);
