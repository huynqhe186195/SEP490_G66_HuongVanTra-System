namespace ProductService.Application.Interfaces;

public record InventorySupplierReceiptCostLine(
    Guid SourceReceiptId,
    Guid SourceReceiptLineId,
    string ReceiptCode,
    Guid SkuId,
    string SkuCode,
    decimal ActualQuantity,
    decimal UnitCost,
    DateTime ApprovedAt);

public record InventorySupplierReceiptCostLinesResponse(
    List<InventorySupplierReceiptCostLine> Items);

/// <summary>
/// Đọc các dòng phiếu nhập NCC đã duyệt từ InventoryService qua HTTP.
/// ProductService không truy cập trực tiếp database của InventoryService.
/// </summary>
public interface IInventorySupplierReceiptCostClient
{
    Task<InventorySupplierReceiptCostLinesResponse> GetApprovedLinesAsync(
        Guid? skuId,
        string? bearerToken,
        CancellationToken ct = default);
}
