using ProductService.Domain.Enums;

namespace ProductService.Domain.Entities;

public class ProductCreationRequest : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string RequestCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public ProductCreationRequestStatus Status { get; set; } = ProductCreationRequestStatus.Draft;
    public int RevisionNumber { get; set; } = 0;

    public Guid? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public string? CreatedByRoleName { get; set; }
    public DateTime? SubmittedAt { get; set; }

    public Guid? ReviewedBy { get; set; }
    public string? ReviewedByName { get; set; }
    public string? ReviewedByRoleName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? RejectReason { get; set; }
    public string? CancelReason { get; set; }

    public string? WarehouseNote { get; set; }
    public string? AdminNote { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? CreatedProductIdsJson { get; set; }

    public List<ProductCreationRequestItem> Items { get; set; } = [];
    public List<ProductCreationRequestRevision> Revisions { get; set; } = [];
}
