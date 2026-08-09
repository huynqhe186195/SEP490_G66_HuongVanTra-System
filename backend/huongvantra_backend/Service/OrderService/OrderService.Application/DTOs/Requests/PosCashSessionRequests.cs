namespace OrderService.Application.DTOs.Requests;

public record OpenPosCashSessionRequest(
    decimal OpeningCash,
    string? Note = null,
    Guid? ShiftSlotId = null,
    string? ShiftLabel = null,
    string? OpenedByName = null,
    string? OpenedByRole = null,
    /// <summary>Ngày làm việc VN (yyyy-MM-dd) — Manager mở quỹ từ Lịch ca.</summary>
    string? WorkDate = null,
    /// <summary>Giờ kết thúc ca HH:mm — dùng tính ShiftEndsAtUtc khi không có on-duty.</summary>
    string? ShiftEnd = null);

public record ClosePosCashSessionRequest(
    decimal CountedCash,
    string? VarianceNote = null,
    /// <summary>Manager đóng từ Lịch: phải khớp ô ca đang chọn (tránh đóng nhầm ca).</summary>
    Guid? ExpectedShiftSlotId = null);
