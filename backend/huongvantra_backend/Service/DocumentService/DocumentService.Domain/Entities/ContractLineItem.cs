namespace DocumentService.Domain.Entities;

public class ContractLineItem
{
    public Guid Id { get; set; }
    public Guid ContractId { get; set; }
    public int LineNumber { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineAmount { get; set; }
    public string? Note { get; set; }

    public Contract Contract { get; set; } = null!;
}
