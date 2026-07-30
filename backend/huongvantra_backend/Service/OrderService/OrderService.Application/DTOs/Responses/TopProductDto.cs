namespace OrderService.Application.DTOs.Responses;

public class TopProductDto
{
    public Guid SkuId { get; set; }
    public string SkuSnapshotName { get; set; } = string.Empty;
    public int TotalQuantitySold { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalCostPrice { get; set; }
    public decimal GrossProfit { get; set; }
    public double GrossProfitMargin { get; set; }
}
