using System.Net;
using System.Globalization;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Domain.Entities;

namespace OrderService.Infrastructure.Services;

public class EmailService(IOptions<EmailOptions> options, ILogger<EmailService> logger) : IEmailService
{
    private readonly EmailOptions _options = options.Value;

    public async Task SendInvoiceEmailAsync(string toEmail, string customerName, string? tierName, Order order, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.SmtpHost) || string.IsNullOrWhiteSpace(_options.SmtpUser))
        {
            logger.LogWarning("Email sending is disabled because SMTP configuration is missing.");
            return;
        }

        var targetEmail = !string.IsNullOrWhiteSpace(_options.DemoEmailOverride) 
            ? _options.DemoEmailOverride 
            : toEmail;

        if (string.IsNullOrWhiteSpace(targetEmail))
        {
            logger.LogInformation("No email provided for order {OrderCode}, skipping email.", order.OrderCode);
            return;
        }

        try
        {
            var mailMessage = new MailMessage
            {
                From = new MailAddress(_options.SmtpUser, "Hương Vân Trà"),
                Subject = $"[Hương Vân Trà] Hoá đơn thanh toán đơn hàng {order.OrderCode}",
                IsBodyHtml = true,
                Body = GenerateInvoiceHtml(customerName, tierName, order),
                BodyEncoding = Encoding.UTF8,
                SubjectEncoding = Encoding.UTF8
            };

            mailMessage.To.Add(new MailAddress(targetEmail));

            using var smtpClient = new SmtpClient(_options.SmtpHost, _options.SmtpPort)
            {
                Credentials = new NetworkCredential(_options.SmtpUser, _options.SmtpPass),
                EnableSsl = true
            };

            await smtpClient.SendMailAsync(mailMessage, ct);
            logger.LogInformation("Successfully sent invoice email for order {OrderCode} to {Email}", order.OrderCode, targetEmail);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send invoice email for order {OrderCode} to {Email}", order.OrderCode, targetEmail);
        }
    }

    public async Task SendTierUpgradeEmailAsync(string toEmail, string customerName, string previousTierName, string newTierName, decimal totalSpending, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.SmtpHost) || string.IsNullOrWhiteSpace(_options.SmtpUser))
            throw new InvalidOperationException("SMTP configuration is missing for tier-upgrade email.");
        var targetEmail = !string.IsNullOrWhiteSpace(_options.DemoEmailOverride) ? _options.DemoEmailOverride : toEmail;
        try
        {
            using var mail = new MailMessage
            {
                From = new MailAddress(_options.SmtpUser, "Hương Vân Trà", Encoding.UTF8),
                Subject = "[Hương Vân Trà] Chúc mừng bạn được nâng hạng thành viên",
                IsBodyHtml = true,
                BodyEncoding = Encoding.UTF8,
                SubjectEncoding = Encoding.UTF8,
                HeadersEncoding = Encoding.UTF8,
                BodyTransferEncoding = TransferEncoding.Base64,
                Body = GenerateTierUpgradeHtml(customerName, previousTierName, newTierName, totalSpending),
            };
            mail.To.Add(new MailAddress(targetEmail));
            using var smtp = new SmtpClient(_options.SmtpHost, _options.SmtpPort) { Credentials = new NetworkCredential(_options.SmtpUser, _options.SmtpPass), EnableSsl = true };
            await smtp.SendMailAsync(mail, ct);
            logger.LogInformation("Successfully sent tier-upgrade email to {Email} for tier {Tier}", targetEmail, newTierName);
        }
        catch (Exception ex) { logger.LogError(ex, "Failed to send tier-upgrade email to {Email}", targetEmail); throw; }
    }

    private static string GenerateTierUpgradeHtml(string customerName, string previousTierName, string newTierName, decimal totalSpending)
    {
        var name = WebUtility.HtmlEncode(customerName);
        var fromTier = WebUtility.HtmlEncode(previousTierName);
        var toTier = WebUtility.HtmlEncode(newTierName);
        // Container hiện chạy globalization-invariant (Alpine), nên không thể khởi tạo vi-VN.
        // Định dạng thủ công vẫn giữ cách phân tách tiền tệ quen thuộc của tiếng Việt.
        var spending = totalSpending
            .ToString("#,0", CultureInfo.InvariantCulture)
            .Replace(',', '.');
        return $"""
        <!doctype html><html lang="vi"><body style="margin:0;padding:0;background:#f4f1eb;font-family:Arial,'Helvetica Neue',sans-serif;color:#24352b">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1eb;padding:32px 12px"><tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf8;border-radius:18px;overflow:hidden">
          <tr><td style="padding:28px 36px;background:#315f45;color:#fff"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="width:46px;height:46px;border-radius:23px;background:#d9a441;text-align:center;font-size:20px;font-weight:700">H</td><td style="padding-left:13px"><div style="font-size:20px;font-weight:700">Hương Vân Trà</div><div style="font-size:12px;opacity:.82;margin-top:3px">Thành viên thân thiết</div></td></tr></table></td></tr>
          <tr><td style="padding:38px 36px 24px"><div style="font-size:13px;letter-spacing:1.4px;color:#a06d19;font-weight:700">CHÚC MỪNG BẠN</div><h1 style="margin:10px 0 14px;font-size:29px;line-height:1.28;color:#244b37">Bạn đã lên hạng {toTier}</h1><p style="margin:0;font-size:16px;line-height:1.7">Xin chào <strong>{name}</strong>,</p><p style="font-size:16px;line-height:1.7">Cảm ơn bạn đã tin tưởng đồng hành cùng Hương Vân Trà. Thành viên của bạn vừa được nâng từ <strong>{fromTier}</strong> lên <strong>{toTier}</strong>.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0;background:#f2f7f2;border:1px solid #d9e6da;border-radius:12px"><tr><td style="padding:20px 22px"><div style="font-size:12px;color:#637267">TỔNG CHI TIÊU TÍCH LŨY</div><div style="margin-top:6px;font-size:24px;color:#315f45;font-weight:700">{spending} đ</div></td><td align="right" style="padding:20px 22px"><span style="display:inline-block;background:#d9a441;color:#fff;padding:8px 13px;border-radius:16px;font-size:13px;font-weight:700">{toTier}</span></td></tr></table>
          <p style="margin:0;font-size:15px;line-height:1.7">Ưu đãi theo hạng mới sẽ được tự động áp dụng trong các đơn hàng tiếp theo.</p></td></tr>
          <tr><td style="padding:22px 36px;background:#f4f1eb;color:#6b756d;font-size:12px;line-height:1.6">Email được gửi tự động từ Hương Vân Trà. Nếu bạn cần hỗ trợ, vui lòng liên hệ cửa hàng.</td></tr>
        </table></td></tr></table></body></html>
        """;
    }

    private static string GenerateInvoiceHtml(string customerName, string? tierName, Order order)
    {
        var sb = new StringBuilder();
        
        sb.Append($@"
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; background-color: #f9fafb; color: #374151; line-height: 1.6; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; border-top: 5px solid #356647; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .header h1 {{ color: #356647; margin: 0; font-size: 24px; }}
                .header p {{ color: #6b7280; font-size: 14px; margin-top: 5px; }}
                .info-section {{ margin-bottom: 25px; }}
                .info-section p {{ margin: 5px 0; }}
                .table {{ width: 100%; border-collapse: collapse; margin-bottom: 25px; }}
                .table th, .table td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }}
                .table th {{ background-color: #f3f4f6; color: #4b5563; font-weight: 600; font-size: 14px; }}
                .table td {{ font-size: 14px; }}
                .text-right {{ text-align: right !important; }}
                .summary {{ float: right; width: 50%; }}
                .summary-row {{ display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }}
                .summary-row.total {{ font-weight: bold; font-size: 16px; color: #356647; border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 5px; }}
                .footer {{ clear: both; margin-top: 60px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px; }}
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>Hương Vân Trà</h1>
                    <p>Cảm ơn bạn đã mua sắm tại cửa hàng!</p>
                </div>

                <div class='info-section'>
                    <p><strong>Xin chào {customerName},</strong></p>
                    <p>Đơn hàng <strong>{order.OrderCode}</strong> của bạn đã được thanh toán thành công. Dưới đây là chi tiết hoá đơn:</p>
                </div>

                <div class='info-section' style='background-color: #f9fafb; padding: 15px; border-radius: 6px;'>
                    <p><strong>Mã đơn hàng:</strong> {order.OrderCode}</p>
                    <p><strong>Ngày mua:</strong> {order.CreatedAt.ToLocalTime():dd/MM/yyyy HH:mm:ss}</p>
                    {(string.IsNullOrWhiteSpace(tierName) ? "" : $"<p><strong>Hạng thành viên:</strong> {tierName}</p>")}
                    {(string.IsNullOrWhiteSpace(order.ShippingAddress) ? "" : $"<p><strong>Địa chỉ nhận hàng:</strong> {order.ShippingAddress}</p>")}
                </div>

                <table class='table'>
                    <thead>
                        <tr>
                            <th>Sản phẩm</th>
                            <th class='text-right'>SL</th>
                            <th class='text-right'>Đơn giá</th>
                            <th class='text-right'>Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>");

        int totalQuantity = 0;
        decimal totalUnitPrice = 0;
        decimal totalSubTotal = 0;

        foreach (var item in order.OrderDetails ?? Enumerable.Empty<OrderDetail>())
        {
            totalQuantity += item.Quantity;
            totalUnitPrice += item.UnitPrice;
            totalSubTotal += item.SubTotal;

            var priceStr = item.IsGift ? "Quà tặng" : $"{item.UnitPrice:N0}đ";
            var subTotalStr = item.IsGift ? "0đ" : $"{item.SubTotal:N0}đ";
            
            sb.Append($@"
                        <tr>
                            <td>{item.SkuSnapshotName} {(item.IsGift ? "<span style='color:#e11d48;font-size:12px;'>(Quà)</span>" : "")}</td>
                            <td class='text-right'>{item.Quantity}</td>
                            <td class='text-right'>{priceStr}</td>
                            <td class='text-right'>{subTotalStr}</td>
                        </tr>");
        }

        sb.Append($@"
                    </tbody>
                    <tfoot>
                        <tr style='font-weight: 600; background-color: #f9fafb;'>
                            <td>Tổng cộng</td>
                            <td class='text-right'>{totalQuantity}</td>
                            <td class='text-right'>{totalUnitPrice:N0}đ</td>
                            <td class='text-right'>{totalSubTotal:N0}đ</td>
                        </tr>
                    </tfoot>
                </table>

                <div class='summary'>
                    <div class='summary-row'>
                        <span>Tạm tính:</span>
                        <span>{order.TotalAmount:N0}đ</span>
                    </div>");

        if (order.DiscountAmount > 0)
        {
            sb.Append($@"
                    <div class='summary-row'>
                        <span>Chiết khấu:</span>
                        <span>-{order.DiscountAmount:N0}đ</span>
                    </div>");
        }

        sb.Append($@"
                    <div class='summary-row total'>
                        <span>Tổng thanh toán:</span>
                        <span>{order.FinalAmount:N0}đ</span>
                    </div>
                </div>

                <div class='footer'>
                    <p>Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi qua số điện thoại hỗ trợ.</p>
                    <p>&copy; {DateTime.Now.Year} Hương Vân Trà. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>");

        return sb.ToString();
    }
}
