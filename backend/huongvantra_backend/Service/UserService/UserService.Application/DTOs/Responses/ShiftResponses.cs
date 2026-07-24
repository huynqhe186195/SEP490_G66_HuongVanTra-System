namespace UserService.Application.DTOs.Responses;

public record ShiftTemplateResponse(
    Guid Id,
    string Name,
    string Area,
    string AreaLabel,
    string Start,
    string End,
    int Capacity,
    string Color);

public record ShiftAssignmentResponse(
    Guid Id,
    string StaffId,
    string Name,
    string Role,
    string Status);

public record ShiftSlotResponse(
    Guid Id,
    Guid TemplateId,
    string WorkDate,
    string Status,
    List<ShiftAssignmentResponse> Assignments);

public record ShiftWeekResponse(
    string WeekStart,
    string WeekEnd,
    List<ShiftTemplateResponse> Templates,
    List<ShiftSlotResponse> Slots);

public record ShiftRegistrationWindowResponse(
    Guid Id,
    string WeekStart,
    string WeekEnd,
    string OpensAt,
    string ClosesAt,
    bool IsManuallyClosed,
    bool IsOpenNow,
    string Status);

/// <summary>Trạng thái đăng ký ca tuần hiện tại — dùng để chặn app nếu Sale chưa có ca duyệt.</summary>
public record ShiftWeekStatusResponse(
    string WeekStart,
    string WeekEnd,
    bool CanRegisterNow,
    bool HasApprovedShiftThisWeek,
    bool AllowMyShiftsOnly,
    bool HardBlocked,
    ShiftRegistrationWindowResponse? ActiveWindow,
    ShiftRegistrationWindowResponse? CurrentWeekWindow,
    string? Message);

/// <summary>Nhân viên Sale (SalePos/SaleCod/Sale) khả dụng để Manager chỉ định vào ca.</summary>
public record ShiftStaffOptionResponse(
    Guid UserId,
    string FullName,
    string RoleName);

/// <summary>Ca đã duyệt đang trong khung giờ làm việc của user hiện tại.</summary>
public record OnDutyShiftResponse(
    Guid SlotId,
    Guid TemplateId,
    string TemplateName,
    string Area,
    string AreaLabel,
    string WorkDate,
    string Start,
    string End,
    string Label);
