namespace AuditService.Domain.Entities;

public class SystemActivityLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EventId { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public Guid? ActorId { get; set; }
    public string? ActorName { get; set; }
    public string? ActorRole { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? EntityCode { get; set; }
    public string? Description { get; set; }
    public string Result { get; set; } = "Success";
    public string? Reason { get; set; }
    public string? BeforeSnapshotJson { get; set; }
    public string? AfterSnapshotJson { get; set; }
    public string CorrelationId { get; set; } = string.Empty;
    public string RequestPath { get; set; } = string.Empty;
    public string HttpMethod { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public string? ClientIp { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
