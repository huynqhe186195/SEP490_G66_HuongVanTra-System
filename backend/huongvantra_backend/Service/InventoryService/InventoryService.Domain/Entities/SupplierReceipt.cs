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
    public DateTime ReceivedDate { get; set; }
    public string? Note { get; set; }
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
    public Guid? StockImportSlipId { get; set; }
    public string? StockImportSlipCode { get; set; }

    public ICollection<SupplierReceiptItem> Items { get; set; } = new List<SupplierReceiptItem>();
}
