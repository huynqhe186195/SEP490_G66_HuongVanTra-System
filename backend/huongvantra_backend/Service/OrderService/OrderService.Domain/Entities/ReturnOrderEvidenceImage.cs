namespace OrderService.Domain.Entities;

public class ReturnOrderEvidenceImage
{
    public Guid Id { get; set; }
    public Guid ReturnOrderId { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    public ReturnOrder? ReturnOrder { get; set; }

    public const int MaxEvidenceImages = 5;
}
