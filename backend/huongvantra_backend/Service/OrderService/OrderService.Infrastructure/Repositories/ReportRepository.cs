using Microsoft.EntityFrameworkCore;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class ReportRepository(OrderDbContext dbContext) : IReportRepository
{
    public async Task<SalesStatisticsResponse> GetSalesStatisticsAsync(int? quarter, int? month, int? year, CancellationToken ct = default)
    {
        var query = dbContext.Orders
            .Include(o => o.OrderDetails)
            .Include(o => o.Payments)
            .Include(o => o.ReturnOrders)
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Completed);

        if (year.HasValue)
        {
            query = query.Where(o => o.CreatedAt.Year == year.Value);
        }

        if (quarter.HasValue)
        {
            var startMonth = (quarter.Value - 1) * 3 + 1;
            var endMonth = quarter.Value * 3;
            query = query.Where(o => o.CreatedAt.Month >= startMonth && o.CreatedAt.Month <= endMonth);
        }

        if (month.HasValue)
        {
            query = query.Where(o => o.CreatedAt.Month == month.Value);
        }

        var completedOrders = await query.ToListAsync(ct);

        // Filter orders where Payment is Success
        var validOrders = completedOrders.Where(o => 
            o.Payments.Any(p => p.PaymentStatus == PaymentStatus.Success)).ToList();

        var grossRevenue = validOrders.Sum(o => o.TotalAmount);
        var totalDiscountAmount = validOrders.Sum(o => o.DiscountAmount + o.PromotionDiscountAmount);
        
        var partiallyReturned = 0;
        var fullyReturned = 0;
        var totalRefundAmount = 0m;
        var totalReturnValue = 0m;

        foreach (var order in validOrders)
        {
            if (order.ReturnOrders != null && order.ReturnOrders.Count > 0)
            {
                var orderRefund = order.ReturnOrders.Sum(r => r.RefundAmount);
                var orderReturnValue = order.ReturnOrders.Sum(r => r.ReturnAmount);

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

        var netRevenue = grossRevenue - totalDiscountAmount - totalRefundAmount;
        var totalOrders = validOrders.Count;
        var returnedOrdersCount = partiallyReturned + fullyReturned;

        // Calculate CostPrice sum for Profit
        // Summing over OrderDetails of validOrders, subtracting cost of returned quantities
        var totalCost = validOrders.SelectMany(o => o.OrderDetails ?? [])
                                   .Sum(od => od.CostPrice * (od.Quantity - od.ReturnedQuantity));
        var grossProfit = netRevenue - totalCost;

        var returnRate = totalOrders > 0 ? (double)returnedOrdersCount / totalOrders : 0;
        var valueReturnRate = grossRevenue > 0 ? (double)totalRefundAmount / (double)grossRevenue : 0;

        var customerCount = validOrders.Select(o => o.CustomerId).Distinct().Count();
        
        int prevCustomerCount = 0;
        if (year.HasValue && month.HasValue)
        {
            var prevMonth = month.Value == 1 ? 12 : month.Value - 1;
            var prevYear = month.Value == 1 ? year.Value - 1 : year.Value;
            prevCustomerCount = await dbContext.Orders
                .Where(o => o.OrderStatus == OrderStatus.Completed && o.CreatedAt.Year == prevYear && o.CreatedAt.Month == prevMonth && o.Payments.Any(p => p.PaymentStatus == PaymentStatus.Success))
                .Select(o => o.CustomerId).Distinct().CountAsync(ct);
        }
        else if (year.HasValue && quarter.HasValue)
        {
            var prevQuarter = quarter.Value == 1 ? 4 : quarter.Value - 1;
            var prevYear = quarter.Value == 1 ? year.Value - 1 : year.Value;
            var startMonth = (prevQuarter - 1) * 3 + 1;
            var endMonth = prevQuarter * 3;
            prevCustomerCount = await dbContext.Orders
                .Where(o => o.OrderStatus == OrderStatus.Completed && o.CreatedAt.Year == prevYear && o.CreatedAt.Month >= startMonth && o.CreatedAt.Month <= endMonth && o.Payments.Any(p => p.PaymentStatus == PaymentStatus.Success))
                .Select(o => o.CustomerId).Distinct().CountAsync(ct);
        }
        else if (year.HasValue)
        {
            prevCustomerCount = await dbContext.Orders
                .Where(o => o.OrderStatus == OrderStatus.Completed && o.CreatedAt.Year == year.Value - 1 && o.Payments.Any(p => p.PaymentStatus == PaymentStatus.Success))
                .Select(o => o.CustomerId).Distinct().CountAsync(ct);
        }
        
        var customerGrowthRate = prevCustomerCount == 0 ? (customerCount > 0 ? 1.0 : 0.0) : (double)(customerCount - prevCustomerCount) / prevCustomerCount;

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
            ValueReturnRate = valueReturnRate,
            CustomerCount = customerCount,
            CustomerGrowthRate = customerGrowthRate,
            TotalCostOfGoods = totalCost,
            GrossProfit = grossProfit
        };
    }

    public async Task<List<TopProductDto>> GetTopSellingProductsAsync(int topCount, string sortBy, int? quarter, int? month, int? year, CancellationToken ct = default)
    {
        var query = dbContext.OrderDetails
            .Where(od => od.Order.OrderStatus == OrderStatus.Completed &&
                         od.Order.Payments.Any(p => p.PaymentStatus == PaymentStatus.Success));

        if (year.HasValue)
        {
            query = query.Where(od => od.Order.CreatedAt.Year == year.Value);
        }

        if (quarter.HasValue)
        {
            var startMonth = (quarter.Value - 1) * 3 + 1;
            var endMonth = quarter.Value * 3;
            query = query.Where(od => od.Order.CreatedAt.Month >= startMonth && od.Order.CreatedAt.Month <= endMonth);
        }

        if (month.HasValue)
        {
            query = query.Where(od => od.Order.CreatedAt.Month == month.Value);
        }

        var topProductsQuery = query
            .GroupBy(od => new { od.SkuId, od.SkuSnapshotName })
            .Select(g => new TopProductDto
            {
                SkuId = g.Key.SkuId,
                SkuSnapshotName = g.Key.SkuSnapshotName,
                TotalQuantitySold = g.Sum(od => od.Quantity),
                TotalRevenue = g.Sum(od => od.SubTotal)
            });

        IQueryable<TopProductDto> sortedQuery;
        if (!string.IsNullOrEmpty(sortBy) && sortBy.ToLower() == "quantity")
        {
            sortedQuery = topProductsQuery.OrderByDescending(x => x.TotalQuantitySold);
        }
        else
        {
            sortedQuery = topProductsQuery.OrderByDescending(x => x.TotalRevenue);
        }

        return await sortedQuery
            .Take(topCount)
            .ToListAsync(ct);
    }

    public async Task<List<CategorySalesDto>> GetSalesByCategoryAsync(int? quarter, int? month, int? year, CancellationToken ct = default)
    {
        var query = dbContext.OrderDetails
            .Where(od => od.Order.OrderStatus == OrderStatus.Completed &&
                         od.Order.Payments.Any(p => p.PaymentStatus == PaymentStatus.Success));

        if (year.HasValue)
        {
            query = query.Where(od => od.Order.CreatedAt.Year == year.Value);
        }

        if (quarter.HasValue)
        {
            var startMonth = (quarter.Value - 1) * 3 + 1;
            var endMonth = quarter.Value * 3;
            query = query.Where(od => od.Order.CreatedAt.Month >= startMonth && od.Order.CreatedAt.Month <= endMonth);
        }

        if (month.HasValue)
        {
            query = query.Where(od => od.Order.CreatedAt.Month == month.Value);
        }

        var categorySales = await query
            .GroupBy(od => string.IsNullOrEmpty(od.CategorySnapshotName) ? "Chưa phân loại" : od.CategorySnapshotName)
            .Select(g => new CategorySalesDto
            {
                CategoryName = g.Key,
                TotalQuantitySold = g.Sum(od => od.Quantity),
                TotalRevenue = g.Sum(od => od.SubTotal)
            })
            .OrderByDescending(dto => dto.TotalRevenue)
            .ToListAsync(ct);

        return categorySales;
    }

    public async Task<List<TimeSeriesPointDto>> GetCustomerGrowthTimeSeriesAsync(int? quarter, int? month, int? year, CancellationToken ct = default)
    {
        var query = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Completed && o.Payments.Any(p => p.PaymentStatus == PaymentStatus.Success));

        if (year.HasValue) query = query.Where(o => o.CreatedAt.Year == year.Value);
        
        if (month.HasValue)
        {
            query = query.Where(o => o.CreatedAt.Month == month.Value);
            var orders = await query.Select(o => new { o.CreatedAt, o.CustomerId }).ToListAsync(ct);
            return Enumerable.Range(1, DateTime.DaysInMonth(year ?? DateTime.Now.Year, month.Value))
                .Select(day => new TimeSeriesPointDto
                {
                    Label = $"{day}/{month}",
                    Value = orders.Where(o => o.CreatedAt.Day == day).Select(o => o.CustomerId).Distinct().Count()
                }).ToList();
        }
        else if (quarter.HasValue)
        {
            var startMonth = (quarter.Value - 1) * 3 + 1;
            var endMonth = quarter.Value * 3;
            query = query.Where(o => o.CreatedAt.Month >= startMonth && o.CreatedAt.Month <= endMonth);
            var orders = await query.Select(o => new { o.CreatedAt, o.CustomerId }).ToListAsync(ct);
            
            var points = new List<TimeSeriesPointDto>();
            var startDate = new DateTime(year ?? DateTime.Now.Year, startMonth, 1);
            var endDate = new DateTime(year ?? DateTime.Now.Year, endMonth, DateTime.DaysInMonth(year ?? DateTime.Now.Year, endMonth));
            for (var d = startDate; d <= endDate; d = d.AddDays(5))
            {
                var dEnd = d.AddDays(4);
                if (dEnd > endDate) dEnd = endDate;
                var count = orders.Where(o => o.CreatedAt.Date >= d && o.CreatedAt.Date <= dEnd)
                                  .Select(o => o.CustomerId).Distinct().Count();
                points.Add(new TimeSeriesPointDto { Label = $"{d:dd/MM}-{dEnd:dd/MM}", Value = count });
            }
            return points;
        }
        else if (year.HasValue)
        {
            var orders = await query.Select(o => new { o.CreatedAt, o.CustomerId }).ToListAsync(ct);
            return Enumerable.Range(1, 12)
                .Select(m => new TimeSeriesPointDto
                {
                    Label = $"Tháng {m}",
                    Value = orders.Where(o => o.CreatedAt.Month == m).Select(o => o.CustomerId).Distinct().Count()
                }).ToList();
        }
        else
        {
            var orders = await query.Select(o => new { o.CreatedAt, o.CustomerId }).ToListAsync(ct);
            var years = orders.Select(o => o.CreatedAt.Year).Distinct().OrderBy(y => y).ToList();
            if (!years.Any()) return new List<TimeSeriesPointDto>();
            return years.Select(y => new TimeSeriesPointDto
            {
                Label = $"Năm {y}",
                Value = orders.Where(o => o.CreatedAt.Year == y).Select(o => o.CustomerId).Distinct().Count()
            }).ToList();
        }
    }

    public async Task<List<TimeSeriesPointDto>> GetRevenueTimeSeriesAsync(int? quarter, int? month, int? year, CancellationToken ct = default)
    {
        var query = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Completed && o.Payments.Any(p => p.PaymentStatus == PaymentStatus.Success));

        if (year.HasValue) query = query.Where(o => o.CreatedAt.Year == year.Value);
        
        if (month.HasValue)
        {
            query = query.Where(o => o.CreatedAt.Month == month.Value);
            var orders = await query.Select(o => new { o.CreatedAt, o.FinalAmount }).ToListAsync(ct);
            return Enumerable.Range(1, DateTime.DaysInMonth(year ?? DateTime.Now.Year, month.Value))
                .Select(day => new TimeSeriesPointDto
                {
                    Label = $"{day}/{month}",
                    Value = orders.Where(o => o.CreatedAt.Day == day).Sum(o => o.FinalAmount)
                }).ToList();
        }
        else if (quarter.HasValue)
        {
            var startMonth = (quarter.Value - 1) * 3 + 1;
            var endMonth = quarter.Value * 3;
            query = query.Where(o => o.CreatedAt.Month >= startMonth && o.CreatedAt.Month <= endMonth);
            var orders = await query.Select(o => new { o.CreatedAt, o.FinalAmount }).ToListAsync(ct);
            
            var points = new List<TimeSeriesPointDto>();
            var startDate = new DateTime(year ?? DateTime.Now.Year, startMonth, 1);
            var endDate = new DateTime(year ?? DateTime.Now.Year, endMonth, DateTime.DaysInMonth(year ?? DateTime.Now.Year, endMonth));
            for (var d = startDate; d <= endDate; d = d.AddDays(5))
            {
                var dEnd = d.AddDays(4);
                if (dEnd > endDate) dEnd = endDate;
                var value = orders.Where(o => o.CreatedAt.Date >= d && o.CreatedAt.Date <= dEnd).Sum(o => o.FinalAmount);
                points.Add(new TimeSeriesPointDto { Label = $"{d:dd/MM}-{dEnd:dd/MM}", Value = value });
            }
            return points;
        }
        else if (year.HasValue)
        {
            var orders = await query.Select(o => new { o.CreatedAt, o.FinalAmount }).ToListAsync(ct);
            return Enumerable.Range(1, 12)
                .Select(m => new TimeSeriesPointDto
                {
                    Label = $"Tháng {m}",
                    Value = orders.Where(o => o.CreatedAt.Month == m).Sum(o => o.FinalAmount)
                }).ToList();
        }
        else
        {
            var orders = await query.Select(o => new { o.CreatedAt, o.FinalAmount }).ToListAsync(ct);
            var years = orders.Select(o => o.CreatedAt.Year).Distinct().OrderBy(y => y).ToList();
            if (!years.Any()) return new List<TimeSeriesPointDto>();
            return years.Select(y => new TimeSeriesPointDto
            {
                Label = $"Năm {y}",
                Value = orders.Where(o => o.CreatedAt.Year == y).Sum(o => o.FinalAmount)
            }).ToList();
        }
    }

    public async Task<List<CategorySalesDto>> GetSalesByChannelAsync(int? quarter, int? month, int? year, CancellationToken ct = default)
    {
        var query = dbContext.Orders
            .Where(o => o.OrderStatus == OrderStatus.Completed && o.Payments.Any(p => p.PaymentStatus == PaymentStatus.Success));

        if (year.HasValue) query = query.Where(o => o.CreatedAt.Year == year.Value);
        if (quarter.HasValue)
        {
            var startMonth = (quarter.Value - 1) * 3 + 1;
            var endMonth = quarter.Value * 3;
            query = query.Where(o => o.CreatedAt.Month >= startMonth && o.CreatedAt.Month <= endMonth);
        }
        if (month.HasValue) query = query.Where(o => o.CreatedAt.Month == month.Value);

        // Map "Phone" to "Telesale" directly
        var channelSales = await query
            .GroupBy(o => o.OrderChannel)
            .Select(g => new CategorySalesDto
            {
                CategoryName = g.Key == OrderChannel.Phone ? "Telesale" : g.Key.ToString() ?? "",
                TotalQuantitySold = g.Sum(o => o.OrderDetails.Sum(od => od.Quantity)),
                TotalRevenue = g.Sum(o => o.FinalAmount)
            })
            .OrderByDescending(dto => dto.TotalRevenue)
            .ToListAsync(ct);

        return channelSales;
    }

    public async Task<List<TimeSeriesPointDto>> GetOrderCountTimeSeriesAsync(int? quarter, int? month, int? year, CancellationToken ct = default)
    {
        var query = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Completed && o.Payments.Any(p => p.PaymentStatus == PaymentStatus.Success));

        if (year.HasValue) query = query.Where(o => o.CreatedAt.Year == year.Value);
        
        if (month.HasValue)
        {
            query = query.Where(o => o.CreatedAt.Month == month.Value);
            var orders = await query.Select(o => new { o.CreatedAt, o.Id }).ToListAsync(ct);
            return Enumerable.Range(1, DateTime.DaysInMonth(year ?? DateTime.Now.Year, month.Value))
                .Select(day => new TimeSeriesPointDto
                {
                    Label = $"{day}/{month}",
                    Value = orders.Count(o => o.CreatedAt.Day == day)
                }).ToList();
        }
        else if (quarter.HasValue)
        {
            var startMonth = (quarter.Value - 1) * 3 + 1;
            var endMonth = quarter.Value * 3;
            query = query.Where(o => o.CreatedAt.Month >= startMonth && o.CreatedAt.Month <= endMonth);
            var orders = await query.Select(o => new { o.CreatedAt, o.Id }).ToListAsync(ct);
            
            var points = new List<TimeSeriesPointDto>();
            var startDate = new DateTime(year ?? DateTime.Now.Year, startMonth, 1);
            var endDate = new DateTime(year ?? DateTime.Now.Year, endMonth, DateTime.DaysInMonth(year ?? DateTime.Now.Year, endMonth));
            for (var d = startDate; d <= endDate; d = d.AddDays(5))
            {
                var dEnd = d.AddDays(4);
                if (dEnd > endDate) dEnd = endDate;
                var count = orders.Count(o => o.CreatedAt.Date >= d && o.CreatedAt.Date <= dEnd);
                points.Add(new TimeSeriesPointDto { Label = $"{d:dd/MM}-{dEnd:dd/MM}", Value = count });
            }
            return points;
        }
        else if (year.HasValue)
        {
            var orders = await query.Select(o => new { o.CreatedAt, o.Id }).ToListAsync(ct);
            return Enumerable.Range(1, 12)
                .Select(m => new TimeSeriesPointDto
                {
                    Label = $"Tháng {m}",
                    Value = orders.Count(o => o.CreatedAt.Month == m)
                }).ToList();
        }
        else
        {
            var orders = await query.Select(o => new { o.CreatedAt, o.Id }).ToListAsync(ct);
            var years = orders.Select(o => o.CreatedAt.Year).Distinct().OrderBy(y => y).ToList();
            if (!years.Any()) return new List<TimeSeriesPointDto>();
            return years.Select(y => new TimeSeriesPointDto
            {
                Label = $"Năm {y}",
                Value = orders.Count(o => o.CreatedAt.Year == y)
            }).ToList();
        }
    }
}
