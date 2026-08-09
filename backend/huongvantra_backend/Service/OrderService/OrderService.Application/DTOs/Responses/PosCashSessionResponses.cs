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
    DateTime? ClosedAt,
    Guid? OpenedByUserId = null,
    DateTime? ShiftEndsAtUtc = null);

/// <summary>
/// RequiresCloseForNewShift: quỹ Open do người khác mở — Sale không đóng hộ.
/// CanCloseSession: false với Sale ca sau; true với người mở / Manager.
/// </summary>
public record CurrentPosCashSessionResponse(
    PosCashSessionResponse? Session,
    bool RequiresCloseForNewShift = false,
    string? PreviousShiftLabel = null,
    bool CanCloseSession = true,
    string? CloseBlockedMessage = null);
