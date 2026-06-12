using OrderService.Domain.Enums;

namespace OrderService.Domain.Entities;

public class ReturnOrder : BaseEntity
{
    public Guid Id { get; set; }
    public string ReturnCode { get; set; } = string.Empty;
    public Guid SourceOrderId { get; set; }
    public string SourceOrderCode { get; set; } = string.Empty;
    public Guid? CustomerId { get; set; }
    public string? CustomerSnapshotName { get; set; }
    public decimal ReturnAmount { get; set; }
    public decimal ExchangeAmount { get; set; }
    public decimal NetCustomerPays { get; set; }
    public decimal RefundAmount { get; set; }
    public decimal CustomerPaidAmount { get; set; }
    public PaymentMethod RefundMethod { get; set; }
    public Guid? ExchangeOrderId { get; set; }
    public string? Note { get; set; }

    public Order SourceOrder { get; set; } = null!;
    public ICollection<ReturnOrderDetail> Details { get; set; } = [];
}
