using UserService.Domain.Entities;
using UserService.Domain.Enums;

namespace UserService.Application.Interfaces;

public interface IShiftRepository
{
    Task<IReadOnlyList<ShiftTemplate>> GetActiveTemplatesAsync(ShiftArea? area = null);
    Task EnsureWeekSlotsAsync(IEnumerable<ShiftTemplate> templates, DateOnly weekStart, DateOnly weekEnd);
    Task<IReadOnlyList<ShiftSlot>> GetSlotsForWeekAsync(IEnumerable<Guid> templateIds, DateOnly weekStart, DateOnly weekEnd);
    Task<ShiftSlot?> GetSlotByIdAsync(Guid id);
    Task<int> CountApprovedRegistrationsAsync(Guid slotId);
    Task<ShiftRegistration?> GetRegistrationByIdAsync(Guid id);
    Task<ShiftRegistration?> GetRegistrationAsync(Guid slotId, Guid userId);
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
