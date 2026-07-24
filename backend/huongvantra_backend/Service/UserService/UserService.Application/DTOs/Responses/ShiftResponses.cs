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
