namespace ProductService.Application.DTOs.Requests;

public record GetProductCreationRequestsRequest(
    string? Status,
    string? Search,
    bool MineOnly = false,
    int Page = 1,
    int PageSize = 20);

public record ProductCreationRequestItemInput(
    string? ClientKey,
    CreateProductRequest Product);

public record CreateProductCreationRequest(
    string? Title,
    string? WarehouseNote,
    List<ProductCreationRequestItemInput>? Items);

public record UpdateProductCreationRequest(
    string? Title,
    string? WarehouseNote,
    List<ProductCreationRequestItemInput>? Items);

public record SubmitProductCreationRequest(string? WarehouseNote);

public record ApproveProductCreationRequest(string? AdminNote);

public record RejectProductCreationRequest(string Reason, string? AdminNote);

public record CancelProductCreationRequest(string Reason, string? AdminNote);
