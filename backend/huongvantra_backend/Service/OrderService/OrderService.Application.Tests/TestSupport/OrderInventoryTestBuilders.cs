using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.Tests.TestSupport;

public static class OrderInventoryTestBuilders
{
    public static Order PosOrderPendingInventoryDeduction(
        string orderCode = "ORD-BASELINE-0001",
        string idempotencyKey = "baseline-idempotency-key")
    {
        return new Order
        {
            Id = Guid.Parse("ffffffff-6666-6666-6666-ffffffffffff"),
            OrderCode = orderCode,
            OrderChannel = OrderChannel.POS,
            OrderKind = OrderKind.Sale,
            OrderStatus = OrderStatus.Completed,
            InventorySyncStatus = InventorySyncStatus.PendingDeduction,
            IdempotencyKey = idempotencyKey,
            TotalAmount = 100000m,
            FinalAmount = 100000m,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }
}
