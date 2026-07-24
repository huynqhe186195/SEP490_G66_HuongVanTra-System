using UserService.Domain.Enums;

namespace UserService.Domain.Entities;

public class ShiftRegistration : BaseEntity
{
    public Guid Id { get; set; }
    public Guid SlotId { get; set; }
    public Guid UserId { get; set; }
    public string StaffName { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public ShiftRegistrationStatus Status { get; set; } = ShiftRegistrationStatus.Pending;
    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedByUserId { get; set; }

    public ShiftSlot Slot { get; set; } = null!;
}
