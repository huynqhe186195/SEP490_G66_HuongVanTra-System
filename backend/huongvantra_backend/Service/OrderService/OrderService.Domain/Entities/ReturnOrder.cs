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

    /// <summary>Phase 4: Pending → Accepted/Rejected. Chỉ Accepted mới publish OrderReturned.</summary>
    public ReturnAcceptanceStatus AcceptanceStatus { get; set; } = ReturnAcceptanceStatus.Pending;
    public DateTime? AcceptedAt { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectionReason { get; set; }

    /// <summary>Draft hàng đổi — tạo đơn đổi chỉ sau Accept.</summary>
    public string? ExchangeDraftJson { get; set; }
    public decimal ExchangeManualDiscount { get; set; }

    /// <summary>Policy đã áp khi System đánh giá (Phase 2/3).</summary>
    public Guid? PolicyId { get; set; }
    public string? PolicyCode { get; set; }
    public int? PolicyVersion { get; set; }
    public string? ChecklistAnswersJson { get; set; }
    public string? PolicyEvaluationNote { get; set; }
    public bool AcceptedBySystem { get; set; }
    public bool ManagerOverride { get; set; }
    public DateTime? PolicyAcceptedAt { get; set; }

    public Order SourceOrder { get; set; } = null!;
    public ICollection<ReturnOrderDetail> Details { get; set; } = [];
    public ICollection<ReturnOrderEvidenceImage> EvidenceImages { get; set; } = [];
}
