using Microsoft.EntityFrameworkCore;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Domain.Enums;
using UserService.Infrastructure.Data;

namespace UserService.Infrastructure.Repositories;

public class ShiftRepository(UserDbContext context) : IShiftRepository
{
    public async Task<IReadOnlyList<ShiftTemplate>> GetActiveTemplatesAsync(ShiftArea? area = null)
    {
        var query = context.ShiftTemplates.Where(t => t.IsActive && !t.IsDeleted);
        if (area is not null)
            query = query.Where(t => t.Area == area);

        return await query.OrderBy(t => t.SortOrder).ToListAsync();
    }

    public async Task<ShiftTemplate?> GetTemplateByIdAsync(Guid id) =>
        await context.ShiftTemplates.FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);

    public void UpdateTemplate(ShiftTemplate template)
    {
        template.UpdatedAt = DateTime.UtcNow;
        context.ShiftTemplates.Update(template);
    }

    public async Task EnsureWeekSlotsAsync(IEnumerable<ShiftTemplate> templates, DateOnly weekStart, DateOnly weekEnd)
    {
        var templateIds = templates.Select(t => t.Id).ToList();
        if (templateIds.Count == 0) return;

        var existing = await context.ShiftSlots
            .Where(s => templateIds.Contains(s.TemplateId) && s.WorkDate >= weekStart && s.WorkDate <= weekEnd)
            .Select(s => new { s.TemplateId, s.WorkDate })
            .ToListAsync();

        var existingSet = existing.Select(x => (x.TemplateId, x.WorkDate)).ToHashSet();

        var toAdd = new List<ShiftSlot>();
        for (var date = weekStart; date <= weekEnd; date = date.AddDays(1))
        {
            foreach (var templateId in templateIds)
            {
                if (existingSet.Contains((templateId, date))) continue;
                toAdd.Add(new ShiftSlot
                {
                    Id = Guid.NewGuid(),
                    TemplateId = templateId,
                    WorkDate = date,
                    Status = ShiftSlotStatus.Open
                });
            }
        }

        if (toAdd.Count == 0) return;

        context.ShiftSlots.AddRange(toAdd);
        try
        {
            await context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Race condition on the (TemplateId, WorkDate) unique index — slots were already
            // created by a concurrent request. Detach the failed entities and continue.
            foreach (var slot in toAdd)
                context.Entry(slot).State = EntityState.Detached;
        }
    }

    public async Task<IReadOnlyList<ShiftSlot>> GetSlotsForWeekAsync(IEnumerable<Guid> templateIds, DateOnly weekStart, DateOnly weekEnd)
    {
        var ids = templateIds.ToList();
        return await context.ShiftSlots
            .Include(s => s.Registrations)
            .Where(s => ids.Contains(s.TemplateId) && s.WorkDate >= weekStart && s.WorkDate <= weekEnd && !s.IsDeleted)
            .OrderBy(s => s.WorkDate)
            .ToListAsync();
    }

    public async Task<ShiftSlot?> GetSlotByIdAsync(Guid id) =>
        await context.ShiftSlots
            .Include(s => s.Template)
            .Include(s => s.Registrations)
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

    public async Task<int> CountApprovedRegistrationsAsync(Guid slotId) =>
        await context.ShiftRegistrations.CountAsync(r =>
            r.SlotId == slotId && r.Status == ShiftRegistrationStatus.Approved && !r.IsDeleted);

    public async Task<ShiftRegistration?> GetRegistrationByIdAsync(Guid id) =>
        await context.ShiftRegistrations
            .Include(r => r.Slot)
                .ThenInclude(s => s.Template)
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);

    public async Task<ShiftRegistration?> GetRegistrationAsync(Guid slotId, Guid userId) =>
        await context.ShiftRegistrations
            .FirstOrDefaultAsync(r => r.SlotId == slotId && r.UserId == userId);

    public async Task<IReadOnlyList<ShiftRegistration>> GetApprovedForUserOnDateAsync(Guid userId, DateOnly workDate) =>
        await context.ShiftRegistrations
            .Include(r => r.Slot)
                .ThenInclude(s => s.Template)
            .Where(r =>
                r.UserId == userId
                && r.Status == ShiftRegistrationStatus.Approved
                && !r.IsDeleted
                && r.Slot.WorkDate == workDate
                && !r.Slot.IsDeleted
                && r.Slot.Status == ShiftSlotStatus.Open)
            .ToListAsync();

    public async Task<int> CountApprovedForUserInWeekAsync(
        Guid userId,
        DateOnly weekStart,
        DateOnly weekEnd,
        DateOnly? fromDateInclusive = null)
    {
        var from = fromDateInclusive is null || fromDateInclusive < weekStart
            ? weekStart
            : fromDateInclusive.Value;

        return await context.ShiftRegistrations
            .Include(r => r.Slot)
            .Where(r =>
                r.UserId == userId
                && r.Status == ShiftRegistrationStatus.Approved
                && !r.IsDeleted
                && r.Slot.WorkDate >= from
                && r.Slot.WorkDate <= weekEnd)
            .CountAsync();
    }

    public async Task AddRegistrationAsync(ShiftRegistration registration) =>
        await context.ShiftRegistrations.AddAsync(registration);

    public void UpdateRegistration(ShiftRegistration registration)
    {
        registration.UpdatedAt = DateTime.UtcNow;
        context.ShiftRegistrations.Update(registration);
    }

    public async Task<ShiftRegistrationWindow?> GetRegistrationWindowByWeekAsync(DateOnly weekStart) =>
        await context.ShiftRegistrationWindows
            .FirstOrDefaultAsync(w => w.WeekStart == weekStart && !w.IsDeleted);

    public async Task<ShiftRegistrationWindow?> GetRegistrationWindowByIdAsync(Guid id) =>
        await context.ShiftRegistrationWindows
            .FirstOrDefaultAsync(w => w.Id == id && !w.IsDeleted);

    public async Task<IReadOnlyList<ShiftRegistrationWindow>> GetOpenRegistrationWindowsAsync(DateTime utcNow) =>
        await context.ShiftRegistrationWindows
            .Where(w =>
                !w.IsDeleted
                && !w.IsManuallyClosed
                && w.OpensAt <= utcNow
                && w.ClosesAt >= utcNow)
            .OrderBy(w => w.WeekStart)
            .ToListAsync();

    public async Task AddRegistrationWindowAsync(ShiftRegistrationWindow window) =>
        await context.ShiftRegistrationWindows.AddAsync(window);

    public void UpdateRegistrationWindow(ShiftRegistrationWindow window)
    {
        window.UpdatedAt = DateTime.UtcNow;
        context.ShiftRegistrationWindows.Update(window);
    }

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
