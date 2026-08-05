using OrderService.Domain.Enums;

namespace OrderService.Application.DTOs.Requests;

/// <summary>Cách hàng được trao cho khách — dùng lọc báo cáo cuối ngày.</summary>
public enum SalesMode
{
    /// <summary>Bán tại quầy, khách nhận hàng ngay.</summary>
    Counter,
    /// <summary>Giao tận nơi (COD hoặc có địa chỉ giao).</summary>
    Delivery,
    /// <summary>Hẹn giao — khách quay lại lấy theo ngày hẹn.</summary>
    Scheduled
}

/// <summary>Bộ lọc của báo cáo cuối ngày. Mọi trường ngoài khoảng thời gian đều tùy chọn.</summary>
public class DailyReportFilter
{
    public DateTime FromUtc { get; set; }
    public DateTime ToUtc { get; set; }
    public Guid? EmployeeId { get; set; }
    public Guid? CustomerId { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public SalesMode? SalesMode { get; set; }
    public OrderChannel? Channel { get; set; }
    /// <summary>Bỏ trống nghĩa là chỉ tính đơn hoàn tất.</summary>
    public OrderStatus? OrderStatus { get; set; }
}
