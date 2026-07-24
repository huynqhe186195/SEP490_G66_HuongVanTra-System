namespace OrderService.Application.DTOs.Responses;

public record PosCashSessionResponse(
    Guid Id,
    string Status,
    decimal OpeningCash,
    decimal CashSalesTotal,
    decimal CashRefundTotal,
    int OrderCount,
    string? Note,
    string OpenedByName,
    string? OpenedByRole,
    string? ShiftLabel,
    Guid? ShiftSlotId,
    DateTime OpenedAt,
    DateTime UpdatedAt,
    decimal? CountedCash,
    decimal? ExpectedCash,
    decimal? Variance,
    string? VarianceNote,
    string? ClosedByName,
    DateTime? ClosedAt);

public record CurrentPosCashSessionResponse(PosCashSessionResponse? Session);
