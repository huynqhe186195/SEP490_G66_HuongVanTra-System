namespace ProductService.Application.Interfaces;

public interface IAdminNotificationSender
{
    // Best-effort gửi email tới hộp thư quản trị. Không throw khi lỗi.
    Task SendAsync(string subject, string htmlBody, CancellationToken ct = default);
}
