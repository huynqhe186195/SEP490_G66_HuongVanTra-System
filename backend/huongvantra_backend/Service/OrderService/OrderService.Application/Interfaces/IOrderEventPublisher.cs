namespace OrderService.Application.Interfaces;

public interface IOrderEventPublisher
{
    Task PublishOrderPlacedAsync(
        Guid orderId, string orderCode, string orderStatus, decimal totalAmount,
        IEnumerable<(Guid SkuId, string SkuName, string? SkuCode, int Quantity)> items,
        CancellationToken ct = default);

    Task PublishOrderCancelledAsync(
        Guid orderId, string orderCode,
        IEnumerable<(Guid SkuId, int Quantity)> items,
        CancellationToken ct = default);

    Task PublishOrderCompletedAsync(
        Guid orderId, string orderCode, Guid customerId,
        decimal totalAmount, decimal debtAmount,
        IEnumerable<(Guid SkuId, int Quantity)> items,
        string? codDebtSettlementJson = null,
        CancellationToken ct = default);

    Task PublishOrderReturnedAsync(
        Guid returnId,
        string returnCode,
        Guid orderId,
        string orderCode,
        Guid? customerId,
        decimal returnAmount,
        decimal orderFinalAmount,
        decimal refundAmount,
        IEnumerable<(Guid SkuId, int Quantity)> items,
        CancellationToken ct = default);
}
