namespace DocumentService.Application.DTOs.Responses;

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
    DateTime UpdatedAt);

public record ContractPagedResponse(
    List<ContractResponse> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);
