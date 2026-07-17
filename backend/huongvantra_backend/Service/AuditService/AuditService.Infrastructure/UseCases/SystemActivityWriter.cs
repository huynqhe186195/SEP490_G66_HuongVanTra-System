using AuditService.Domain.Entities;
using AuditService.Infrastructure.Data;
using HuongVanTra.Shared.Messages;
using Microsoft.EntityFrameworkCore;

namespace AuditService.Infrastructure.UseCases;

public class SystemActivityWriter(AuditDbContext db)
{
    public async Task<bool> WriteAsync(SystemActivityEvent message, CancellationToken ct = default)
    {
        if (await db.SystemActivityLogs.AnyAsync(x => x.EventId == message.EventId, ct))
            return false;

        db.SystemActivityLogs.Add(new SystemActivityLog
        {
            EventId = message.EventId,
            OccurredAtUtc = message.OccurredAtUtc,
            ActorId = message.ActorId,
            ActorName = message.ActorName,
            ActorRole = message.ActorRole,
            ServiceName = message.ServiceName,
            Module = message.Module,
            Action = message.Action,
            EntityType = message.EntityType,
            EntityId = message.EntityId,
            EntityCode = message.EntityCode,
            Description = message.Description,
            Result = message.Result,
            Reason = message.Reason,
            BeforeSnapshotJson = message.BeforeSnapshotJson,
            AfterSnapshotJson = message.AfterSnapshotJson,
            CorrelationId = message.CorrelationId,
            RequestPath = message.RequestPath,
            HttpMethod = message.HttpMethod,
            StatusCode = message.StatusCode,
            ClientIp = message.ClientIp,
            UserAgent = message.UserAgent,
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync(ct);
        return true;
    }
}
