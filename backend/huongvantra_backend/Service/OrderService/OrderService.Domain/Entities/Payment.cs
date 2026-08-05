using OrderService.Domain.Enums;

namespace OrderService.Domain.Entities;

public class Payment : BaseEntity
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public decimal Amount { get; set; }
    public PaymentStatus PaymentStatus { get; set; }
    public string? TransactionRef { get; set; }
    public bool IsCodVerified { get; set; }
    public DateTime? CodWarningDate { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? TransferQrExpiresAtUtc { get; set; }
    public string? CodDebtSettlementJson { get; set; }
    public PaymentPurpose PaymentPurpose { get; set; } = PaymentPurpose.Full;

    public Order Order { get; set; } = null!;
}
