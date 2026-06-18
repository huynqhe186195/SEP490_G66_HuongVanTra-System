using System.Net;
using System.Net.Mail;
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

    public async Task SendInvoiceEmailAsync(string toEmail, string customerName, Order order, CancellationToken ct = default)
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
                Body = GenerateInvoiceHtml(customerName, order),
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

    private static string GenerateInvoiceHtml(string customerName, Order order)
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
                    <p><strong>Ngày mua:</strong> {order.CreatedAt.ToLocalTime():dd/MM/yyyy HH:mm}</p>
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

        foreach (var item in order.OrderDetails ?? Enumerable.Empty<OrderDetail>())
        {
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
