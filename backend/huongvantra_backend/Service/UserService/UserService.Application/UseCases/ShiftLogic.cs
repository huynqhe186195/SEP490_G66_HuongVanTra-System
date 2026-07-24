using System.Globalization;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Domain.Constants;
using UserService.Domain.Entities;
using UserService.Domain.Enums;
using UserService.Domain.Exceptions;

namespace UserService.Application.UseCases;

public class ShiftLogic(
    IShiftRepository shiftRepo,
    IUserRepository userRepo,
    IEmployeeRepository employeeRepo)
{
    /// <summary>
    /// Map vai trò chính của nhân viên sang khu vực làm việc để tự động lọc lịch ca
    /// cho nhân viên không có quyền MANAGE_EMPLOYEE.
    /// </summary>
    private static readonly Dictionary<string, ShiftArea> RoleAreaMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["SalePos"] = ShiftArea.Shelf,
        ["SaleCod"] = ShiftArea.Shelf,
        ["Sale"] = ShiftArea.Shelf,
        ["Warehouse"] = ShiftArea.Warehouse,
    };

    public async Task<IReadOnlyList<ShiftTemplateResponse>> GetTemplatesAsync(
        string? area,
        IReadOnlyList<string> actorPermissions,
        Guid actorUserId)
    {
        var filterArea = await ResolveAreaFilterAsync(area, actorPermissions, actorUserId);
        var templates = await shiftRepo.GetActiveTemplatesAsync(filterArea);
        return templates.Select(MapTemplate).ToList();
    }

    public async Task<ShiftWeekResponse> GetWeekAsync(
        string weekStart,
        string? area,
        IReadOnlyList<string> actorPermissions,
        Guid actorUserId)
    {
        var requestedStart = ParseDate(weekStart, "weekStart");
        var mondayStart = ToMonday(requestedStart);
        var weekEnd = mondayStart.AddDays(6);

        var filterArea = await ResolveAreaFilterAsync(area, actorPermissions, actorUserId);
        var templates = await shiftRepo.GetActiveTemplatesAsync(filterArea);

        if (templates.Count == 0)
            return new ShiftWeekResponse(FormatDate(mondayStart), FormatDate(weekEnd), [], []);

        await shiftRepo.EnsureWeekSlotsAsync(templates, mondayStart, weekEnd);

        var templateIds = templates.Select(t => t.Id).ToList();
        var slots = await shiftRepo.GetSlotsForWeekAsync(templateIds, mondayStart, weekEnd);

        return new ShiftWeekResponse(
            FormatDate(mondayStart),
            FormatDate(weekEnd),
            templates.Select(MapTemplate).ToList(),
            slots.Select(MapSlot).ToList());
    }

    public async Task<ShiftAssignmentResponse> RegisterAsync(Guid slotId, Guid actorUserId)
    {
        var slot = await shiftRepo.GetSlotByIdAsync(slotId) ?? throw new ShiftSlotNotFoundException(slotId);

        if (slot.Status != ShiftSlotStatus.Open)
            throw new UserValidationException("Ca làm việc đã đóng, không thể đăng ký.");

        if (slot.WorkDate < VnToday())
            throw new UserValidationException("Không thể đăng ký ca đã diễn ra trong quá khứ.");

        var existing = await shiftRepo.GetRegistrationAsync(slotId, actorUserId);
        if (existing is not null)
            throw new UserValidationException("Bạn đã đăng ký ca làm việc này rồi.");

        var approvedCount = await shiftRepo.CountApprovedRegistrationsAsync(slotId);
        if (approvedCount >= slot.Template.Capacity)
            throw new UserValidationException("Ca làm việc đã đủ số lượng nhân viên.");

        var employee = await employeeRepo.GetByUserIdAsync(actorUserId)
            ?? throw new UserValidationException("Không tìm thấy hồ sơ nhân viên của tài khoản hiện tại.");

        var actorUser = await userRepo.GetByIdAsync(actorUserId);
        var roleName = GetPrimaryRoleName(actorUser) ?? "N/A";

        var registration = new ShiftRegistration
        {
            Id = Guid.NewGuid(),
            SlotId = slotId,
            UserId = actorUserId,
            StaffName = employee.FullName,
            RoleName = roleName,
            Status = ShiftRegistrationStatus.Pending,
            RegisteredAt = DateTime.UtcNow
        };

        await shiftRepo.AddRegistrationAsync(registration);
        await shiftRepo.SaveChangesAsync();

        return MapAssignment(registration);
    }

    public async Task ApproveAsync(Guid registrationId, Guid actorUserId)
    {
        var registration = await shiftRepo.GetRegistrationByIdAsync(registrationId)
            ?? throw new ShiftRegistrationNotFoundException(registrationId);

        if (registration.Status != ShiftRegistrationStatus.Pending)
            throw new UserValidationException("Đăng ký ca làm việc này đã được xử lý.");

        var approvedCount = await shiftRepo.CountApprovedRegistrationsAsync(registration.SlotId);
        if (approvedCount >= registration.Slot.Template.Capacity)
            throw new UserValidationException("Ca làm việc đã đủ số lượng nhân viên, không thể duyệt thêm.");

        registration.Status = ShiftRegistrationStatus.Approved;
        registration.ReviewedAt = DateTime.UtcNow;
        registration.ReviewedByUserId = actorUserId;

        shiftRepo.UpdateRegistration(registration);
        await shiftRepo.SaveChangesAsync();
    }

    public async Task RejectAsync(Guid registrationId, Guid actorUserId)
    {
        var registration = await shiftRepo.GetRegistrationByIdAsync(registrationId)
            ?? throw new ShiftRegistrationNotFoundException(registrationId);

        if (registration.Status != ShiftRegistrationStatus.Pending)
            throw new UserValidationException("Đăng ký ca làm việc này đã được xử lý.");

        registration.Status = ShiftRegistrationStatus.Rejected;
        registration.ReviewedAt = DateTime.UtcNow;
        registration.ReviewedByUserId = actorUserId;

        shiftRepo.UpdateRegistration(registration);
        await shiftRepo.SaveChangesAsync();
    }

    /// <summary>
    /// Ca đã duyệt của user đang trong khung giờ (± graceMinutes). Dùng để mở ca quỹ POS / kiểm kê.
    /// </summary>
    public async Task<OnDutyShiftResponse?> GetOnDutyAsync(
        Guid actorUserId,
        string? area = null,
        int graceMinutes = 30)
    {
        var filterArea = ParseAreaOrNull(area);
        var today = VnToday();
        var nowVn = DateTime.UtcNow.AddHours(7);
        var nowTime = nowVn.TimeOfDay;
        var grace = TimeSpan.FromMinutes(Math.Clamp(graceMinutes, 0, 120));

        var approved = await shiftRepo.GetApprovedForUserOnDateAsync(actorUserId, today);
        var match = approved
            .Where(r => r.Slot?.Template is not null)
            .Where(r => filterArea is null || r.Slot.Template.Area == filterArea)
            .Where(r =>
            {
                var start = r.Slot.Template.StartTime - grace;
                var end = r.Slot.Template.EndTime + grace;
                return nowTime >= start && nowTime <= end;
            })
            .OrderBy(r => r.Slot.Template.StartTime)
            .FirstOrDefault();

        if (match is null) return null;

        var tpl = match.Slot.Template;
        return new OnDutyShiftResponse(
            match.SlotId,
            tpl.Id,
            tpl.Name,
            tpl.Area.ToString(),
            AreaLabel(tpl.Area),
            FormatDate(match.Slot.WorkDate),
            FormatTime(tpl.StartTime),
            FormatTime(tpl.EndTime),
            $"{tpl.Name} · {FormatTime(tpl.StartTime)}–{FormatTime(tpl.EndTime)}");
    }

    private async Task<ShiftArea?> ResolveAreaFilterAsync(
        string? area,
        IReadOnlyList<string> actorPermissions,
        Guid actorUserId)
    {
        if (HasManageEmployee(actorPermissions))
            return ParseAreaOrNull(area);

        var actor = await userRepo.GetByIdAsync(actorUserId);
        return ResolveStaffArea(actor);
    }

    private static bool HasManageEmployee(IReadOnlyList<string> permissions) =>
        permissions.Contains(PermissionNames.ManageEmployee, StringComparer.Ordinal);

    private static ShiftArea? ResolveStaffArea(User? user)
    {
        var roleNames = user?.UserRoles?
            .Select(ur => ur.Role?.RoleName)
            .Where(name => !string.IsNullOrWhiteSpace(name)) ?? Enumerable.Empty<string?>();

        foreach (var roleName in roleNames)
        {
            if (roleName is not null && RoleAreaMap.TryGetValue(roleName, out var mappedArea))
                return mappedArea;
        }

        return null;
    }

    private static string? GetPrimaryRoleName(User? user) =>
        user?.UserRoles?
            .Select(ur => ur.Role?.RoleName)
            .FirstOrDefault(name => !string.IsNullOrWhiteSpace(name));

    private static ShiftArea? ParseAreaOrNull(string? area) =>
        !string.IsNullOrWhiteSpace(area) && Enum.TryParse<ShiftArea>(area, true, out var parsed)
            ? parsed
            : null;

    private static DateOnly ParseDate(string value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value) ||
            !DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            throw new UserValidationException($"{fieldName} không hợp lệ. Định dạng yêu cầu: YYYY-MM-DD.");

        return parsed;
    }

    private static DateOnly ToMonday(DateOnly date)
    {
        var diff = ((int)date.DayOfWeek + 6) % 7; // Monday = 0 ... Sunday = 6
        return date.AddDays(-diff);
    }

    private static DateOnly VnToday() => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

    private static string FormatDate(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static string FormatTime(TimeSpan time) => time.ToString(@"hh\:mm", CultureInfo.InvariantCulture);

    private static string AreaLabel(ShiftArea area) => area switch
    {
        ShiftArea.Shelf => "Quầy",
        ShiftArea.Warehouse => "Kho",
        _ => area.ToString()
    };

    private static ShiftTemplateResponse MapTemplate(ShiftTemplate template) => new(
        template.Id,
        template.Name,
        template.Area.ToString(),
        AreaLabel(template.Area),
        FormatTime(template.StartTime),
        FormatTime(template.EndTime),
        template.Capacity,
        template.Color);

    private static ShiftSlotResponse MapSlot(ShiftSlot slot) => new(
        slot.Id,
        slot.TemplateId,
        FormatDate(slot.WorkDate),
        slot.Status.ToString(),
        slot.Registrations
            .Where(r => !r.IsDeleted)
            .OrderBy(r => r.RegisteredAt)
            .Select(MapAssignment)
            .ToList());

    private static ShiftAssignmentResponse MapAssignment(ShiftRegistration registration) => new(
        registration.Id,
        registration.UserId.ToString(),
        registration.StaffName,
        registration.RoleName,
        registration.Status.ToString());
}
