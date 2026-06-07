namespace OrderService.Application.Interfaces;

public interface IOrderEventPublisher
{
    Task PublishOrderCompletedAsync(
        Guid orderId, string orderCode, Guid customerId,
        decimal totalAmount, decimal debtAmount,
        IEnumerable<(Guid SkuId, int Quantity)> items,
        CancellationToken ct = default);
}
