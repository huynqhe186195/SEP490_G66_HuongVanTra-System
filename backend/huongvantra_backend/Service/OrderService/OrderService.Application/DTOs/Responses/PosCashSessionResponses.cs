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

/// <summary>
/// Phiên quỹ hiện tại. Khi RequiresCloseForNewShift = true, Session vẫn là quỹ Open
/// của ca trước — phải đóng trước khi mở quỹ cho ca đang on-duty.
/// </summary>
public record CurrentPosCashSessionResponse(
    PosCashSessionResponse? Session,
    bool RequiresCloseForNewShift = false,
    string? PreviousShiftLabel = null);
