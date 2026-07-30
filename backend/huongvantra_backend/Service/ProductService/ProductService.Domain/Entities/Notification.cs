namespace ProductService.Domain.Entities;

/// <summary>
/// Notification center trong ProductService: nhắm tới một vai trò (RecipientRoleName)
/// hoặc một người dùng cụ thể (RecipientUserId).
/// </summary>
public class Notification : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string? RecipientRoleName { get; set; }
    public Guid? RecipientUserId { get; set; }

    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? Link { get; set; }

    public Guid? ReferenceId { get; set; }
    public string? ReferenceType { get; set; }

    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public Guid? ReadBy { get; set; }
}
