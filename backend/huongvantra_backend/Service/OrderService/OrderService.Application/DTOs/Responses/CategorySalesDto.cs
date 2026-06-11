namespace OrderService.Application.DTOs.Responses;

public class CategorySalesDto
{
    public string CategoryName { get; set; } = string.Empty;
    public int TotalQuantitySold { get; set; }
    public decimal TotalRevenue { get; set; }
}
