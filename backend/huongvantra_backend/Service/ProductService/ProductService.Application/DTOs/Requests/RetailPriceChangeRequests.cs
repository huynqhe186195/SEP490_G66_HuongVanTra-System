namespace ProductService.Application.DTOs.Requests;

public record GetRetailPriceChangeRequestsRequest(
    string? Status,
    string? Search,
    bool MineOnly = false,
    int Page = 1,
    int PageSize = 20);

public record CreateRetailPriceChangeRequest(
    Guid SkuId,
    decimal RequestedRetailPrice,
    string? Reason);

public record ApproveRetailPriceChangeRequest(string? AdminNote);

public record RejectRetailPriceChangeRequest(string Reason, string? AdminNote);

public record CancelRetailPriceChangeRequest(string? Reason);

public record GetNotificationsRequest(
    bool UnreadOnly = false,
    int Page = 1,
    int PageSize = 20);
