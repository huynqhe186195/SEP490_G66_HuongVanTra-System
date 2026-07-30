namespace OrderService.Application.DTOs.Responses;

public class CategorySalesDto
{
    public string CategoryName { get; set; } = string.Empty;
    public int TotalQuantitySold { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalCostPrice { get; set; }
    public decimal GrossProfit { get; set; }
    public double GrossProfitMargin { get; set; }
}
