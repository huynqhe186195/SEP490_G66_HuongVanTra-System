using DocumentService.Domain.Enums;

namespace DocumentService.Domain.Entities;

public class Contract : BaseEntity
{
    public Guid Id { get; set; }
    public string ContractCode { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public Guid CreatedByUserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public ContractType ContractType { get; set; }
    public ContractStatus Status { get; set; } = ContractStatus.Draft;
    public DateOnly? EffectiveDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public decimal? DiscountPercent { get; set; }
    public decimal? CreditLimit { get; set; }
    public int? PaymentTermDays { get; set; }
    public string? Notes { get; set; }
    public string? RejectionNote { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
}
