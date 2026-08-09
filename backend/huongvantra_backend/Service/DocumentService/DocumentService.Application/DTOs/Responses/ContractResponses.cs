namespace DocumentService.Application.DTOs.Responses;

public record ContractLineItemResponse(
    Guid Id,
    int LineNumber,
    Guid SkuId,
    string SkuCode,
    string ProductName,
    string? Unit,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineAmount,
    string? Note);

public record ContractResponse(
    Guid Id,
    string ContractCode,
    Guid CustomerId,
    string CustomerName,
    string CustomerCode,
    Guid CreatedByUserId,
    string Title,
    string ContractType,
    string Status,
    DateOnly? EffectiveDate,
    DateOnly? ExpiryDate,
    decimal? DiscountPercent,
    decimal? CreditLimit,
    int? PaymentTermDays,
    string? Notes,
    string? RejectionNote,
    DateTime? SubmittedAt,
    DateTime? ReviewedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string? SignedAtLocation = null,
    string? PaymentMethod = null,
    string? DeliveryTerms = null,
    string? ShippingResponsibility = null,
    List<ContractLineItemResponse>? LineItems = null);

public record ContractPagedResponse(
    List<ContractResponse> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);

