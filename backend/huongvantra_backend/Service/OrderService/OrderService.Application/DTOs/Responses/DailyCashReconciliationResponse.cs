namespace OrderService.Application.DTOs.Responses;

/// <summary>
/// Báo cáo đối soát két cuối ngày. Lấy theo dòng tiền thực tế (Payments.PaidAt) chứ không
/// theo ngày tạo đơn, vì tiền cọc và tiền còn lại của cùng một đơn có thể thu ở hai ngày khác nhau.
/// </summary>
public class DailyCashReconciliationResponse
{
    public DateTime ReportDate { get; set; }

    /// <summary>Tiền thu vào, tách theo mục đích thanh toán.</summary>
    public List<CashFlowLineDto> CashIn { get; set; } = [];

    /// <summary>Tiền chi ra (hoàn tiền trả hàng), tách theo phương thức hoàn.</summary>
    public List<CashFlowLineDto> CashOut { get; set; } = [];

    /// <summary>Đối soát két theo phương thức thanh toán (thu vào trừ chi ra).</summary>
    public List<CashReconciliationLineDto> ByPaymentMethod { get; set; } = [];

    /// <summary>Chi tiết từng khoản thu trong ngày.</summary>
    public List<CashReceiptDto> Receipts { get; set; } = [];

    public decimal TotalCashIn { get; set; }
    public decimal TotalCashOut { get; set; }
    /// <summary>TotalCashIn - TotalCashOut. Số tiền thực tế phải có trong két/tài khoản.</summary>
    public decimal NetCashFlow { get; set; }

    /// <summary>Cọc bị giữ do hủy đơn backorder. Thu nhập khác, KHÔNG cộng vào doanh thu bán hàng.</summary>
    public decimal ForfeitedDepositIncome { get; set; }
    public int ForfeitedDepositOrders { get; set; }

    /// <summary>Doanh thu bán hàng ghi nhận theo đơn hoàn tất trong ngày (tham chiếu, khác dòng tiền).</summary>
    public decimal SalesRevenue { get; set; }
    public decimal SalesDiscount { get; set; }
    public int CompletedOrders { get; set; }

    /// <summary>Doanh thu hàng trả trong kỳ.</summary>
    public decimal ReturnedRevenue { get; set; }
    /// <summary>SalesRevenue - ReturnedRevenue. Đây mới là "doanh thu ghi nhận" của kỳ.</summary>
    public decimal NetRecognizedRevenue { get; set; }

    /// <summary>Đếm số dòng hàng và số SKU thay cho tổng số lượng, vì Gram và Piece không cộng chung được.</summary>
    public int TotalLineCount { get; set; }
    public int DistinctSkuCount { get; set; }

    public int CancelledOrders { get; set; }
    public int RefundedOrders { get; set; }

    /// <summary>Doanh thu và tiền thu vào theo từng giờ trong kỳ.</summary>
    public List<HourlyRevenueLineDto> HourlyRevenue { get; set; } = [];
    public List<EmployeeSalesLineDto> ByEmployee { get; set; } = [];
    public List<ChannelSalesLineDto> ByChannel { get; set; } = [];

    /// <summary>Chi tiết từng đơn trong kỳ, dùng cho chế độ xem Chi tiết.</summary>
    public List<OrderSummaryLineDto> Orders { get; set; } = [];

    /// <summary>Cầu nối giải thích vì sao doanh thu ghi nhận khác tổng tiền thu vào.</summary>
    public RevenueCashBridgeDto Bridge { get; set; } = new();

    /// <summary>Hàng hóa đã bán trong kỳ, gộp theo SKU. Dùng cho mối quan tâm "Hàng Hóa".</summary>
    public List<ProductSalesLineDto> Products { get; set; } = [];

    /// <summary>Đơn hoàn tất tách theo phương thức bán hàng (tại quầy / giao hàng / hẹn giao).</summary>
    public List<SalesModeLineDto> BySalesMode { get; set; } = [];
}

