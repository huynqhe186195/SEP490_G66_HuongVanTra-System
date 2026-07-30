using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class SupplierReceipt
{
    public Guid Id { get; set; }
    public string ReceiptCode { get; set; } = string.Empty;
    public string? SupplierName { get; set; }
    public string? SupplierReference { get; set; }
    public string? SupplierDocumentNumber { get; set; }
    public DateTime? SupplierDocumentDate { get; set; }
    public string? DeliveredByName { get; set; }
    public string? OriginalDocumentReference { get; set; }
    public DateTime ReceivedDate { get; set; }
    public string? Note { get; set; }
    public decimal TotalAmount { get; set; }
    public SupplierReceiptStatus Status { get; set; } = SupplierReceiptStatus.Draft;
    public Guid CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public string? CreatedByRoleName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? SubmittedBy { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public Guid? ReviewedBy { get; set; }
    public string? ReviewedByName { get; set; }
    public string? ReviewedByRoleName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }
    public Guid? SupplierId { get; set; }
    /// <summary>Snapshot tại thời điểm lập phiếu — thay đổi Supplier về sau không được sửa phiếu cũ.</summary>
    public string? SupplierNameSnapshot { get; set; }
    /// <summary>Snapshot Mã Nhà Cung Cấp tại thời điểm lập phiếu. Null với phiếu cũ trước migration.</summary>
    public string? SupplierCodeSnapshot { get; set; }
    public Guid? StockImportSlipId { get; set; }
    public string? StockImportSlipCode { get; set; }

    public ICollection<SupplierReceiptItem> Items { get; set; } = new List<SupplierReceiptItem>();
}
