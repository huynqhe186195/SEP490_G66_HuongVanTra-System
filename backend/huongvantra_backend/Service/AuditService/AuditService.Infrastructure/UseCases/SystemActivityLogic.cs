using AuditService.Application.DTOs;
using AuditService.Domain.Entities;
using AuditService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace AuditService.Infrastructure.UseCases;

public class SystemActivityLogic(AuditDbContext db)
{
    public async Task<PagedResponse<SystemActivityLogResponse>> GetPagedAsync(
        SystemActivityLogQuery query,
        CancellationToken ct = default)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var itemsQuery = db.SystemActivityLogs.AsNoTracking();

        if (query.FromUtc.HasValue)
            itemsQuery = itemsQuery.Where(x => x.OccurredAtUtc >= query.FromUtc.Value);
        if (query.ToUtc.HasValue)
            itemsQuery = itemsQuery.Where(x => x.OccurredAtUtc <= query.ToUtc.Value);
        if (!string.IsNullOrWhiteSpace(query.Actor))
        {
            var actor = query.Actor.Trim().ToLower();
            itemsQuery = itemsQuery.Where(x =>
                (x.ActorName != null && x.ActorName.ToLower().Contains(actor))
                || (x.ActorId != null && x.ActorId.ToString()!.Contains(actor)));
        }
        if (!string.IsNullOrWhiteSpace(query.Role))
        {
            var role = query.Role.Trim().ToLower();
            itemsQuery = itemsQuery.Where(x => x.ActorRole != null && x.ActorRole.ToLower().Contains(role));
        }
        if (!string.IsNullOrWhiteSpace(query.ServiceName))
        {
            var service = query.ServiceName.Trim().ToLower();
            itemsQuery = itemsQuery.Where(x => x.ServiceName.ToLower().Contains(service));
        }
        if (!string.IsNullOrWhiteSpace(query.Module))
        {
            var module = query.Module.Trim().ToLower();
            itemsQuery = itemsQuery.Where(x => x.Module.ToLower().Contains(module));
        }
        if (!string.IsNullOrWhiteSpace(query.Action))
        {
            var action = query.Action.Trim().ToLower();
            itemsQuery = itemsQuery.Where(x => x.Action.ToLower().Contains(action));
        }
        if (!string.IsNullOrWhiteSpace(query.Result) && !string.Equals(query.Result, "all", StringComparison.OrdinalIgnoreCase))
        {
            var result = query.Result.Trim().ToLower();
            itemsQuery = itemsQuery.Where(x => x.Result.ToLower() == result);
        }
        if (!string.IsNullOrWhiteSpace(query.EntityCode))
        {
            var entityCode = query.EntityCode.Trim().ToLower();
            itemsQuery = itemsQuery.Where(x => x.EntityCode != null && x.EntityCode.ToLower().Contains(entityCode));
        }
        if (!string.IsNullOrWhiteSpace(query.CorrelationId))
        {
            var correlation = query.CorrelationId.Trim().ToLower();
            itemsQuery = itemsQuery.Where(x => x.CorrelationId.ToLower().Contains(correlation));
        }

        var total = await itemsQuery.CountAsync(ct);
        var items = await itemsQuery
            .OrderByDescending(x => x.OccurredAtUtc)
            .ThenByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => Map(x))
            .ToListAsync(ct);

        return new PagedResponse<SystemActivityLogResponse>(
            items,
            page,
            pageSize,
            total,
            (int)Math.Ceiling((double)total / pageSize));
    }

    public async Task<SystemActivityLogResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var item = await db.SystemActivityLogs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return item is null ? null : Map(item);
    }

    private static SystemActivityLogResponse Map(SystemActivityLog item) => new(
        item.Id,
        item.EventId,
        item.OccurredAtUtc,
        item.ActorId,
        item.ActorName,
        item.ActorRole,
        item.ServiceName,
        item.Module,
        item.Action,
        item.EntityType,
        item.EntityId,
        item.EntityCode,
        item.Description,
        item.Result,
        item.Reason,
        item.BeforeSnapshotJson,
        item.AfterSnapshotJson,
        item.CorrelationId,
        item.RequestPath,
        item.HttpMethod,
        item.StatusCode,
        item.ClientIp,
        item.UserAgent);
}
