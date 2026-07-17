using OrderService.Application.Tests.TestSupport;
using OrderService.Domain.Enums;
using Xunit;

namespace OrderService.Application.Tests;

public class OrderInventoryIntegrationBaselineTests
{
    [Fact]
    public void PosOrderBuilder_DocumentsInventoryPendingStateAndIdempotency()
    {
        var order = OrderInventoryTestBuilders.PosOrderPendingInventoryDeduction();

        Assert.Equal(OrderChannel.POS, order.OrderChannel);
        Assert.Equal(InventorySyncStatus.PendingDeduction, order.InventorySyncStatus);
        Assert.False(string.IsNullOrWhiteSpace(order.IdempotencyKey));
    }

    [Fact]
    public void InventorySyncStatus_DocumentsExistingQueueStates()
    {
        var values = Enum.GetNames<InventorySyncStatus>();

        Assert.Contains(nameof(InventorySyncStatus.Synced), values);
        Assert.Contains(nameof(InventorySyncStatus.PendingDeduction), values);
        Assert.Contains(nameof(InventorySyncStatus.PendingReconciliation), values);
        Assert.Contains(nameof(InventorySyncStatus.Cancelled), values);
    }
}
