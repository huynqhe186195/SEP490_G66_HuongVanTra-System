namespace ProductService.Domain.Entities;

public class PriceBook : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }

    public ICollection<PriceBookEntry> Entries { get; set; } = new List<PriceBookEntry>();
}
