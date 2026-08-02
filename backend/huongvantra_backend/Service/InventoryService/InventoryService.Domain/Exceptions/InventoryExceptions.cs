namespace InventoryService.Domain.Exceptions;

public class InventoryNotFoundException(string message) : Exception(message);

public class InsufficientStockException(string message, IEnumerable<StockShortage> shortages)
    : Exception(message)
{
    public IReadOnlyList<StockShortage> Shortages { get; } = shortages.ToList();
}

public record StockShortage(
    Guid SkuId,
    string SkuName,
    int RequiredQuantity,
    int AvailableQuantity,
    int ShortageQuantity,
    string? AffectedSkuCode = null,
    string? ComponentSkuCode = null);

/// <summary>
/// Một SKU đang còn treo ở Yêu cầu bổ sung Kệ Hàng khác chưa xử lý xong.
/// </summary>
public record DuplicateStockAdjustmentSku(
    Guid SkuId,
    string SkuCode,
    string SkuSnapshotName,
    Guid RequestId,
    string RequestCode,
    string RequestStatus,
    string LineStatus,
    DateTime RequestedAt,
    string? RequestedByName,
    int RemainingQuantity,
    bool IsUntouched);

/// <summary>
/// SKU cần bổ sung đã có ở một yêu cầu trước đó chưa xử lý xong.
/// Blocking = true khi yêu cầu cũ còn nguyên trạng thái chờ tiếp nhận (chưa ai đụng tới) — chặn hẳn.
/// Blocking = false khi yêu cầu cũ đã được xử lý một phần — chỉ cảnh báo, người tạo xác nhận thì cho gửi.
/// </summary>
public class DuplicateStockAdjustmentRequestException(
    string message,
    IEnumerable<DuplicateStockAdjustmentSku> duplicates,
    bool blocking) : Exception(message)
{
    public IReadOnlyList<DuplicateStockAdjustmentSku> Duplicates { get; } = duplicates.ToList();
    public bool Blocking { get; } = blocking;
}
