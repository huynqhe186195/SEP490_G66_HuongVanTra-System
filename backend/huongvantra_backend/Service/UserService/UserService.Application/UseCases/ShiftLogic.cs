using System.Globalization;
using UserService.Application.Authorization;
using UserService.Application.DTOs.Requests;
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
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

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

    /// <summary>
    /// Manager chỉnh giờ bắt đầu / kết thúc khung ca. Áp dụng ngay cho kiểm tra on-duty (đúng giờ ca).
    /// </summary>
    public async Task<ShiftTemplateResponse> UpdateTemplateHoursAsync(
        Guid templateId,
        UpdateShiftTemplateHoursRequest request)
    {
        var template = await shiftRepo.GetTemplateByIdAsync(templateId)
            ?? throw new ShiftTemplateNotFoundException(templateId);

        if (!template.IsActive)
            throw new UserValidationException("Khung ca đã ngừng dùng, không thể chỉnh giờ.");

        var start = ParseTimeOfDay(request.Start, "start");
        var end = ParseTimeOfDay(request.End, "end");

        if (end <= start)
            throw new UserValidationException("Giờ kết thúc phải sau giờ bắt đầu (cùng ngày).");

        var duration = end - start;
        if (duration < TimeSpan.FromMinutes(30))
            throw new UserValidationException("Mỗi ca phải dài tối thiểu 30 phút.");

        template.StartTime = start;
        template.EndTime = end;
        shiftRepo.UpdateTemplate(template);
        await shiftRepo.SaveChangesAsync();

        return MapTemplate(template);
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

    /// <summary>
    /// Trạng thái đăng ký ca tuần hiện tại — FE chặn app (hard block / chỉ Ca của tôi) theo cửa sổ Manager mở.
    /// </summary>
    public async Task<ShiftWeekStatusResponse> GetMyWeekStatusAsync(Guid userId)
    {
        var today = VnToday();
        var monday = ToMonday(today);
        var weekEnd = monday.AddDays(6);
        var nowUtc = DateTime.UtcNow;

        // Chỉ tính ca còn hiệu lực từ hôm nay — ca đã qua không giữ quyền mở app cả tuần.
        var hasApproved = await shiftRepo.CountApprovedForUserInWeekAsync(userId, monday, weekEnd, today) > 0;
        var openWindows = await shiftRepo.GetOpenRegistrationWindowsAsync(nowUtc);
        var activeWindow = openWindows.FirstOrDefault();
        var currentWeekWindowEntity = await shiftRepo.GetRegistrationWindowByWeekAsync(monday);

        var canRegisterNow = activeWindow is not null;
        var allowMyShiftsOnly = !hasApproved && canRegisterNow;
        var hardBlocked = !hasApproved && !canRegisterNow;

        string? message;
        if (hasApproved)
        {
            message = "Bạn đã có ca được duyệt cho tuần này.";
        }
        else if (canRegisterNow && activeWindow is not null)
        {
            message =
                $"Manager đang mở đăng ký ca tuần {FormatDate(activeWindow.WeekStart)} – {FormatDate(activeWindow.WeekStart.AddDays(6))}. Vào «Ca của tôi» để đăng ký trước hạn.";
        }
        else
        {
            message =
                "Bạn chưa có ca duyệt tuần này và hiện không trong thời hạn đăng ký. Chờ Manager mở đăng ký hoặc chỉ định bạn vào ca.";
        }

        return new ShiftWeekStatusResponse(
            FormatDate(monday),
            FormatDate(weekEnd),
            canRegisterNow,
            hasApproved,
            allowMyShiftsOnly,
            hardBlocked,
            activeWindow is null ? null : MapWindow(activeWindow, nowUtc),
            currentWeekWindowEntity is null ? null : MapWindow(currentWeekWindowEntity, nowUtc),
            message);
    }

    public async Task<ShiftRegistrationWindowResponse?> GetRegistrationWindowAsync(string weekStart)
    {
        var monday = ToMonday(ParseDate(weekStart, "weekStart"));
        var window = await shiftRepo.GetRegistrationWindowByWeekAsync(monday);
        return window is null ? null : MapWindow(window, DateTime.UtcNow);
    }

    /// <summary>Manager mở hoặc cập nhật cửa sổ đăng ký cho một tuần làm việc.</summary>
    public async Task<ShiftRegistrationWindowResponse> UpsertRegistrationWindowAsync(
        UpsertShiftRegistrationWindowRequest request,
        Guid actorUserId)
    {
        var monday = ToMonday(ParseDate(request.WeekStart, "weekStart"));
        var opensAt = ParseDateTimeToUtc(request.OpensAt, "opensAt");
        var closesAt = ParseDateTimeToUtc(request.ClosesAt, "closesAt");

        if (closesAt <= opensAt)
            throw new UserValidationException("Thời hạn đóng phải sau thời điểm mở đăng ký.");

        var existing = await shiftRepo.GetRegistrationWindowByWeekAsync(monday);
        if (existing is null)
        {
            existing = new ShiftRegistrationWindow
            {
                Id = Guid.NewGuid(),
                WeekStart = monday,
                OpensAt = opensAt,
                ClosesAt = closesAt,
                IsManuallyClosed = false,
                OpenedByUserId = actorUserId,
                ClosedByUserId = null,
                ClosedAt = null,
                CreatedAt = DateTime.UtcNow
            };
            await shiftRepo.AddRegistrationWindowAsync(existing);
        }
        else
        {
            existing.OpensAt = opensAt;
            existing.ClosesAt = closesAt;
            existing.IsManuallyClosed = false;
            existing.OpenedByUserId = actorUserId;
            existing.ClosedByUserId = null;
            existing.ClosedAt = null;
            shiftRepo.UpdateRegistrationWindow(existing);
        }

        await shiftRepo.SaveChangesAsync();
        return MapWindow(existing, DateTime.UtcNow);
    }

    public async Task<ShiftRegistrationWindowResponse> CloseRegistrationWindowAsync(Guid windowId, Guid actorUserId)
    {
        var window = await shiftRepo.GetRegistrationWindowByIdAsync(windowId)
            ?? throw new UserValidationException("Không tìm thấy cửa sổ đăng ký ca.");

        window.IsManuallyClosed = true;
        window.ClosedByUserId = actorUserId;
        window.ClosedAt = DateTime.UtcNow;
        shiftRepo.UpdateRegistrationWindow(window);
        await shiftRepo.SaveChangesAsync();
        return MapWindow(window, DateTime.UtcNow);
    }

    public async Task<ShiftRegistrationWindowResponse> ReopenRegistrationWindowAsync(Guid windowId, Guid actorUserId)
    {
        var window = await shiftRepo.GetRegistrationWindowByIdAsync(windowId)
            ?? throw new UserValidationException("Không tìm thấy cửa sổ đăng ký ca.");

        if (window.ClosesAt < DateTime.UtcNow)
            throw new UserValidationException("Hạn đăng ký đã hết — hãy cập nhật thời hạn trước khi mở lại.");

        window.IsManuallyClosed = false;
        window.OpenedByUserId = actorUserId;
        window.ClosedByUserId = null;
        window.ClosedAt = null;
        shiftRepo.UpdateRegistrationWindow(window);
        await shiftRepo.SaveChangesAsync();
        return MapWindow(window, DateTime.UtcNow);
    }

    public async Task<ShiftAssignmentResponse> RegisterAsync(Guid slotId, Guid actorUserId)
    {
        var today = VnToday();
        var nowUtc = DateTime.UtcNow;

        var slot = await shiftRepo.GetSlotByIdAsync(slotId) ?? throw new ShiftSlotNotFoundException(slotId);

        if (slot.Status != ShiftSlotStatus.Open)
            throw new UserValidationException("Ca làm việc đã đóng, không thể đăng ký.");

        if (slot.WorkDate < today)
            throw new UserValidationException("Không thể đăng ký ca đã diễn ra trong quá khứ.");

        var weekMonday = ToMonday(slot.WorkDate);
        var window = await shiftRepo.GetRegistrationWindowByWeekAsync(weekMonday);
        if (window is null || !IsWindowOpenNow(window, nowUtc))
            throw new UserValidationException("Hiện không trong thời hạn đăng ký ca do Manager mở cho tuần này.");

        var existing = await shiftRepo.GetRegistrationAsync(slotId, actorUserId);
        if (existing is not null && !existing.IsDeleted)
            throw new UserValidationException("Bạn đã đăng ký ca làm việc này rồi.");

        var approvedCount = await shiftRepo.CountApprovedRegistrationsAsync(slotId);
        if (approvedCount >= slot.Template.Capacity)
            throw new UserValidationException("Ca làm việc đã đủ số lượng nhân viên.");

        var employee = await employeeRepo.GetByUserIdAsync(actorUserId)
            ?? throw new UserValidationException("Không tìm thấy hồ sơ nhân viên của tài khoản hiện tại.");

        var actorUser = await userRepo.GetByIdAsync(actorUserId);
        var roleName = GetPrimaryRoleName(actorUser) ?? "N/A";

        if (existing is not null && existing.IsDeleted)
        {
            existing.IsDeleted = false;
            existing.StaffName = employee.FullName;
            existing.RoleName = roleName;
            existing.Status = ShiftRegistrationStatus.Pending;
            existing.RegisteredAt = DateTime.UtcNow;
            existing.ReviewedAt = null;
            existing.ReviewedByUserId = null;
            shiftRepo.UpdateRegistration(existing);
            await shiftRepo.SaveChangesAsync();
            return MapAssignment(existing);
        }

        var now = DateTime.UtcNow;
        var registration = new ShiftRegistration
        {
            Id = Guid.NewGuid(),
            SlotId = slotId,
            UserId = actorUserId,
            StaffName = employee.FullName,
            RoleName = roleName,
            Status = ShiftRegistrationStatus.Pending,
            RegisteredAt = now,
            ReviewedAt = null,
            ReviewedByUserId = null
        };

        await shiftRepo.AddRegistrationAsync(registration);
        await shiftRepo.SaveChangesAsync();

        return MapAssignment(registration);
    }

    /// <summary>
    /// Manager chỉ định trực tiếp một Sale vào ca — Approved ngay.
    /// Không phụ thuộc cửa sổ đăng ký (để vận hành / test mọi ngày).
    /// </summary>
    public async Task<ShiftAssignmentResponse> AssignAsync(
        Guid slotId,
        Guid staffUserId,
        Guid actorUserId,
        IReadOnlyList<string> actorPermissions)
    {
        _ = actorPermissions;
        var today = VnToday();

        var slot = await shiftRepo.GetSlotByIdAsync(slotId) ?? throw new ShiftSlotNotFoundException(slotId);

        if (slot.Status != ShiftSlotStatus.Open)
            throw new UserValidationException("Ca làm việc đã đóng, không thể chỉ định.");

        if (slot.WorkDate < today)
            throw new UserValidationException("Không thể chỉ định ca đã diễn ra trong quá khứ.");

        var staffEmployee = await employeeRepo.GetByUserIdAsync(staffUserId)
            ?? throw new UserValidationException("Không tìm thấy hồ sơ nhân viên của tài khoản được chọn.");

        var staffUser = await userRepo.GetByIdAsync(staffUserId);
        var roleName = GetPrimaryRoleName(staffUser);
        if (roleName is null || !StaffManagementScope.IsSaleRole(roleName))
            throw new UserValidationException("Chỉ được chỉ định nhân viên Sale (SalePos/SaleCod) vào ca làm việc.");

        var approvedCount = await shiftRepo.CountApprovedRegistrationsAsync(slotId);
        var existing = await shiftRepo.GetRegistrationAsync(slotId, staffUserId);

        if (existing is not null)
        {
            if (!existing.IsDeleted && existing.Status == ShiftRegistrationStatus.Approved)
                throw new UserValidationException("Nhân viên này đã được chỉ định vào ca làm việc này rồi.");

            if (approvedCount >= slot.Template.Capacity)
                throw new UserValidationException("Ca làm việc đã đủ số lượng nhân viên.");

            existing.IsDeleted = false;
            existing.Status = ShiftRegistrationStatus.Approved;
            existing.StaffName = staffEmployee.FullName;
            existing.RoleName = roleName;
            existing.ReviewedAt = DateTime.UtcNow;
            existing.ReviewedByUserId = actorUserId;

            shiftRepo.UpdateRegistration(existing);
            await shiftRepo.SaveChangesAsync();

            return MapAssignment(existing);
        }

        if (approvedCount >= slot.Template.Capacity)
            throw new UserValidationException("Ca làm việc đã đủ số lượng nhân viên.");

        var now = DateTime.UtcNow;
        var registration = new ShiftRegistration
        {
            Id = Guid.NewGuid(),
            SlotId = slotId,
            UserId = staffUserId,
            StaffName = staffEmployee.FullName,
            RoleName = roleName,
            Status = ShiftRegistrationStatus.Approved,
            RegisteredAt = now,
            ReviewedAt = now,
            ReviewedByUserId = actorUserId
        };

        await shiftRepo.AddRegistrationAsync(registration);
        await shiftRepo.SaveChangesAsync();

        return MapAssignment(registration);
    }

    /// <summary>
    /// Manager gỡ nhân viên khỏi ca (Pending hoặc Approved). Ca đã qua ngày không cho gỡ.
    /// </summary>
    public async Task UnassignAsync(Guid registrationId, Guid actorUserId)
    {
        var registration = await shiftRepo.GetRegistrationByIdAsync(registrationId)
            ?? throw new ShiftRegistrationNotFoundException(registrationId);

        if (registration.Status == ShiftRegistrationStatus.Rejected)
            throw new UserValidationException("Đăng ký này đã bị từ chối, không cần gỡ.");

        var today = VnToday();
        if (registration.Slot.WorkDate < today)
            throw new UserValidationException("Không thể gỡ nhân viên khỏi ca đã diễn ra trong quá khứ.");

        registration.IsDeleted = true;
        registration.ReviewedAt = DateTime.UtcNow;
        registration.ReviewedByUserId = actorUserId;

        shiftRepo.UpdateRegistration(registration);
        await shiftRepo.SaveChangesAsync();
    }

    /// <summary>Danh sách nhân viên Sale (SalePos/SaleCod/Sale) đang hoạt động — dùng cho dropdown chỉ định ca.</summary>
    public async Task<IReadOnlyList<ShiftStaffOptionResponse>> GetAssignableSalesStaffAsync()
    {
        var (employees, _) = await employeeRepo.GetAllAsync(1, int.MaxValue);

        return employees
            .Where(e => e.Status == EmployeeStatus.Active)
            .Select(e => new { Employee = e, RoleName = GetPrimaryRoleName(e.User) })
            .Where(x => x.RoleName is not null && StaffManagementScope.IsSaleRole(x.RoleName))
            .Select(x => new ShiftStaffOptionResponse(x.Employee.UserId, x.Employee.FullName, x.RoleName!))
            .OrderBy(x => x.FullName, StringComparer.OrdinalIgnoreCase)
            .ToList();
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
    /// Ca đã duyệt của user đang trong khung giờ ca (graceMinutes mặc định 0 = đúng giờ bắt đầu–kết thúc).
    /// </summary>
    public async Task<OnDutyShiftResponse?> GetOnDutyAsync(
        Guid actorUserId,
        string? area = null,
        int graceMinutes = 0)
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

    /// <summary>Parse ISO datetime; nếu thiếu offset thì hiểu theo giờ VN (+07).</summary>
    private static DateTime ParseDateTimeToUtc(string value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new UserValidationException($"{fieldName} không được để trống.");

        if (DateTimeOffset.TryParse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out var dto))
            return dto.UtcDateTime;

        if (DateTime.TryParse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeLocal | DateTimeStyles.AllowWhiteSpaces,
                out var localNaive))
        {
            var asVn = DateTime.SpecifyKind(localNaive, DateTimeKind.Unspecified);
            return new DateTimeOffset(asVn, VietnamOffset).UtcDateTime;
        }

        throw new UserValidationException($"{fieldName} không hợp lệ. Dùng ISO-8601 (ví dụ 2026-07-24T08:00:00+07:00).");
    }

    private static bool IsWindowOpenNow(ShiftRegistrationWindow window, DateTime utcNow) =>
        !window.IsDeleted
        && !window.IsManuallyClosed
        && window.OpensAt <= utcNow
        && window.ClosesAt >= utcNow;

    private static string WindowStatus(ShiftRegistrationWindow window, DateTime utcNow)
    {
        if (window.IsManuallyClosed) return "Closed";
        if (utcNow < window.OpensAt) return "Scheduled";
        if (utcNow > window.ClosesAt) return "Expired";
        return "Open";
    }

    private static ShiftRegistrationWindowResponse MapWindow(ShiftRegistrationWindow window, DateTime utcNow) =>
        new(
            window.Id,
            FormatDate(window.WeekStart),
            FormatDate(window.WeekStart.AddDays(6)),
            FormatDateTimeIso(window.OpensAt),
            FormatDateTimeIso(window.ClosesAt),
            window.IsManuallyClosed,
            IsWindowOpenNow(window, utcNow),
            WindowStatus(window, utcNow));

    private static string FormatDateTimeIso(DateTime utc) =>
        new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToOffset(VietnamOffset)
            .ToString("yyyy-MM-dd'T'HH:mm:sszzz", CultureInfo.InvariantCulture);

    private static DateOnly ToMonday(DateOnly date)
    {
        var diff = ((int)date.DayOfWeek + 6) % 7; // Monday = 0 ... Sunday = 6
        return date.AddDays(-diff);
    }

    private static DateOnly VnToday() => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

    private static string FormatDate(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static string FormatTime(TimeSpan time) => time.ToString(@"hh\:mm", CultureInfo.InvariantCulture);

    private static TimeSpan ParseTimeOfDay(string? raw, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(raw))
            throw new UserValidationException($"Thiếu {fieldName} (HH:mm).");

        var value = raw.Trim();
        if (TimeSpan.TryParseExact(value, @"hh\:mm", CultureInfo.InvariantCulture, out var parsed)
            || TimeSpan.TryParseExact(value, @"h\:mm", CultureInfo.InvariantCulture, out parsed)
            || TimeSpan.TryParseExact(value, @"hh\:mm\:ss", CultureInfo.InvariantCulture, out parsed))
        {
            if (parsed < TimeSpan.Zero || parsed >= TimeSpan.FromDays(1))
                throw new UserValidationException($"{fieldName} phải trong khoảng 00:00–23:59.");
            return parsed;
        }

        throw new UserValidationException($"{fieldName} không hợp lệ — dùng định dạng HH:mm (vd: 13:00).");
    }

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
