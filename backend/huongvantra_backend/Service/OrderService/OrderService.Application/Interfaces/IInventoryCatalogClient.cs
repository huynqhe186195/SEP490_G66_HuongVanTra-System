namespace OrderService.Application.Interfaces;

public interface IInventoryCatalogClient
{
    Task DeductMaterialsAsync(IEnumerable<(Guid SkuId, int Quantity)> items, CancellationToken ct = default);
    Task<InventoryStockHandlingResponse> PreparePosStockDeductionAsync(
        InventoryStockHandlingRequest request,
        CancellationToken ct = default);
}

public record InventoryStockHandlingItemRequest(
    Guid SkuId,
    string? SkuSnapshotName,
    string? SkuSnapshotCode,
    int Quantity);

public record InventoryStockHandlingRequest(
    Guid OrderId,
    string OrderCode,
    string OrderStatus,
    decimal TotalAmount,
    List<InventoryStockHandlingItemRequest> Items);

public record InventoryStockHandlingLineResponse(
    Guid SkuId,
    string? SkuCode,
    string SkuName,
    int OrderedQuantity,
    int FinishedDeductedQuantity,
    int PendingBomQuantity);

public record InventoryStockHandlingResponse(
    Guid OrderId,
    string OrderCode,
    string StockHandlingMode,
    bool HasPendingStockReconciliation,
    string Message,
    List<Guid> QueueIds,
    List<InventoryStockHandlingLineResponse> Lines);

public class InventoryStockHandlingException(string message) : Exception(message);
