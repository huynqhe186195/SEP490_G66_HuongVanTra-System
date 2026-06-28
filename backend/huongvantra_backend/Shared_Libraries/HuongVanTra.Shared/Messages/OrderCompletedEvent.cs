namespace HuongVanTra.Shared.Messages;

public record OrderCompletedEvent
{
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public Guid CustomerId { get; init; }
    public decimal TotalAmount { get; init; }
    public decimal DebtAmount { get; init; }
    public IEnumerable<OrderItemEvent> Items { get; init; } = Enumerable.Empty<OrderItemEvent>();
    /// <summary>
    /// JSON blob từ Payment.CodDebtSettlementJson — chỉ có giá trị khi đơn COD có tiền thừa
    /// và cashier cấu hình trừ nợ cũ. Null với mọi trường hợp còn lại.
    /// CustomerService sẽ parse và gọi ApplyDebtPaymentAsync nếu != null.
    /// </summary>
    public string? CodDebtSettlementJson { get; init; }
}

public record OrderItemEvent
{
    public Guid SkuId { get; init; }
    public string? SkuName { get; init; }
    public string? SkuCode { get; init; }
    public int Quantity { get; init; }
}
