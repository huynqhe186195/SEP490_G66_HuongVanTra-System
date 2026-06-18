using OrderService.Domain.Entities;

namespace OrderService.Application.Interfaces;

public interface IEmailService
{
    Task SendInvoiceEmailAsync(string toEmail, string customerName, Order order, CancellationToken ct = default);
}
