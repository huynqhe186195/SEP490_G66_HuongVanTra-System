using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class ProductionOrder
{
    public Guid Id { get; set; }
    public string ProductionCode { get; set; } = string.Empty;
    public string? Note { get; set; }
    public ProductionOrderStatus Status { get; set; } = ProductionOrderStatus.Draft;
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public ICollection<ProductionOrderLine> Lines { get; set; } = [];
    public ICollection<ProductionOrderOutputLine> OutputLines { get; set; } = [];
}
