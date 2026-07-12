namespace ProductService.Application.DTOs.Requests;

public record ProductApprovalActorSnapshot(
    Guid? UserId,
    string? FullName,
    string? RoleName);

public record GetProductApprovalRequestsRequest(
    string? Status,
    string? Search,
    int Page = 1,
    int PageSize = 20);

public record CreateNewProductApprovalRequest(
    CreateProductRequest Product,
    string? AdminNotes);

public record AuthorizeProductApprovalRequest(string? AdminNotes);

public record CancelProductApprovalRequest(string Reason);

public record ValidateProductApprovalCodeRequest(string ApprovalCode);

public record CreateProductFromApprovalRequest(string ApprovalCode);

public record CreateProductManualFromApprovalRequest(
    string ApprovalCode,
    CreateProductRequest Product,
    string ManualModeReason,
    string? WarehouseNotes);

