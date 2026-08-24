namespace ProductService.Domain.Entities;

/// <summary>
/// Per-user delivery/read state for a notification. A missing row for a role
/// broadcast represents an unread notification for that authenticated user.
/// </summary>
public class NotificationRecipient : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid NotificationId { get; set; }
    public Guid RecipientUserId { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }

    public Notification Notification { get; set; } = null!;
}
