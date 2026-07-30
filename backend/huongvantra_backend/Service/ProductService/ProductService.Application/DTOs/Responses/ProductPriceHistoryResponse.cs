namespace ProductService.Application.DTOs.Responses;

public sealed record ProductPriceHistoryResponse(
    Guid Id,
    string Type,
    decimal OldValue,
    decimal NewValue,
    decimal? IncomingUnitCost,
    decimal? IncomingQuantity,
    string SourceType,
    Guid? SourceReceiptId,
    string? SourceReceiptCode,
    string? ChangedBy,
    DateTime ChangedAt,
    bool? WasApplied,
    string? ProcessingResult,
    DateTime? SourceApprovedAt,
    DateTime? UpdatedAt);
