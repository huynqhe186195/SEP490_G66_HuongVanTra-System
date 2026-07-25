using UserService.Domain.Enums;

namespace UserService.Domain.Entities;

public class ShiftTemplate : BaseEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public ShiftArea Area { get; set; }
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public int Capacity { get; set; }
    public string Color { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<ShiftSlot> Slots { get; set; } = new List<ShiftSlot>();
}
