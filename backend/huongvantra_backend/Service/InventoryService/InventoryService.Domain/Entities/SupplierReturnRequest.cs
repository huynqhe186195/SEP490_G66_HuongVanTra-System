using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class SupplierReturnRequest
{
    public Guid Id { get; set; }
    public string ReturnCode { get; set; } = string.Empty;
    public Guid? SupplierReceiptId { get; set; }
    public string? SupplierReceiptCode { get; set; }
    public string? SupplierName { get; set; }
    public string? SupplierReference { get; set; }
    public string DefectReasonCode { get; set; } = string.Empty;

    /// <summary>
    /// Idempotency key do client sinh cho mỗi lần bấm gửi. Trả hàng trừ kho ngay khi tạo nên
    /// double-submit sẽ trừ kho hai lần nếu không khoá theo key này.
    /// </summary>
    public Guid OperationId { get; set; }
    public string? Reason { get; set; }
    public string? Note { get; set; }
    public InventoryReturnRequestStatus Status { get; set; } = InventoryReturnRequestStatus.Pending;
    public Guid CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public string? CreatedByRoleName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? ReviewedBy { get; set; }
    public string? ReviewedByName { get; set; }
    public string? ReviewedByRoleName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }

    public ICollection<SupplierReturnRequestItem> Items { get; set; } = new List<SupplierReturnRequestItem>();

    /// <summary>Ảnh hàng lỗi làm bằng chứng hậu kiểm, tối đa <see cref="MaxEvidenceImages"/> ảnh.</summary>
    public ICollection<SupplierReturnEvidenceImage> EvidenceImages { get; set; } = new List<SupplierReturnEvidenceImage>();

    public const int MaxEvidenceImages = 5;
}
