using InventoryService.Application.Tests.TestSupport;
using InventoryService.Domain.Enums;
using Xunit;

namespace InventoryService.Application.Tests;

public class InventoryDomainBaselineTests
{
    [Fact]
    public void SkuStockBuilder_DocumentsSeparateWarehouseAndShelfAggregates()
    {
        var stock = InventoryWorkflowTestBuilders.SkuStock(warehouseQuantity: 125, shelfQuantity: 7);

        Assert.Equal(125, stock.WarehouseQuantityOnHand);
        Assert.Equal(7, stock.QuantityOnHand);
        Assert.Equal(10, stock.WarehouseLowStockThreshold);
        Assert.Equal(5, stock.ShelfLowStockThreshold);
    }

    [Fact]
    public void InventoryLocationEnum_DocumentsFixedCurrentScopeLocations()
    {
        Assert.Equal(0, (int)InventoryLocation.Warehouse);
        Assert.Equal(1, (int)InventoryLocation.Shelf);
    }

    [Fact]
    public void WarehouseBatchBuilder_CreatesActiveLotWithItem()
    {
        var batch = InventoryWorkflowTestBuilders.WarehouseBatch();

        Assert.Equal("active", batch.Status);
        Assert.Single(batch.Items);
        Assert.Equal(batch.Id, batch.Items.First().WarehouseBatchId);
    }

    [Fact]
    public void StockAdjustmentRequestBuilder_CreatesPendingReplenishmentRequest()
    {
        var request = InventoryWorkflowTestBuilders.PendingShelfReplenishmentRequest();

        Assert.Equal(StockAdjustmentRequestStatus.Pending, request.Status);
        Assert.Single(request.Items);
        Assert.True(request.Items.First().QuantityDelta > 0);
    }
}
