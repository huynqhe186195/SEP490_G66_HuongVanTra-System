using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ProductService.Application.Interfaces;

namespace ProductService.Infrastructure.Services;

public class SmtpAdminNotificationSender(
    IConfiguration configuration,
    ILogger<SmtpAdminNotificationSender> logger) : IAdminNotificationSender
{
    private readonly string? _smtpHost = configuration["SMTP_HOST"];
    private readonly int _smtpPort = int.TryParse(configuration["SMTP_PORT"], out var port) ? port : 587;
    private readonly string? _smtpUser = configuration["SMTP_USER"];
    private readonly string? _smtpPass = configuration["SMTP_PASS"];
    private readonly string? _adminEmail = configuration["ADMIN_NOTIFICATION_EMAIL"];

    public async Task SendAsync(string subject, string htmlBody, CancellationToken ct = default)
    {
        var recipient = string.IsNullOrWhiteSpace(_adminEmail) ? _smtpUser : _adminEmail;

        if (string.IsNullOrWhiteSpace(_smtpHost)
            || string.IsNullOrWhiteSpace(_smtpUser)
            || string.IsNullOrWhiteSpace(recipient))
        {
            logger.LogWarning("SMTP chưa được cấu hình. Bỏ qua email thông báo quản trị.");
            return;
        }

        try
        {
            using var message = new MailMessage
            {
                From = new MailAddress(_smtpUser, "Hương Vân Trà"),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
                BodyEncoding = Encoding.UTF8,
                SubjectEncoding = Encoding.UTF8
            };
            message.To.Add(new MailAddress(recipient));

            using var client = new SmtpClient(_smtpHost, _smtpPort)
            {
                Credentials = new NetworkCredential(_smtpUser, _smtpPass),
                EnableSsl = true
            };

            await client.SendMailAsync(message, ct);
            logger.LogInformation("Đã gửi email thông báo quản trị tới {Email}.", recipient);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Gửi email thông báo quản trị tới {Email} thất bại.", recipient);
        }
    }
}
