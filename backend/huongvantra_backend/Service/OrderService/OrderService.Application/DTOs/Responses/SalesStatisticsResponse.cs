namespace OrderService.Application.DTOs.Responses;

public class SalesStatisticsResponse
{
    public decimal GrossRevenue { get; set; }
    public decimal ReturnValue { get; set; }
    public decimal RefundAmount { get; set; }
    public decimal NetRevenue { get; set; }
    
    public int TotalCompletedOrders { get; set; }
    public int PartiallyReturnedOrders { get; set; }
    public int FullyReturnedOrders { get; set; }
    
    public double ReturnRate { get; set; }
    public double ValueReturnRate { get; set; }

    public int CustomerCount { get; set; }
    public double CustomerGrowthRate { get; set; }
}
