using OrderService.Domain.Enums;

namespace OrderService.Application.DTOs.Requests;

/// <summary>
/// Bộ lọc dùng chung cho Báo cáo cuối ngày. Khoảng thời gian đã được controller quy đổi
/// từ ngày GMT+7 sang UTC trước khi tới đây; repository không tự suy diễn múi giờ.
/// </summary>
public class EndOfDayReportFilter
{
    public DateTime FromUtc { get; set; }
    public DateTime ToUtc { get; set; }
    public Guid? EmployeeId { get; set; }
    public Guid? CustomerId { get; set; }
    public OrderChannel? Channel { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public SalesMode? SalesMode { get; set; }
    /// <summary>Bỏ trống nghĩa là chỉ tính đơn hoàn tất.</summary>
    public OrderStatus? OrderStatus { get; set; }
}

/// <summary>Biến thể có phân trang, dùng cho các endpoint trả danh sách chi tiết.</summary>
public class EndOfDayPagedFilter : EndOfDayReportFilter
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
