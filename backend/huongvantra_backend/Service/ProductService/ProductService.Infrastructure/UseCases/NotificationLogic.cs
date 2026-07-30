using Microsoft.EntityFrameworkCore;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.UseCases;

public class NotificationLogic(ProductDbContext _db)
{
    public async Task<PagedResponse<NotificationResponse>> GetPagedAsync(
        GetNotificationsRequest request,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        request ??= new GetNotificationsRequest();
        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);

        var query = BuildRecipientQuery(actor).AsNoTracking();

        if (request.UnreadOnly)
            query = query.Where(x => !x.IsRead);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        return new PagedResponse<NotificationResponse>(
            items.Select(MapToResponse).ToList(),
            request.Page,
            request.PageSize,
            total,
            (int)Math.Ceiling((double)total / request.PageSize));
    }

    public async Task<NotificationSummaryResponse> GetSummaryAsync(
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var unread = await BuildRecipientQuery(actor).AsNoTracking()
            .CountAsync(x => !x.IsRead, ct);

        return new NotificationSummaryResponse(unread);
    }

    public async Task<NotificationResponse> MarkReadAsync(
        Guid id,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var entity = await BuildRecipientQuery(actor).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ProductValidationException("Không tìm thấy thông báo.");

        if (!entity.IsRead)
        {
            var readAt = DateTime.UtcNow;
            entity.IsRead = true;
            entity.ReadAt = readAt;
            entity.ReadBy = NormalizeActorId(actor);
            entity.UpdatedAt = readAt;
            await _db.SaveChangesAsync(ct);
        }

        return MapToResponse(entity);
    }

    public async Task<NotificationSummaryResponse> MarkAllReadAsync(
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var unread = await BuildRecipientQuery(actor).Where(x => !x.IsRead).ToListAsync(ct);
        if (unread.Count > 0)
        {
            var readAt = DateTime.UtcNow;
            var readBy = NormalizeActorId(actor);
            foreach (var entity in unread)
            {
                entity.IsRead = true;
                entity.ReadAt = readAt;
                entity.ReadBy = readBy;
                entity.UpdatedAt = readAt;
            }

            await _db.SaveChangesAsync(ct);
        }

        return new NotificationSummaryResponse(0);
    }

    // Thông báo nhắm tới cá nhân (RecipientUserId) hoặc tới toàn bộ một vai trò (RecipientRoleName).
    private IQueryable<Notification> BuildRecipientQuery(ProductApprovalActorSnapshot actor)
    {
        var actorId = NormalizeActorId(actor);
        var roleName = actor.RoleName?.Trim();

        if (actorId.HasValue && !string.IsNullOrWhiteSpace(roleName))
            return _db.Notifications.Where(x =>
                x.RecipientUserId == actorId.Value || x.RecipientRoleName == roleName);

        if (actorId.HasValue)
            return _db.Notifications.Where(x => x.RecipientUserId == actorId.Value);

        if (!string.IsNullOrWhiteSpace(roleName))
            return _db.Notifications.Where(x => x.RecipientRoleName == roleName);

        return _db.Notifications.Where(x => false);
    }

    private static NotificationResponse MapToResponse(Notification entity) => new(
        entity.Id,
        entity.Type,
        entity.Title,
        entity.Body,
        entity.Link,
        entity.ReferenceId,
        entity.ReferenceType,
        entity.IsRead,
        entity.ReadAt,
        entity.CreatedAt);

    private static Guid? NormalizeActorId(ProductApprovalActorSnapshot actor) =>
        actor.UserId.HasValue && actor.UserId.Value != Guid.Empty ? actor.UserId.Value : null;
}
