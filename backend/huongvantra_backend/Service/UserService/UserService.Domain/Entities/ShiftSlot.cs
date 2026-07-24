using UserService.Domain.Enums;

namespace UserService.Domain.Entities;

public class ShiftSlot : BaseEntity
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }
    public DateOnly WorkDate { get; set; }
    public ShiftSlotStatus Status { get; set; } = ShiftSlotStatus.Open;

    public ShiftTemplate Template { get; set; } = null!;
    public ICollection<ShiftRegistration> Registrations { get; set; } = new List<ShiftRegistration>();
}
