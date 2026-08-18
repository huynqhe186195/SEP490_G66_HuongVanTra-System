namespace HuongVanTra.Shared.Notifications;

public class CreateBroadcastNotificationRequest
{
    public string Role { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? LinkUrl { get; set; }
}
