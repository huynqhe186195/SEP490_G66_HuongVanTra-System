using ProductService.Application.DTOs.Requests;

namespace ProductService.Application.DTOs.Responses;

public record ProductCreationRequestItemResponse(
    Guid Id,
    string ClientKey,
    int SortOrder,
    CreateProductRequest? ProductSnapshot,
    string ProductName,
    string? ProductType,
    int? CategoryId,
    string? BaseUnit,
    string? InventoryUnit,
    int VariantCount,
    int BomLineCount,
    string ValidationStatus,
    string? ValidationMessage);

public record ProductCreationRequestRevisionResponse(
    Guid Id,
    int RevisionNumber,
    List<ProductCreationRequestItemResponse> SubmittedItems,
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

public record ProductCreationRequestResponse(
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
    string? WarehouseNote,
    string? AdminNote,
    DateTime? CompletedAt,
    List<Guid> CreatedProductIds,
    List<ProductCreationRequestItemResponse> Items,
    List<ProductCreationRequestRevisionResponse> Revisions);