public class HourlyRevenueLineDto
{
    public int Hour { get; set; }
    public decimal Revenue { get; set; }
    public int OrderCount { get; set; }
    public decimal CashIn { get; set; }
}

public class EmployeeSalesLineDto
{
    public Guid? EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public int OrderCount { get; set; }
    public decimal Revenue { get; set; }
    public decimal Discount { get; set; }
    public decimal CashCollected { get; set; }
}

public class ChannelSalesLineDto
{
    public string Channel { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int OrderCount { get; set; }
    public decimal Revenue { get; set; }
}

public class OrderSummaryLineDto
{
    public Guid OrderId { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string? CustomerName { get; set; }
    public string? EmployeeName { get; set; }
    public string Channel { get; set; } = string.Empty;
    public string ChannelLabel { get; set; } = string.Empty;
    public string SalesMode { get; set; } = string.Empty;
    public string SalesModeLabel { get; set; } = string.Empty;
    public string OrderStatus { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal FinalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    /// <summary>Các phương thức đã thu của đơn, nối bằng dấu phẩy.</summary>
    public string PaymentMethods { get; set; } = string.Empty;
    public int LineCount { get; set; }
}

/// <summary>
/// Giải thích chênh lệch giữa doanh thu ghi nhận và tiền thực thu:
/// RecognizedRevenue - UnpaidRevenue + PriorPeriodCollections + AdvanceOnOpenOrders
/// + ForfeitedDeposit - Refunds = TotalCashIn.
/// </summary>
public class RevenueCashBridgeDto
{
    public decimal RecognizedRevenue { get; set; }
    /// <summary>Doanh thu đã ghi nhận nhưng chưa thu tiền (ghi nợ, COD chưa đối soát).</summary>
    public decimal UnpaidRevenue { get; set; }
    /// <summary>Tiền thu trong kỳ nhưng thuộc đơn tạo từ kỳ trước (cọc, thu phần còn lại).</summary>
    public decimal PriorPeriodCollections { get; set; }
    /// <summary>
    /// Tiền thu trong kỳ của đơn tạo trong kỳ nhưng chưa hoàn tất: chờ nguyên vật liệu,
    /// chờ sản xuất, chờ điều chuyển. Tiền đã vào két nhưng chưa được ghi nhận doanh thu.
    /// </summary>
    public decimal AdvanceOnOpenOrders { get; set; }
    public decimal ForfeitedDeposit { get; set; }
    public decimal Refunds { get; set; }
    public decimal TotalCashIn { get; set; }
}

public class ProductSalesLineDto
{
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuName { get; set; } = string.Empty;
    public string? CategoryName { get; set; }
    public int Quantity { get; set; }
    public int ReturnedQuantity { get; set; }
    public decimal Revenue { get; set; }
    /// <summary>Số đơn có chứa SKU này.</summary>
    public int OrderCount { get; set; }
}

public class SalesModeLineDto
{
    public string SalesMode { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int OrderCount { get; set; }
    public int Quantity { get; set; }
    public decimal Revenue { get; set; }
}

public class CashFlowLineDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public int Count { get; set; }
}

public class CashReconciliationLineDto
{
    public string PaymentMethod { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public decimal AmountIn { get; set; }
    public decimal AmountOut { get; set; }
    public decimal Net { get; set; }
    public int Count { get; set; }
    /// <summary>Chỉ Cash mới là tiền mặt thật trong két. VietQR/BankTransfer là tiền vào tài khoản.</summary>
    public bool IsCash { get; set; }
}

public class CashReceiptDto
{
    public Guid OrderId { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public DateTime PaidAt { get; set; }
    /// <summary>Ngày tạo đơn — dùng để tách khoản thu thuộc đơn của kỳ trước.</summary>
    public DateTime OrderCreatedAt { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string PaymentPurpose { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? EmployeeName { get; set; }
    public string? CustomerName { get; set; }
    public string OrderStatus { get; set; } = string.Empty;
}
