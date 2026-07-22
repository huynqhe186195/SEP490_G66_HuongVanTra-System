using OrderService.Application.Tests.TestSupport;
using OrderService.Domain.Entities;
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

    [Fact]
    public void ReturnLineSnapshot_DocumentsSkuDataForInventoryReceiptEvent()
    {
        var detail = new OrderDetail
        {
            SkuId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            SkuSnapshotCode = "FG-TRA-NHAI-50G",
            SkuSnapshotName = "Tra nhai 50g",
            Quantity = 2,
        };

        Assert.Equal("FG-TRA-NHAI-50G", detail.SkuSnapshotCode);
        Assert.Equal("Tra nhai 50g", detail.SkuSnapshotName);
        Assert.Equal(2, detail.Quantity);
    }
}
