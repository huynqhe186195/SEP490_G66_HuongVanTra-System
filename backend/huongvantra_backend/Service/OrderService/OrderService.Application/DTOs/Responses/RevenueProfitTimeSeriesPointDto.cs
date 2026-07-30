namespace OrderService.Application.DTOs.Responses;

public class RevenueProfitTimeSeriesPointDto
{
    public string Label { get; set; } = null!;
    public decimal GrossRevenue { get; set; }
    public decimal NetRevenue { get; set; }
    public decimal GrossProfit { get; set; }
}