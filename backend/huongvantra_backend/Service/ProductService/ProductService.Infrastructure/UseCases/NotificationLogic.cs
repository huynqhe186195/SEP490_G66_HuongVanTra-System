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
    private static readonly HashSet<string> AllowedBroadcastRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "Manager",
        "Admin",
        "Warehouse",
        "SalePos",
        "SaleCod",
    };

    private static readonly HashSet<string> AllowedBroadcastTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "warehouse_daily_report_shared",
        "order_waiting_transfer",
        "order_waiting_production",
        "order_waiting_materials",
        "stock_queue_pending_confirm",
        "production_order_pending_approval",
        "order_cancellation_pending_approval",
        "return_request_pending_approval",
        "low_stock_alert",
        "production_order_approved",
    };

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

    public async Task<BroadcastNotificationResponse> BroadcastAsync(
        BroadcastNotificationRequest request,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        if (request is null)
            throw new ProductValidationException("Thiếu nội dung thông báo.");

        var type = NormalizeRequired(request.Type, "Loại thông báo");
        if (!AllowedBroadcastTypes.Contains(type))
            throw new ProductValidationException("Loại thông báo không được hỗ trợ.");

        var title = NormalizeRequired(request.Title, "Tiêu đề");
        if (title.Length > 200)
            throw new ProductValidationException("Tiêu đề tối đa 200 ký tự.");

        var body = NormalizeRequired(request.Body, "Nội dung");
        if (body.Length > 2000)
            throw new ProductValidationException("Nội dung tối đa 2000 ký tự.");

        var link = NormalizeOptional(request.Link);
        if (link is not null && !IsSafeInternalLink(link))
            throw new ProductValidationException("Link thông báo không hợp lệ.");

        var roles = (request.RecipientRoleNames ?? Array.Empty<string>())
            .Select(r => r?.Trim())
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (roles.Count == 0)
            throw new ProductValidationException("Cần chọn ít nhất một vai trò nhận thông báo.");

        foreach (var role in roles)
        {
            if (!AllowedBroadcastRoles.Contains(role!))
                throw new ProductValidationException($"Không được gửi tới vai trò '{role}'.");
        }

        var referenceType = NormalizeOptional(request.ReferenceType);
        var now = DateTime.UtcNow;
        var entities = roles.Select(role => new Notification
        {
            Id = Guid.NewGuid(),
            RecipientRoleName = CanonicalRoleName(role!),
            Type = type.ToLowerInvariant(),
            Title = title,
            Body = body,
            Link = link,
            ReferenceId = request.ReferenceId,
            ReferenceType = referenceType,
            CreatedAt = now,
        }).ToList();

        _db.Notifications.AddRange(entities);
        await _db.SaveChangesAsync(ct);

        return new BroadcastNotificationResponse(
            entities.Count,
            entities.Select(MapToResponse).ToList());
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

    private static string NormalizeRequired(string? value, string label)
    {
        var text = value?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(text))
            throw new ProductValidationException($"{label} không được để trống.");
        return text;
    }

    private static string? NormalizeOptional(string? value)
    {
        var text = value?.Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static bool IsSafeInternalLink(string link)
    {
        if (!link.StartsWith('/') || link.StartsWith("//"))
            return false;
        if (link.Contains("://", StringComparison.Ordinal) || link.Contains('\\'))
            return false;
        return link.Length <= 500;
    }

    private static string CanonicalRoleName(string role)
    {
        if (role.Equals("Manager", StringComparison.OrdinalIgnoreCase)) return "Manager";
        if (role.Equals("Admin", StringComparison.OrdinalIgnoreCase)) return "Admin";
        if (role.Equals("Warehouse", StringComparison.OrdinalIgnoreCase)) return "Warehouse";
        if (role.Equals("SalePos", StringComparison.OrdinalIgnoreCase)) return "SalePos";
        if (role.Equals("SaleCod", StringComparison.OrdinalIgnoreCase)) return "SaleCod";
        return role;
    }

    public async Task BroadcastAsync(
        string role,
        string type,
        string message,
        string? linkUrl,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var entity = new Notification
        {
            Id = Guid.NewGuid(),
            RecipientRoleName = CanonicalRoleName(role),
            Type = type.ToLowerInvariant(),
            Title = message,
            Body = message,
            Link = linkUrl,
            CreatedAt = now,
        };

        _db.Notifications.Add(entity);
        await _db.SaveChangesAsync(ct);
    }

    public async Task CreateDirectAsync(
        Guid recipientUserId,
        string type,
        string message,
        string? linkUrl,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var entity = new Notification
        {
            Id = Guid.NewGuid(),
            RecipientUserId = recipientUserId,
            Type = type.ToLowerInvariant(),
            Title = message,
            Body = message,
            Link = linkUrl,
            CreatedAt = now,
        };

        _db.Notifications.Add(entity);
        await _db.SaveChangesAsync(ct);
    }
}
