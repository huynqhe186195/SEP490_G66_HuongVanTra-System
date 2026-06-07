namespace OrderService.Application.Interfaces;

public interface IOrderCodeGenerator
{
    Task<string> GenerateAsync(CancellationToken ct = default);
}
