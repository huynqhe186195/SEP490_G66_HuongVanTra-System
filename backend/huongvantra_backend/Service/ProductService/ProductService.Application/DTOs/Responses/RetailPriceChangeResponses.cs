namespace ProductService.Application.DTOs.Responses;

public record RetailPriceChangeRequestResponse(
    Guid Id,
    string RequestCode,
    string Status,
    Guid SkuId,
    string SkuCode,
    string ProductName,
    string VariantName,
    decimal CurrentRetailPrice,
    decimal RequestedRetailPrice,
    decimal? AverageCostPriceAtRequest,
    string? Reason,
    Guid? CreatedBy,
    string? CreatedByName,
    string? CreatedByRoleName,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    Guid? ReviewedBy,
    string? ReviewedByName,
    string? ReviewedByRoleName,
    DateTime? ReviewedAt,
    string? AdminNote,
    string? RejectReason,
    decimal? AppliedRetailPrice,
    DateTime? AppliedAt);

public record NotificationResponse(
    Guid Id,
    string Type,
    string Title,
    string Body,
    string? Link,
    Guid? ReferenceId,
    string? ReferenceType,
    bool IsRead,
    DateTime? ReadAt,
    DateTime CreatedAt);

public record NotificationSummaryResponse(int UnreadCount);
