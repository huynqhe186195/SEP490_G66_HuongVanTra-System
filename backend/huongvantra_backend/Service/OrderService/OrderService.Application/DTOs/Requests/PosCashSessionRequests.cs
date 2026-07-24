namespace OrderService.Application.DTOs.Requests;

public record OpenPosCashSessionRequest(
    decimal OpeningCash,
    string? Note = null,
    Guid? ShiftSlotId = null,
    string? ShiftLabel = null,
    string? OpenedByName = null,
    string? OpenedByRole = null);

public record ClosePosCashSessionRequest(
    decimal CountedCash,
    string? VarianceNote = null);
