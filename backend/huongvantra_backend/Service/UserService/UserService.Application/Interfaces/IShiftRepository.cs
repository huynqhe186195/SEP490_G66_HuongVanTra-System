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
    Task AddRegistrationAsync(ShiftRegistration registration);
    void UpdateRegistration(ShiftRegistration registration);
    Task SaveChangesAsync();
}
