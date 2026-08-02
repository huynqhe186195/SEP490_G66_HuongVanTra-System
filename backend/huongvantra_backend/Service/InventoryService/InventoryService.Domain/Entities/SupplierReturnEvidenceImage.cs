namespace InventoryService.Domain.Entities;

public class SupplierReturnEvidenceImage
{
    public Guid Id { get; set; }
    public Guid SupplierReturnRequestId { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    public SupplierReturnRequest? SupplierReturnRequest { get; set; }
}
