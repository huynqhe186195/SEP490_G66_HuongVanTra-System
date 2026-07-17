namespace ProductService.Application.DTOs.Responses;

public record ProductDeletionRequestItemResponse(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string? ProductType,
    string? CategoryName,
    int VariantCount,
    string? Reason,
    string ValidationStatus,
    string? ValidationMessage);

public record ProductDeletionRequestRevisionResponse(
    Guid Id,
    int RevisionNumber,
    List<ProductDeletionRequestItemResponse> SubmittedItems,
    Guid? SubmittedBy,
    string? SubmittedByName,
    string? SubmittedByRoleName,
    DateTime SubmittedAt,
    string? Decision,
    string? DecisionReason,
    Guid? DecidedBy,
    string? DecidedByName,
    string? DecidedByRoleName,
    DateTime? DecidedAt);

public record ProductDeletionRequestResponse(
    Guid Id,
    string RequestCode,
    string Title,
    string Status,
    int RevisionNumber,
    Guid? CreatedBy,
    string? CreatedByName,
    string? CreatedByRoleName,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? SubmittedAt,
    Guid? ReviewedBy,
    string? ReviewedByName,
    string? ReviewedByRoleName,
    DateTime? ReviewedAt,
    string? RejectReason,
    string? CancelReason,
    string? Reason,
    string? AdminNote,
    DateTime? CompletedAt,
    List<Guid> DeletedProductIds,
    List<ProductDeletionRequestItemResponse> Items,
    List<ProductDeletionRequestRevisionResponse> Revisions);
