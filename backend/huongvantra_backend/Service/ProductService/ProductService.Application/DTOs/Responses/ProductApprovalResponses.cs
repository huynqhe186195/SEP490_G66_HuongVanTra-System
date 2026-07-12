using ProductService.Application.DTOs.Requests;

namespace ProductService.Application.DTOs.Responses;

public record NewProductApprovalResponse(
    Guid Id,
    string ApprovalCode,
    string Status,
    CreateProductRequest? ProductSnapshot,
    CreateProductRequest? FinalProductSnapshot,
    string ProductName,
    string? ProductType,
    int? CategoryId,
    decimal? InitialPrice,
    Guid? RequestedBy,
    string? RequestedByName,
    string? RequestedByRoleName,
    DateTime? RequestedAt,
    Guid? AuthorisedBy,
    string? AuthorisedByName,
    string? AuthorisedByRoleName,
    DateTime? AuthorisedAt,
    Guid? ConfirmedBy,
    string? ConfirmedByName,
    string? ConfirmedByRoleName,
    DateTime? ConfirmedAt,
    Guid? CancelledBy,
    string? CancelledByName,
    string? CancelledByRoleName,
    DateTime? CancelledAt,
    string? CancelReason,
    string? CreationMethod,
    string? ManualModeReason,
    DateTime? UsedAt,
    Guid? CreatedProductId,
    List<Guid> CreatedSkuIds,
    string? AdminNotes,
    string? WarehouseNotes,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record ProductApprovalCodeValidationResponse(
    bool IsValid,
    string? Message,
    NewProductApprovalResponse? Approval);

public record ProductApprovalCreationResponse(
    NewProductApprovalResponse Approval,
    ProductResponse Product);
