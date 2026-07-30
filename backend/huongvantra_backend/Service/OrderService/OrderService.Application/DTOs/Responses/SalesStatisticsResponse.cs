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

    /// <summary>Tổng giá vốn hàng đã bán (theo CostPrice trên dòng đơn, trừ phần đã trả).</summary>
    public decimal TotalCostOfGoods { get; set; }

    public decimal GrossProfit { get; set; }
    
    public double GrossProfitMargin { get; set; }
    public decimal AverageOrderValue { get; set; }
    public decimal TotalDiscountAmount { get; set; }

    public decimal PrevGrossRevenue { get; set; }
    public double GrossRevenueGrowthRate { get; set; }

    public decimal PrevNetRevenue { get; set; }
    public double NetRevenueGrowthRate { get; set; }

    public decimal PrevGrossProfit { get; set; }
    public double GrossProfitGrowthRate { get; set; }

    public int PrevTotalCompletedOrders { get; set; }
    public double TotalOrdersGrowthRate { get; set; }

    public decimal PrevAverageOrderValue { get; set; }
    public double AverageOrderValueGrowthRate { get; set; }

    public decimal PrevTotalDiscountAmount { get; set; }
    public double TotalDiscountGrowthRate { get; set; }
}
