namespace UserService.Application.DTOs.Requests;

/// <summary>Manager/Admin chỉ định một nhân viên Sale vào ca làm việc.</summary>
public record AssignShiftRequest(Guid UserId);

/// <summary>
/// Manager mở / cập nhật cửa sổ đăng ký ca cho một tuần.
/// OpensAt / ClosesAt: ISO-8601 (ưu tiên có offset; nếu không có thì hiểu theo giờ VN +07:00).
/// </summary>
public record UpsertShiftRegistrationWindowRequest(
    string WeekStart,
    string OpensAt,
    string ClosesAt);

/// <summary>Manager chỉnh giờ khung ca (Start/End dạng HH:mm, cùng ngày).</summary>
public record UpdateShiftTemplateHoursRequest(string Start, string End);

/// <summary>
/// Duyệt / từ chối tất cả đăng ký Pending của một nhân viên trong tuần.
/// Action: Approve | Reject. Area tùy chọn (Shelf / Warehouse).
/// </summary>
public record BulkReviewShiftByUserRequest(
    Guid UserId,
    string WeekStart,
    string Action,
    string? Area = null);

/// <summary>Sale đăng ký nhiều ô ca cùng lúc (tối đa 20).</summary>
public record BulkRegisterShiftSlotsRequest(IReadOnlyList<Guid> SlotIds);
