using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Tests.TestSupport;

public static class InventoryWorkflowTestBuilders
{
    public static SkuStock SkuStock(
        Guid? skuId = null,
        string skuCode = "FG-BASELINE-100G",
        int warehouseQuantity = 100,
        int shelfQuantity = 10)
    {
        return new SkuStock
        {
            SkuId = skuId ?? Guid.Parse("aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa"),
            SkuCode = skuCode,
            WeightInGrams = 100,
            WarehouseQuantityOnHand = warehouseQuantity,
            QuantityOnHand = shelfQuantity,
            LowStockThreshold = 5,
            WarehouseLowStockThreshold = 10,
            ShelfLowStockThreshold = 5,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public static WarehouseBatch WarehouseBatch(Guid? batchId = null, Guid? skuId = null)
    {
        var id = batchId ?? Guid.Parse("bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb");
        var item = new WarehouseBatchItem
        {
            Id = Guid.Parse("cccccccc-3333-3333-3333-cccccccccccc"),
            WarehouseBatchId = id,
            SkuId = skuId ?? Guid.Parse("aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa"),
            SkuCode = "FG-BASELINE-100G",
            ProductSnapshotName = "Baseline SKU",
            InitialQuantity = 100,
            QuantityOnHand = 100,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        return new WarehouseBatch
        {
            Id = id,
            LotCode = "LOT-BASELINE-0001",
            SourceType = "baseline",
            Status = "active",
            CreatedBy = InventoryTestActors.Warehouse,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = new List<WarehouseBatchItem> { item },
        };
    }

    public static StockAdjustmentRequest PendingShelfReplenishmentRequest(Guid? skuId = null)
    {
        var requestId = Guid.Parse("dddddddd-4444-4444-4444-dddddddddddd");
        return new StockAdjustmentRequest
        {
            Id = requestId,
            RequestCode = "YC-BASELINE-0001",
            Status = StockAdjustmentRequestStatus.Pending,
            RequestedBy = InventoryTestActors.Manager,
            RequestedAt = DateTime.UtcNow,
            Reason = "Baseline replenishment",
            Items = new List<StockAdjustmentRequestItem>
            {
                new()
                {
                    Id = Guid.Parse("eeeeeeee-5555-5555-5555-eeeeeeeeeeee"),
                    RequestId = requestId,
                    SkuId = skuId ?? Guid.Parse("aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa"),
                    SkuCode = "FG-BASELINE-100G",
                    SkuSnapshotName = "Baseline SKU",
                    QuantityDelta = 5,
                    QuantityOnHandSnapshot = 10,
                },
            },
        };
    }
}
