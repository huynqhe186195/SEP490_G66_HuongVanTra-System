namespace HuongVanTra.Shared.Notifications;

public class CreateDirectNotificationRequest
{
    public Guid RecipientUserId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? LinkUrl { get; set; }
}
