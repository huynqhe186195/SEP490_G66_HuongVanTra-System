using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class StockAdjustmentRequest
{
    public Guid Id { get; set; }
    public string RequestCode { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public StockAdjustmentRequestStatus Status { get; set; } = StockAdjustmentRequestStatus.Pending;
    public Guid RequestedBy { get; set; }

    /// <summary>
    /// Ảnh chụp tên và vai trò người tạo tại thời điểm gửi yêu cầu. Lưu snapshot thay vì gọi
    /// UserService khi đọc để không tạo phụ thuộc chéo service và để dữ liệu audit không đổi
    /// khi người dùng bị đổi tên hoặc đổi vai trò sau này. Giống <c>StockTransfer.CreatedByName</c>.
    /// </summary>
    public string? RequestedByName { get; set; }
    public string? RequestedByRoleName { get; set; }
    public DateTime RequestedAt { get; set; }
    public Guid? ReviewedBy { get; set; }

    /// <summary>Ảnh chụp người xử lý gần nhất (duyệt, từ chối, đóng phần còn lại, hủy).</summary>
    public string? ReviewedByName { get; set; }
    public string? ReviewedByRoleName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }
    public List<StockAdjustmentRequestItem> Items { get; set; } = [];
}
