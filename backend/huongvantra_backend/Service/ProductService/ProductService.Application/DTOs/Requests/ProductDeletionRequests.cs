namespace ProductService.Application.DTOs.Requests;

public record GetProductDeletionRequestsRequest(
    string? Status,
    string? Search,
    bool MineOnly = false,
    int Page = 1,
    int PageSize = 20);

public record ProductDeletionRequestItemInput(
    Guid ProductId,
    string? Reason);

public record CreateProductDeletionRequest(
    string Title,
    string? Reason,
    List<ProductDeletionRequestItemInput>? Items);

public record UpdateProductDeletionRequest(
    string Title,
    string? Reason,
    List<ProductDeletionRequestItemInput>? Items);

public record SubmitProductDeletionRequest(string? Reason);

public record ApproveProductDeletionRequest(string? AdminNote);

public record RejectProductDeletionRequest(string Reason, string? AdminNote);

public record CancelProductDeletionRequest(string Reason, string? AdminNote);
