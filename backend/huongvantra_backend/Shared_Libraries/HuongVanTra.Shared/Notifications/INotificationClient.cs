namespace HuongVanTra.Shared.Notifications;

public interface INotificationClient
{
    Task SendBroadcastAsync(string role, string type, string message, string? linkUrl = null);
    Task SendDirectAsync(Guid recipientUserId, string type, string message, string? linkUrl = null);
    Task SendBatchAsync(List<CreateDirectNotificationRequest> notifications);
}
