using OrderService.Domain.Enums;

namespace OrderService.Application.Interfaces;

public interface IOrderCodeGenerator
{
    Task<string> GenerateAsync(OrderKind kind = OrderKind.Sale, CancellationToken ct = default);
}
