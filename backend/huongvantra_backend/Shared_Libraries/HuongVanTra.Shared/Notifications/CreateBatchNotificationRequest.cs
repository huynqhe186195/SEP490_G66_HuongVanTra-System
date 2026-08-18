namespace HuongVanTra.Shared.Notifications;

public class CreateBatchNotificationRequest
{
    public List<CreateDirectNotificationRequest> Notifications { get; set; } = new();
}
