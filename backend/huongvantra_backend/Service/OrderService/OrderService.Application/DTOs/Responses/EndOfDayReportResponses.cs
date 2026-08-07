namespace OrderService.Application.DTOs.Responses;

/// <summary>
/// Khối tổng quan của Báo cáo cuối ngày. Ba con số tiền ở đây KHÔNG thay thế được cho nhau:
/// <list type="bullet">
/// <item><c>NetRecognizedRevenue</c> — doanh thu ghi nhận, tính từ đơn hoàn tất trong kỳ.</item>
/// <item><c>TotalCashIn</c> — tổng tiền thu vào, tính từ Payment thành công trong kỳ.</item>
/// <item><c>CashOnHand</c> — tiền mặt tại két, chỉ gồm PaymentMethod.Cash.</item>
/// </list>
/// </summary>
public class EndOfDaySummaryResponse
{
    public DateTime FromUtc { get; set; }
    public DateTime ToUtc { get; set; }

    public decimal SalesRevenue { get; set; }
    public decimal SalesDiscount { get; set; }
    public decimal ReturnedRevenue { get; set; }
    /// <summary>SalesRevenue - ReturnedRevenue.</summary>
    public decimal NetRecognizedRevenue { get; set; }
    public int CompletedOrders { get; set; }

    public decimal TotalCashIn { get; set; }
    public decimal TotalCashOut { get; set; }
    public decimal NetCashFlow { get; set; }

    /// <summary>Chỉ tiền mặt thật (PaymentMethod.Cash) thu vào trừ hoàn bằng tiền mặt. VietQR không tính vào đây.</summary>
    public decimal CashOnHand { get; set; }
    /// <summary>Tiền vào tài khoản: VietQR + chuyển khoản. Không nằm trong két.</summary>
    public decimal BankIn { get; set; }

    public decimal ForfeitedDepositIncome { get; set; }
    public int ForfeitedDepositOrders { get; set; }

    /// <summary>Không cộng chung Gram với Piece — dùng số dòng hàng và số SKU thay cho "tổng số lượng".</summary>
    public int TotalLineCount { get; set; }
    public int DistinctSkuCount { get; set; }

    public int CancelledOrders { get; set; }
    public int RefundedOrders { get; set; }
    /// <summary>Đơn tạo trong kỳ nhưng chưa hoàn tất (chờ NVL / sản xuất / điều chuyển / giao).</summary>
    public int OpenOrders { get; set; }

    public List<CashFlowLineDto> CashIn { get; set; } = [];
    public List<CashFlowLineDto> CashOut { get; set; } = [];
    public List<CashReconciliationLineDto> ByPaymentMethod { get; set; } = [];
    public List<HourlyRevenueLineDto> HourlyRevenue { get; set; } = [];
    public List<EmployeeSalesLineDto> ByEmployee { get; set; } = [];
    public List<ChannelSalesLineDto> ByChannel { get; set; } = [];
    public List<SalesModeLineDto> BySalesMode { get; set; } = [];
    public RevenueCashBridgeDto Bridge { get; set; } = new();

    /// <summary>Các mặt dữ liệu không tính được với schema hiện tại, để UI hiển thị thay vì im lặng bỏ qua.</summary>
    public List<string> DataGaps { get; set; } = [];
}

/// <summary>
/// Một dòng hàng đã bán, gộp theo SKU. Số lượng tách theo đơn vị gốc; tuyệt đối không cộng
/// Gram với Piece vào một con số.
/// </summary>
public class EndOfDayProductLineDto
{
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuName { get; set; } = string.Empty;
    public string? CategoryName { get; set; }

    /// <summary>Đơn vị gốc snapshot lúc bán: "Gram", "Piece", hoặc "Unknown" với dữ liệu cũ chưa có snapshot.</summary>
    public string Unit { get; set; } = string.Empty;
    public string UnitLabel { get; set; } = string.Empty;

    public int Quantity { get; set; }
    public int ReturnedQuantity { get; set; }

    /// <summary>Doanh thu gộp của dòng: Σ(UnitPrice × Quantity), chưa trừ giảm giá cấp đơn.</summary>
    public decimal GrossRevenue { get; set; }
    /// <summary>Giảm giá cấp đơn phân bổ về dòng theo tỷ trọng doanh thu gộp.</summary>
    public decimal AllocatedDiscount { get; set; }
    /// <summary>GrossRevenue - AllocatedDiscount.</summary>
    public decimal NetRevenue { get; set; }

    public int OrderCount { get; set; }
}

/// <summary>Kèm theo trang hàng hóa: tổng theo đơn vị, để UI không phải tự cộng từ trang hiện tại.</summary>
public class EndOfDayProductTotalsDto
{
    public string Unit { get; set; } = string.Empty;
    public string UnitLabel { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public int ReturnedQuantity { get; set; }
    public decimal NetRevenue { get; set; }
    public int LineCount { get; set; }
}

public class EndOfDayProductsResponse
{
    public List<EndOfDayProductLineDto> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
    /// <summary>Tổng toàn kỳ theo đơn vị — không phụ thuộc trang đang xem.</summary>
    public List<EndOfDayProductTotalsDto> Totals { get; set; } = [];
}

public class EndOfDaySalesResponse
{
    public List<OrderSummaryLineDto> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
    /// <summary>Tổng toàn kỳ, không phụ thuộc trang đang xem.</summary>
    public decimal TotalFinalAmount { get; set; }
    public decimal TotalDiscountAmount { get; set; }
    public decimal TotalPaidAmount { get; set; }
    public Dictionary<string, int> StatusCounts { get; set; } = [];
}

public class EndOfDayPaymentsResponse
{
    public List<CashReceiptDto> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
    public decimal TotalAmount { get; set; }
    public List<CashFlowLineDto> ByPurpose { get; set; } = [];
    public List<CashReconciliationLineDto> ByPaymentMethod { get; set; } = [];
    public decimal CashOnHand { get; set; }
    public decimal BankIn { get; set; }
}

/// <summary>
/// Ngoại lệ cần xử lý trước khi chốt sổ. Các con số đếm và tổng tiền tính trên TOÀN kỳ,
/// không phụ thuộc trang đang xem — nếu để frontend tự lọc từ trang hiện tại thì phân trang
/// phía server sẽ làm số ngoại lệ báo thiếu.
/// </summary>
public class EndOfDayExceptionsResponse
{
    /// <summary>Đơn đã ghi nhận doanh thu nhưng số tiền thu thành công còn nhỏ hơn thành tiền.</summary>
    public int UnderpaidCount { get; set; }
    public decimal UnderpaidAmount { get; set; }
    public List<OrderSummaryLineDto> Underpaid { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }

    /// <summary>Tiền đã thu nhưng đơn đã bị hủy — cần quyết định hoàn tiền hay giữ cọc.</summary>
    public int ReceiptsOnCancelledCount { get; set; }
    public decimal ReceiptsOnCancelledAmount { get; set; }
    public List<CashReceiptDto> ReceiptsOnCancelled { get; set; } = [];

    /// <summary>Khoản thu trong kỳ nhưng thuộc đơn tạo từ kỳ trước.</summary>
    public int PriorPeriodReceiptCount { get; set; }
    public decimal PriorPeriodReceiptAmount { get; set; }
    public List<CashReceiptDto> PriorPeriodReceipts { get; set; } = [];

    public int CancelledOrders { get; set; }
    public int RefundedOrders { get; set; }
    public int ForfeitedDepositOrders { get; set; }
    public decimal ForfeitedDepositIncome { get; set; }

    public List<string> DataGaps { get; set; } = [];
}
