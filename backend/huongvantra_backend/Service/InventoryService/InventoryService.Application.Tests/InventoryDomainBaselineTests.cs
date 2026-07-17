using InventoryService.Application.Tests.TestSupport;
using InventoryService.Domain.Entities;
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

    [Fact]
    public void SupplierReceiptStatusEnum_DocumentsControlledReceiptLifecycle()
    {
        Assert.Equal(0, (int)SupplierReceiptStatus.Draft);
        Assert.Equal(1, (int)SupplierReceiptStatus.PendingApproval);
        Assert.Equal(2, (int)SupplierReceiptStatus.Completed);
        Assert.Equal(3, (int)SupplierReceiptStatus.Rejected);
        Assert.Equal(4, (int)SupplierReceiptStatus.Cancelled);
    }

    [Fact]
    public void InventoryLedgerEntry_DocumentsBeforeDeltaAfterMovement()
    {
        var entry = new InventoryLedgerEntry
        {
            Location = "Warehouse",
            QuantityBefore = 120,
            QuantityDelta = 30,
            QuantityAfter = 150,
            TransactionType = "SUPPLIER_RECEIPT",
            ReferenceType = "SupplierReceipt",
            ReferenceCode = "SR-000001",
        };

        Assert.Equal(entry.QuantityBefore + entry.QuantityDelta, entry.QuantityAfter);
        Assert.Equal("Warehouse", entry.Location);
        Assert.Equal("SUPPLIER_RECEIPT", entry.TransactionType);
        Assert.Equal("SupplierReceipt", entry.ReferenceType);
    }
}
