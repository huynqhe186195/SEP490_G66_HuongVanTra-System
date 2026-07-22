using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class StocktakeRequest
{
    public Guid Id { get; set; }
    public string RequestCode { get; set; } = string.Empty;
    public string Location { get; set; } = "Warehouse";
    public DateTime CountDate { get; set; }
    public string? Reason { get; set; }
    public string? Note { get; set; }
    public StocktakeStatus Status { get; set; } = StocktakeStatus.Draft;
    public Guid CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public string? CreatedByRoleName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? SubmittedBy { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public Guid? ReviewedBy { get; set; }
    public string? ReviewedByName { get; set; }
    public string? ReviewedByRoleName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }

    public ICollection<StocktakeRequestItem> Items { get; set; } = new List<StocktakeRequestItem>();
}
