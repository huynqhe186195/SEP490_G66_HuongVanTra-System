using UserService.Domain.Entities;
using UserService.Domain.Enums;

namespace UserService.Application.Interfaces;

public interface IShiftRepository
{
    Task<IReadOnlyList<ShiftTemplate>> GetActiveTemplatesAsync(ShiftArea? area = null);
    Task<ShiftTemplate?> GetTemplateByIdAsync(Guid id);
    void UpdateTemplate(ShiftTemplate template);
    Task EnsureWeekSlotsAsync(IEnumerable<ShiftTemplate> templates, DateOnly weekStart, DateOnly weekEnd);
    Task<IReadOnlyList<ShiftSlot>> GetSlotsForWeekAsync(IEnumerable<Guid> templateIds, DateOnly weekStart, DateOnly weekEnd);
    Task<ShiftSlot?> GetSlotByIdAsync(Guid id);
    Task<int> CountApprovedRegistrationsAsync(Guid slotId);
    Task<IReadOnlyList<ShiftRegistration>> GetActiveRegistrationsForSlotAsync(Guid slotId);
    Task<ShiftRegistration?> GetRegistrationByIdAsync(Guid id);
    Task<ShiftRegistration?> GetRegistrationAsync(Guid slotId, Guid userId);
    /// <summary>Đăng ký Pending của user trong tuần, tùy lọc theo khu vực template.</summary>
    Task<IReadOnlyList<ShiftRegistration>> GetPendingRegistrationsForUserInWeekAsync(
        Guid userId,
        DateOnly weekStart,
        DateOnly weekEnd,
        ShiftArea? area = null);
    Task<IReadOnlyList<ShiftRegistration>> GetApprovedForUserOnDateAsync(Guid userId, DateOnly workDate);
    Task<int> CountApprovedForUserInWeekAsync(
        Guid userId,
        DateOnly weekStart,
        DateOnly weekEnd,
        DateOnly? fromDateInclusive = null);

    Task<ShiftRegistrationWindow?> GetRegistrationWindowByWeekAsync(DateOnly weekStart);
    Task<ShiftRegistrationWindow?> GetRegistrationWindowByIdAsync(Guid id);
    Task<IReadOnlyList<ShiftRegistrationWindow>> GetOpenRegistrationWindowsAsync(DateTime utcNow);
    Task AddRegistrationWindowAsync(ShiftRegistrationWindow window);
    void UpdateRegistrationWindow(ShiftRegistrationWindow window);

    Task AddRegistrationAsync(ShiftRegistration registration);
    void UpdateRegistration(ShiftRegistration registration);
    Task SaveChangesAsync();
}
