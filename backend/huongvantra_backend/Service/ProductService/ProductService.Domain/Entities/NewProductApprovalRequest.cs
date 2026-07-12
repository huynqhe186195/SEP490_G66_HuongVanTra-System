using ProductService.Domain.Enums;

namespace ProductService.Domain.Entities;

public class NewProductApprovalRequest : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ApprovalCode { get; set; } = string.Empty;
    public NewProductApprovalStatus Status { get; set; } = NewProductApprovalStatus.Draft;
    public string ProductSnapshotJson { get; set; } = string.Empty;
    public string? FinalProductSnapshotJson { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductType { get; set; }
    public int? CategoryId { get; set; }
    public decimal? InitialPrice { get; set; }

    public Guid? RequestedBy { get; set; }
    public string? RequestedByName { get; set; }
    public string? RequestedByRoleName { get; set; }
    public DateTime? RequestedAt { get; set; }

    public Guid? AuthorisedBy { get; set; }
    public string? AuthorisedByName { get; set; }
    public string? AuthorisedByRoleName { get; set; }
    public DateTime? AuthorisedAt { get; set; }

    public Guid? ConfirmedBy { get; set; }
    public string? ConfirmedByName { get; set; }
    public string? ConfirmedByRoleName { get; set; }
    public DateTime? ConfirmedAt { get; set; }

    public Guid? CancelledBy { get; set; }
    public string? CancelledByName { get; set; }
    public string? CancelledByRoleName { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelReason { get; set; }

    public ProductCreationMethod? CreationMethod { get; set; }
    public string? ManualModeReason { get; set; }
    public DateTime? UsedAt { get; set; }
    public Guid? CreatedProductId { get; set; }
    public string? CreatedSkuIdsJson { get; set; }
    public string? CreatedBomIdsJson { get; set; }
    public string? AdminNotes { get; set; }
    public string? WarehouseNotes { get; set; }
}
