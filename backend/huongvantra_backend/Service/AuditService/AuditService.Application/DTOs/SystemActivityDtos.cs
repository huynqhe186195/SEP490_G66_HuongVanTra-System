namespace AuditService.Application.DTOs;

public sealed record SystemActivityLogQuery(
    DateTime? FromUtc,
    DateTime? ToUtc,
    string? Actor,
    string? Role,
    string? ServiceName,
    string? Module,
    string? Action,
    string? Result,
    string? EntityCode,
    string? CorrelationId,
    int Page = 1,
    int PageSize = 20);

public sealed record SystemActivityLogResponse(
    Guid Id,
    Guid EventId,
    DateTime OccurredAtUtc,
    Guid? ActorId,
    string? ActorName,
    string? ActorRole,
    string ServiceName,
    string Module,
    string Action,
    string? EntityType,
    string? EntityId,
    string? EntityCode,
    string? Description,
    string Result,
    string? Reason,
    string? BeforeSnapshotJson,
    string? AfterSnapshotJson,
    string CorrelationId,
    string RequestPath,
    string HttpMethod,
    int StatusCode,
    string? ClientIp,
    string? UserAgent);

public sealed record PagedResponse<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);
