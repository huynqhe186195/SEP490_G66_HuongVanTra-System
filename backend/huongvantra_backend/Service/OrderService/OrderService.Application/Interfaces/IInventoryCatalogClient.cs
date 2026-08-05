namespace OrderService.Application.Interfaces;

public interface IInventoryCatalogClient
{
    Task DeductMaterialsAsync(
        IEnumerable<(Guid SkuId, string? SkuCode, string? SkuName, int Quantity)> items,
        string? referenceType,
        Guid? referenceId,
        string? referenceCode,
        string? note,
        CancellationToken ct = default);
    Task<InventoryStockHandlingResponse> PreparePosStockDeductionAsync(
        InventoryStockHandlingRequest request,
        CancellationToken ct = default);
    /// <summary>
    /// POS-04 (H4): thay giữ chỗ tồn Kệ Hàng cho đơn COD đang sửa — gọi đồng bộ, all-or-nothing,
    /// idempotent theo OperationId. Ném <see cref="InventoryStockHandlingException"/> khi Inventory từ chối.
    /// </summary>
    Task<InventoryReservationReplaceResponse> ReplaceCodReservationAsync(
        InventoryReservationReplaceRequest request,
        CancellationToken ct = default);

    /// <summary>
    /// POS-04 (truy vết giữ chỗ): lọc tập OrderId xuống còn các đơn đang giữ chỗ tồn Kệ Hàng.
    /// Chỉ đọc, fail-soft: lỗi gọi Inventory trả về tập rỗng để không chặn danh sách đơn.
    /// </summary>
    Task<HashSet<Guid>> GetOrderIdsWithActiveReservationAsync(
        IReadOnlyCollection<Guid> orderIds,
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
    List<InventoryStockHandlingItemRequest> Items,
    bool AcceptBackorder = false,
    bool PreviewOnly = false,
    int BackorderMinLeadDays = 3,
    int BackorderMaxLeadDays = 5,
    string? FulfillmentPreference = null,
    DateTime? PickupDate = null,
    string? PickupNote = null);

public record InventoryStockHandlingLineResponse(
    Guid SkuId,
    string? SkuCode,
    string SkuName,
    int OrderedQuantity,
    int FinishedDeductedQuantity,
    int PendingBomQuantity,
    int WarehouseDeductedQuantity = 0);

public record InventoryStockHandlingResponse(
    Guid OrderId,
    string OrderCode,
    string StockHandlingMode,
    bool HasPendingStockReconciliation,
    string Message,
    List<Guid> QueueIds,
    List<InventoryStockHandlingLineResponse> Lines,
    bool BackorderRequired = false,
    string? BackorderMessage = null);

public class InventoryStockHandlingException(string message) : Exception(message);
public class BackorderConfirmationRequiredException : Exception
{
    public BackorderConfirmationRequiredException(string message) : base(message)
    {
    }

    public BackorderConfirmationRequiredException(InventoryStockHandlingResponse response)
        : base(response.BackorderMessage ?? response.Message)
    {
        Lines = response.Lines;
    }

    public IReadOnlyList<InventoryStockHandlingLineResponse> Lines { get; } = [];
}

public record InventoryReservationReplaceItemRequest(
    Guid SkuId,
    string? SkuSnapshotName,
    string? SkuSnapshotCode,
    int Quantity);

public record InventoryReservationReplaceRequest(
    Guid OrderId,
    Guid OperationId,
    decimal TotalAmount,
    List<InventoryReservationReplaceItemRequest> Items);

public record InventoryReservationReplaceResponse(
    Guid QueueId,
    Guid OrderId,
    string OrderCode,
    bool Replaced,
    bool AlreadyProcessed,
    string Message);
