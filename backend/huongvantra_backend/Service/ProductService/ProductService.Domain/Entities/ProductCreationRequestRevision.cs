namespace ProductService.Domain.Entities;

public class ProductCreationRequestRevision : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequestId { get; set; }
    public ProductCreationRequest? Request { get; set; }

    public int RevisionNumber { get; set; }
    public string SubmittedSnapshotJson { get; set; } = string.Empty;
    public Guid? SubmittedBy { get; set; }
    public string? SubmittedByName { get; set; }
    public string? SubmittedByRoleName { get; set; }
    public DateTime SubmittedAt { get; set; }
    public string? Decision { get; set; }
    public string? DecisionReason { get; set; }
    public Guid? DecidedBy { get; set; }
    public string? DecidedByName { get; set; }
    public string? DecidedByRoleName { get; set; }
    public DateTime? DecidedAt { get; set; }
}
