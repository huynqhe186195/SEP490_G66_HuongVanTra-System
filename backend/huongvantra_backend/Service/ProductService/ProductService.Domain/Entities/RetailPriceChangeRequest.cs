using ProductService.Domain.Enums;

namespace ProductService.Domain.Entities;

/// <summary>
/// Kế toán đề xuất giá bán mới; giá chỉ thực sự đổi khi Admin phê duyệt.
/// </summary>
public class RetailPriceChangeRequest : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string RequestCode { get; set; } = string.Empty;
    public RetailPriceChangeRequestStatus Status { get; set; } = RetailPriceChangeRequestStatus.PendingApproval;

    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string VariantName { get; set; } = string.Empty;

    public decimal CurrentRetailPrice { get; set; }
    public decimal RequestedRetailPrice { get; set; }
    public decimal? AverageCostPriceAtRequest { get; set; }
    public string? Reason { get; set; }

    public Guid? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public string? CreatedByRoleName { get; set; }

    public Guid? ReviewedBy { get; set; }
    public string? ReviewedByName { get; set; }
    public string? ReviewedByRoleName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? AdminNote { get; set; }
    public string? RejectReason { get; set; }

    public decimal? AppliedRetailPrice { get; set; }
    public DateTime? AppliedAt { get; set; }
}
