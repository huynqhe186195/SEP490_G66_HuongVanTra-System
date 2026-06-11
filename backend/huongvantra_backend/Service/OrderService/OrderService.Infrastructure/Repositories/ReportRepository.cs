using Microsoft.EntityFrameworkCore;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class ReportRepository(OrderDbContext dbContext) : IReportRepository
{
    public async Task<SalesStatisticsResponse> GetSalesStatisticsAsync(int? month, int? year, CancellationToken ct = default)
    {
        var query = dbContext.Orders
            .Include(o => o.Payments)
            .Include(o => o.Returns)
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Completed);

        if (year.HasValue)
        {
            query = query.Where(o => o.CreatedAt.Year == year.Value);
        }

        if (month.HasValue)
        {
            query = query.Where(o => o.CreatedAt.Month == month.Value);
        }

        var completedOrders = await query.ToListAsync(ct);

        // Filter orders where Payment is Success
        var validOrders = completedOrders.Where(o => 
            o.Payments.Any(p => p.PaymentStatus == PaymentStatus.Success)).ToList();

        var grossRevenue = validOrders.Sum(o => o.FinalAmount);
        
        var partiallyReturned = 0;
        var fullyReturned = 0;
        var totalRefundAmount = 0m;
        var totalReturnValue = 0m;

        foreach (var order in validOrders)
        {
            if (order.Returns != null && order.Returns.Any())
            {
                var orderRefund = order.Returns.Sum(r => r.RefundedAmount);
                var orderReturnValue = order.Returns.Sum(r => r.ReturnValue);

                totalRefundAmount += orderRefund;
                totalReturnValue += orderReturnValue;

                // Simple heuristic: if total refund >= final amount, it's fully returned
                if (orderRefund >= order.FinalAmount)
                {
                    fullyReturned++;
                }
                else
                {
                    partiallyReturned++;
                }
            }
        }

        var netRevenue = grossRevenue - totalRefundAmount;
        var totalOrders = validOrders.Count;
        var returnedOrdersCount = partiallyReturned + fullyReturned;

        var returnRate = totalOrders > 0 ? (double)returnedOrdersCount / totalOrders : 0;
        var valueReturnRate = grossRevenue > 0 ? (double)totalRefundAmount / (double)grossRevenue : 0;

        return new SalesStatisticsResponse
        {
            GrossRevenue = grossRevenue,
            ReturnValue = totalReturnValue,
            RefundAmount = totalRefundAmount,
            NetRevenue = netRevenue,
            TotalCompletedOrders = totalOrders,
            PartiallyReturnedOrders = partiallyReturned,
            FullyReturnedOrders = fullyReturned,
            ReturnRate = returnRate,
            ValueReturnRate = valueReturnRate
        };
    }
}
