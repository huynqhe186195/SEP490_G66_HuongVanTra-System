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
        Assert.Equal("Warehouse", batch.Location);
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
    public void ProductionOrderStatusEnum_DocumentsApprovalLifecycle()
    {
        Assert.Equal(0, (int)ProductionOrderStatus.Draft);
        Assert.Equal(1, (int)ProductionOrderStatus.PendingApproval);
        Assert.Equal(2, (int)ProductionOrderStatus.Approved);
        Assert.Equal(3, (int)ProductionOrderStatus.Completed);
        Assert.Equal(4, (int)ProductionOrderStatus.Rejected);
        Assert.Equal(5, (int)ProductionOrderStatus.Cancelled);
    }

    [Fact]
    public void ProductionOrderOutputLine_DefaultsDestinationToWarehouse()
    {
        var output = new ProductionOrderOutputLine();

        Assert.Equal("Warehouse", output.DestinationLocation);
    }

    [Fact]
    public void InventoryReturnRequestStatusEnum_DocumentsReturnLifecycle()
    {
        Assert.Equal(0, (int)InventoryReturnRequestStatus.Pending);
        Assert.Equal(1, (int)InventoryReturnRequestStatus.Completed);
        Assert.Equal(2, (int)InventoryReturnRequestStatus.Rejected);
        Assert.Equal(3, (int)InventoryReturnRequestStatus.Cancelled);
    }

    [Fact]
    public void StocktakeStatusEnum_DocumentsApprovalLifecycle()
    {
        Assert.Equal(0, (int)StocktakeStatus.Draft);
        Assert.Equal(1, (int)StocktakeStatus.PendingApproval);
        Assert.Equal(2, (int)StocktakeStatus.Completed);
        Assert.Equal(3, (int)StocktakeStatus.Rejected);
        Assert.Equal(4, (int)StocktakeStatus.Cancelled);
    }

    [Fact]
    public void StocktakeRequestItem_DocumentsVarianceFormula()
    {
        var item = new StocktakeRequestItem
        {
            SystemQuantitySnapshot = 125,
            ActualQuantity = 118,
        };

        item.Variance = item.ActualQuantity - item.SystemQuantitySnapshot;

        Assert.Equal(-7, item.Variance);
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

    [Fact]
    public void PosSaleExportAllocation_DocumentsShelfBatchTraceability()
    {
        var slipId = Guid.NewGuid();
        var lineId = Guid.NewGuid();
        var allocation = new StockExportBatchAllocation
        {
            StockExportSlipId = slipId,
            StockExportSlipLineId = lineId,
            LotCode = "SHELF-LOT-001",
            Quantity = 5,
        };

        Assert.Equal(slipId, allocation.StockExportSlipId);
        Assert.Equal(lineId, allocation.StockExportSlipLineId);
        Assert.Equal("SHELF-LOT-001", allocation.LotCode);
        Assert.Equal(5, allocation.Quantity);
    }

    [Fact]
    public void CustomerReturnImportLine_DocumentsShelfReceiptDestination()
    {
        var line = new StockImportSlipLine
        {
            DestinationLocation = "Shelf",
            StoreQtyBefore = 0,
            StoreQtyAfter = 3,
            Quantity = 3,
            WarehouseQtyBefore = 10,
            WarehouseQtyAfter = 10,
        };

        Assert.Equal("Shelf", line.DestinationLocation);
        Assert.Equal(line.StoreQtyBefore + line.Quantity, line.StoreQtyAfter);
        Assert.Equal(line.WarehouseQtyBefore, line.WarehouseQtyAfter);
    }
}
