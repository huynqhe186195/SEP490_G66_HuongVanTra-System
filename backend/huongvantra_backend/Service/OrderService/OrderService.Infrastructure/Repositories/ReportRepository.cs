using Microsoft.EntityFrameworkCore;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class ReportRepository(OrderDbContext dbContext) : IReportRepository
{
    public async Task<SalesStatisticsResponse> GetSalesStatisticsAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken ct = default)
    {
        var query = dbContext.Orders
            .Include(o => o.OrderDetails)
            .Include(o => o.Payments)
            .Include(o => o.ReturnOrders)
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Completed);

        if (employeeId.HasValue)
        {
            query = query.Where(o => o.EmployeeId == employeeId.Value);
        }

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
        var validOrders = completedOrders.ToList();

        var grossRevenue = validOrders.Sum(o => o.TotalAmount);
        // DiscountAmount is the persisted aggregate (manual + promotion + membership).
        var totalDiscountAmount = validOrders.Sum(o => o.DiscountAmount);
        
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
                .Where(o => o.OrderStatus == OrderStatus.Completed && o.CreatedAt.Year == prevYear && o.CreatedAt.Month == prevMonth)
                .Where(o => !employeeId.HasValue || o.EmployeeId == employeeId.Value)
                .Select(o => o.CustomerId).Distinct().CountAsync(ct);
        }
        else if (year.HasValue && quarter.HasValue)
        {
            var prevQuarter = quarter.Value == 1 ? 4 : quarter.Value - 1;
            var prevYear = quarter.Value == 1 ? year.Value - 1 : year.Value;
            var startMonth = (prevQuarter - 1) * 3 + 1;
            var endMonth = prevQuarter * 3;
            prevCustomerCount = await dbContext.Orders
                .Where(o => o.OrderStatus == OrderStatus.Completed && o.CreatedAt.Year == prevYear && o.CreatedAt.Month >= startMonth && o.CreatedAt.Month <= endMonth)
                .Where(o => !employeeId.HasValue || o.EmployeeId == employeeId.Value)
                .Select(o => o.CustomerId).Distinct().CountAsync(ct);
        }
        else if (year.HasValue)
        {
            prevCustomerCount = await dbContext.Orders
                .Where(o => o.OrderStatus == OrderStatus.Completed && o.CreatedAt.Year == year.Value - 1)
                .Where(o => !employeeId.HasValue || o.EmployeeId == employeeId.Value)
                .Select(o => o.CustomerId).Distinct().CountAsync(ct);
        }
        
        var customerGrowthRate = prevCustomerCount == 0 ? (customerCount > 0 ? 1.0 : 0.0) : (double)(customerCount - prevCustomerCount) / prevCustomerCount;

        // Cọc bị mất khi hủy đơn backorder: thu nhập khác, tách riêng khỏi doanh thu bán hàng.
        var forfeitedQuery = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Cancelled && o.DepositAmount != null && o.DepositAmount > 0);

        if (year.HasValue)
        {
            forfeitedQuery = forfeitedQuery.Where(o => o.CreatedAt.Year == year.Value);
        }

        if (quarter.HasValue)
        {
            var startMonth = (quarter.Value - 1) * 3 + 1;
            var endMonth = quarter.Value * 3;
            forfeitedQuery = forfeitedQuery.Where(o => o.CreatedAt.Month >= startMonth && o.CreatedAt.Month <= endMonth);
        }

        if (month.HasValue)
        {
            forfeitedQuery = forfeitedQuery.Where(o => o.CreatedAt.Month == month.Value);
        }

        var forfeitedDeposits = await forfeitedQuery
            .Select(o => o.DepositAmount!.Value)
            .ToListAsync(ct);

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
            GrossProfit = grossProfit,
            ForfeitedDepositIncome = forfeitedDeposits.Sum(),
            ForfeitedDepositOrders = forfeitedDeposits.Count,
            TotalDiscountAmount = totalDiscountAmount
        };
    }

    public async Task<List<TopProductDto>> GetTopSellingProductsAsync(int topCount, string sortBy, int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken ct = default)
    {
        var query = dbContext.OrderDetails
            .Where(od => od.Order.OrderStatus == OrderStatus.Completed);

        if (employeeId.HasValue)
        {
            query = query.Where(od => od.Order.EmployeeId == employeeId.Value);
        }

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

    public async Task<List<CategorySalesDto>> GetSalesByCategoryAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken ct = default)
    {
        var query = dbContext.OrderDetails
            .Where(od => od.Order.OrderStatus == OrderStatus.Completed);

        if (employeeId.HasValue)
        {
            query = query.Where(od => od.Order.EmployeeId == employeeId.Value);
        }

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

    public async Task<List<TimeSeriesPointDto>> GetCustomerGrowthTimeSeriesAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken ct = default)
    {
        var query = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Completed);

        if (employeeId.HasValue)
        {
            query = query.Where(o => o.EmployeeId == employeeId.Value);
        }

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

    public async Task<List<TimeSeriesPointDto>> GetRevenueTimeSeriesAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken ct = default)
    {
        var query = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Completed);

        if (employeeId.HasValue)
        {
            query = query.Where(o => o.EmployeeId == employeeId.Value);
        }

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

    public async Task<List<RevenueProfitTimeSeriesPointDto>> GetRevenueProfitTimeSeriesAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken ct = default)
    {
        var query = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Completed);

        if (employeeId.HasValue)
        {
            query = query.Where(o => o.EmployeeId == employeeId.Value);
        }

        if (year.HasValue) query = query.Where(o => o.CreatedAt.Year == year.Value);
        if (month.HasValue) query = query.Where(o => o.CreatedAt.Month == month.Value);
        else if (quarter.HasValue)
        {
            var startMonth = (quarter.Value - 1) * 3 + 1;
            var endMonth = quarter.Value * 3;
            query = query.Where(o => o.CreatedAt.Month >= startMonth && o.CreatedAt.Month <= endMonth);
        }

        var orders = await query.Select(o => new { 
            o.CreatedAt, 
            GrossRevenue = o.TotalAmount,
            TotalDiscount = o.DiscountAmount,
            TotalRefund = (o.ReturnOrders != null) ? o.ReturnOrders.Sum(r => r.RefundAmount) : 0,
            TotalCost = (o.OrderDetails != null) ? o.OrderDetails.Sum(od => od.CostPrice * (od.Quantity - od.ReturnedQuantity)) : 0
        }).ToListAsync(ct);

        var projectedOrders = orders.Select(o => new {
            o.CreatedAt,
            o.GrossRevenue,
            NetRevenue = o.GrossRevenue - o.TotalDiscount - o.TotalRefund,
            GrossProfit = (o.GrossRevenue - o.TotalDiscount - o.TotalRefund) - o.TotalCost
        }).ToList();

        if (month.HasValue)
        {
            return Enumerable.Range(1, DateTime.DaysInMonth(year ?? DateTime.Now.Year, month.Value))
                .Select(day => {
                    var dayOrders = projectedOrders.Where(o => o.CreatedAt.Day == day).ToList();
                    return new RevenueProfitTimeSeriesPointDto
                    {
                        Label = $"{day}/{month}",
                        GrossRevenue = dayOrders.Sum(o => o.GrossRevenue),
                        NetRevenue = dayOrders.Sum(o => o.NetRevenue),
                        GrossProfit = dayOrders.Sum(o => o.GrossProfit)
                    };
                }).ToList();
        }
        else if (quarter.HasValue)
        {
            var startMonth = (quarter.Value - 1) * 3 + 1;
            var endMonth = quarter.Value * 3;
            var points = new List<RevenueProfitTimeSeriesPointDto>();
            var startDate = new DateTime(year ?? DateTime.Now.Year, startMonth, 1);
            var endDate = new DateTime(year ?? DateTime.Now.Year, endMonth, DateTime.DaysInMonth(year ?? DateTime.Now.Year, endMonth));
            for (var d = startDate; d <= endDate; d = d.AddDays(5))
            {
                var dEnd = d.AddDays(4);
                if (dEnd > endDate) dEnd = endDate;
                var periodOrders = projectedOrders.Where(o => o.CreatedAt.Date >= d && o.CreatedAt.Date <= dEnd).ToList();
                points.Add(new RevenueProfitTimeSeriesPointDto { 
                    Label = $"{d:dd/MM}-{dEnd:dd/MM}", 
                    GrossRevenue = periodOrders.Sum(o => o.GrossRevenue),
                    NetRevenue = periodOrders.Sum(o => o.NetRevenue),
                    GrossProfit = periodOrders.Sum(o => o.GrossProfit)
                });
            }
            return points;
        }
        else if (year.HasValue)
        {
            return Enumerable.Range(1, 12)
                .Select(m => {
                    var monthOrders = projectedOrders.Where(o => o.CreatedAt.Month == m).ToList();
                    return new RevenueProfitTimeSeriesPointDto
                    {
                        Label = $"Tháng {m}",
                        GrossRevenue = monthOrders.Sum(o => o.GrossRevenue),
                        NetRevenue = monthOrders.Sum(o => o.NetRevenue),
                        GrossProfit = monthOrders.Sum(o => o.GrossProfit)
                    };
                }).ToList();
        }
        else
        {
            var years = projectedOrders.Select(o => o.CreatedAt.Year).Distinct().OrderBy(y => y).ToList();
            if (!years.Any()) return new List<RevenueProfitTimeSeriesPointDto>();
            return years.Select(y => {
                var yearOrders = projectedOrders.Where(o => o.CreatedAt.Year == y).ToList();
                return new RevenueProfitTimeSeriesPointDto
                {
                    Label = $"Năm {y}",
                    GrossRevenue = yearOrders.Sum(o => o.GrossRevenue),
                    NetRevenue = yearOrders.Sum(o => o.NetRevenue),
                    GrossProfit = yearOrders.Sum(o => o.GrossProfit)
                };
            }).ToList();
        }
    }

    public async Task<List<CategorySalesDto>> GetSalesByChannelAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken ct = default)
    {
        var query = dbContext.Orders
            .Where(o => o.OrderStatus == OrderStatus.Completed);

        if (employeeId.HasValue)
        {
            query = query.Where(o => o.EmployeeId == employeeId.Value);
        }

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

    public async Task<List<TimeSeriesPointDto>> GetOrderCountTimeSeriesAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken ct = default)
    {
        var query = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Completed);

        if (employeeId.HasValue)
        {
            query = query.Where(o => o.EmployeeId == employeeId.Value);
        }

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

    private const int VietnamOffsetHours = 7;

    private static string PaymentMethodLabel(PaymentMethod method) => method switch
    {
        PaymentMethod.Cash => "Tiền mặt",
        PaymentMethod.VietQR => "VietQR",
        PaymentMethod.BankTransfer => "Chuyển khoản",
        PaymentMethod.COD => "Thu hộ COD",
        PaymentMethod.Debt => "Ghi nợ",
        _ => method.ToString()
    };

    private static string PaymentPurposeLabel(PaymentPurpose purpose) => purpose switch
    {
        PaymentPurpose.Full => "Thu đủ một lần",
        PaymentPurpose.Deposit => "Tiền cọc",
        PaymentPurpose.RemainingAtPickup => "Thu phần còn lại khi nhận hàng",
        _ => purpose.ToString()
    };

    private static string SalesModeLabel(SalesMode mode) => mode switch
    {
        SalesMode.Counter => "Tại quầy",
        SalesMode.Delivery => "Giao hàng",
        SalesMode.Scheduled => "Hẹn giao",
        _ => mode.ToString()
    };

    private static string OrderChannelLabel(OrderChannel channel) => channel switch
    {
        OrderChannel.POS => "Tại quầy (POS)",
        OrderChannel.Website => "Website",
        OrderChannel.Zalo => "Zalo",
        OrderChannel.Phone => "Điện thoại",
        OrderChannel.COD => "Giao hàng COD",
        OrderChannel.B2B => "Khách sỉ B2B",
        _ => channel.ToString()
    };

    /// <summary>Suy ra phương thức bán hàng từ dữ liệu đơn: có ngày hẹn → hẹn giao, có địa chỉ/COD → giao hàng, còn lại → tại quầy.</summary>
    private static SalesMode DeriveSalesMode(DateTime? pickupDate, OrderChannel channel, string? shippingAddress)
    {
        if (pickupDate != null) return SalesMode.Scheduled;
        if (channel == OrderChannel.COD || !string.IsNullOrWhiteSpace(shippingAddress)) return SalesMode.Delivery;
        return SalesMode.Counter;
    }

    public async Task<DailyCashReconciliationResponse> GetDailyCashReconciliationAsync(
        DailyReportFilter filter, CancellationToken ct = default)
    {
        var fromUtc = filter.FromUtc;
        var toUtc = filter.ToUtc;
        var employeeId = filter.EmployeeId;
        var customerId = filter.CustomerId;
        var salesMode = filter.SalesMode;
        var channel = filter.Channel;
        var orderStatus = filter.OrderStatus;

        // "Chuyển khoản" gộp cả VietQR vì cùng là tiền vào tài khoản, không phải tiền két.
        var methodFilter = filter.PaymentMethod switch
        {
            PaymentMethod.BankTransfer => new[] { PaymentMethod.BankTransfer, PaymentMethod.VietQR },
            null => null,
            _ => [filter.PaymentMethod.Value]
        };

        // Dòng tiền thu vào: theo PaidAt của payment đã thành công, không theo ngày tạo đơn,
        // vì cọc và phần còn lại của cùng một đơn có thể thu ở hai ngày khác nhau.
        var paymentQuery = dbContext.Payments
            .AsNoTracking()
            .Where(p => p.PaymentStatus == PaymentStatus.Success
                        && p.PaidAt != null
                        && p.PaidAt >= fromUtc
                        && p.PaidAt <= toUtc);

        if (employeeId.HasValue)
            paymentQuery = paymentQuery.Where(p => p.Order.EmployeeId == employeeId.Value);

        if (customerId.HasValue)
            paymentQuery = paymentQuery.Where(p => p.Order.CustomerId == customerId.Value);

        if (methodFilter != null)
            paymentQuery = paymentQuery.Where(p => methodFilter.Contains(p.PaymentMethod));

        if (channel.HasValue)
            paymentQuery = paymentQuery.Where(p => p.Order.OrderChannel == channel.Value);

        if (orderStatus.HasValue)
            paymentQuery = paymentQuery.Where(p => p.Order.OrderStatus == orderStatus.Value);

        if (salesMode.HasValue)
            paymentQuery = salesMode.Value switch
            {
                SalesMode.Scheduled => paymentQuery.Where(p => p.Order.PickupDate != null),
                SalesMode.Delivery => paymentQuery.Where(p => p.Order.PickupDate == null
                    && (p.Order.OrderChannel == OrderChannel.COD
                        || (p.Order.ShippingAddress != null && p.Order.ShippingAddress != ""))),
                _ => paymentQuery.Where(p => p.Order.PickupDate == null
                    && p.Order.OrderChannel != OrderChannel.COD
                    && (p.Order.ShippingAddress == null || p.Order.ShippingAddress == ""))
            };

        var receipts = await paymentQuery
            .OrderBy(p => p.PaidAt)
            .Select(p => new CashReceiptDto
            {
                OrderId = p.OrderId,
                OrderCode = p.Order.OrderCode,
                PaidAt = p.PaidAt!.Value,
                OrderCreatedAt = p.Order.CreatedAt,
                PaymentMethod = p.PaymentMethod.ToString(),
                PaymentPurpose = p.PaymentPurpose.ToString(),
                Amount = p.Amount,
                EmployeeName = p.Order.EmployeeSnapshotName,
                CustomerName = p.Order.CustomerSnapshotName,
                OrderStatus = p.Order.OrderStatus.ToString()
            })
            .ToListAsync(ct);

        // Dòng tiền chi ra: hoàn tiền trả hàng phát sinh trong ngày.
        var returnQuery = dbContext.ReturnOrders
            .AsNoTracking()
            .Where(r => r.RefundAmount > 0 && r.CreatedAt >= fromUtc && r.CreatedAt <= toUtc);

        if (employeeId.HasValue)
            returnQuery = returnQuery.Where(r => r.SourceOrder.EmployeeId == employeeId.Value);

        if (customerId.HasValue)
            returnQuery = returnQuery.Where(r => r.SourceOrder.CustomerId == customerId.Value);

        if (methodFilter != null)
            returnQuery = returnQuery.Where(r => methodFilter.Contains(r.RefundMethod));

        if (channel.HasValue)
            returnQuery = returnQuery.Where(r => r.SourceOrder.OrderChannel == channel.Value);

        if (salesMode.HasValue)
            returnQuery = salesMode.Value switch
            {
                SalesMode.Scheduled => returnQuery.Where(r => r.SourceOrder.PickupDate != null),
                SalesMode.Delivery => returnQuery.Where(r => r.SourceOrder.PickupDate == null
                    && (r.SourceOrder.OrderChannel == OrderChannel.COD
                        || (r.SourceOrder.ShippingAddress != null && r.SourceOrder.ShippingAddress != ""))),
                _ => returnQuery.Where(r => r.SourceOrder.PickupDate == null
                    && r.SourceOrder.OrderChannel != OrderChannel.COD
                    && (r.SourceOrder.ShippingAddress == null || r.SourceOrder.ShippingAddress == ""))
            };

        var refunds = await returnQuery
            .Select(r => new { r.RefundAmount, r.RefundMethod })
            .ToListAsync(ct);

        var cashIn = Enum.GetValues<PaymentPurpose>()
            .Select(purpose =>
            {
                var lines = receipts.Where(r => r.PaymentPurpose == purpose.ToString()).ToList();
                return new CashFlowLineDto
                {
                    Key = purpose.ToString(),
                    Label = PaymentPurposeLabel(purpose),
                    Amount = lines.Sum(l => l.Amount),
                    Count = lines.Count
                };
            })
            .Where(l => l.Count > 0)
            .ToList();

        var cashOut = refunds
            .GroupBy(r => r.RefundMethod)
            .Select(g => new CashFlowLineDto
            {
                Key = g.Key.ToString(),
                Label = PaymentMethodLabel(g.Key),
                Amount = g.Sum(r => r.RefundAmount),
                Count = g.Count()
            })
            .OrderBy(l => l.Key)
            .ToList();

        var methodKeys = receipts.Select(r => r.PaymentMethod)
            .Concat(refunds.Select(r => r.RefundMethod.ToString()))
            .Distinct()
            .ToList();

        var byMethod = methodKeys
            .Select(key =>
            {
                var parsed = Enum.Parse<PaymentMethod>(key);
                var inLines = receipts.Where(r => r.PaymentMethod == key).ToList();
                var outAmount = refunds.Where(r => r.RefundMethod == parsed).Sum(r => r.RefundAmount);
                return new CashReconciliationLineDto
                {
                    PaymentMethod = key,
                    Label = PaymentMethodLabel(parsed),
                    AmountIn = inLines.Sum(l => l.Amount),
                    AmountOut = outAmount,
                    Net = inLines.Sum(l => l.Amount) - outAmount,
                    Count = inLines.Count,
                    IsCash = parsed == PaymentMethod.Cash
                };
            })
            .OrderBy(l => l.PaymentMethod)
            .ToList();

        // Cọc bị giữ khi hủy đơn backorder: thu nhập khác, không cộng vào doanh thu bán hàng.
        var forfeitedQuery = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Cancelled
                        && o.DepositAmount != null
                        && o.DepositAmount > 0
                        && o.CancellationRequestedAt != null
                        && o.CancellationRequestedAt >= fromUtc
                        && o.CancellationRequestedAt <= toUtc);

        if (employeeId.HasValue)
            forfeitedQuery = forfeitedQuery.Where(o => o.EmployeeId == employeeId.Value);

        if (customerId.HasValue)
            forfeitedQuery = forfeitedQuery.Where(o => o.CustomerId == customerId.Value);

        if (methodFilter != null)
            forfeitedQuery = forfeitedQuery.Where(o => o.Payments.Any(p =>
                p.PaymentStatus == PaymentStatus.Success && methodFilter.Contains(p.PaymentMethod)));

        if (channel.HasValue)
            forfeitedQuery = forfeitedQuery.Where(o => o.OrderChannel == channel.Value);

        if (salesMode.HasValue)
            forfeitedQuery = salesMode.Value switch
            {
                SalesMode.Scheduled => forfeitedQuery.Where(o => o.PickupDate != null),
                SalesMode.Delivery => forfeitedQuery.Where(o => o.PickupDate == null
                    && (o.OrderChannel == OrderChannel.COD
                        || (o.ShippingAddress != null && o.ShippingAddress != ""))),
                _ => forfeitedQuery.Where(o => o.PickupDate == null
                    && o.OrderChannel != OrderChannel.COD
                    && (o.ShippingAddress == null || o.ShippingAddress == ""))
            };

        var forfeited = await forfeitedQuery.Select(o => o.DepositAmount!.Value).ToListAsync(ct);

        // Doanh thu bán hàng ghi nhận: đơn hoàn tất trong ngày (tham chiếu, khác dòng tiền).
        // Bỏ trống filter trạng thái nghĩa là chỉ tính đơn hoàn tất.
        var statusForRevenue = orderStatus ?? OrderStatus.Completed;
        var completedQuery = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == statusForRevenue
                        && o.CreatedAt >= fromUtc
                        && o.CreatedAt <= toUtc);

        if (channel.HasValue)
            completedQuery = completedQuery.Where(o => o.OrderChannel == channel.Value);

        if (employeeId.HasValue)
            completedQuery = completedQuery.Where(o => o.EmployeeId == employeeId.Value);

        if (customerId.HasValue)
            completedQuery = completedQuery.Where(o => o.CustomerId == customerId.Value);

        // Lọc theo phương thức thanh toán: chỉ giữ đơn có ít nhất một lần thu thành công bằng phương thức đó.
        if (methodFilter != null)
            completedQuery = completedQuery.Where(o => o.Payments.Any(p =>
                p.PaymentStatus == PaymentStatus.Success && methodFilter.Contains(p.PaymentMethod)));

        if (salesMode.HasValue)
            completedQuery = salesMode.Value switch
            {
                SalesMode.Scheduled => completedQuery.Where(o => o.PickupDate != null),
                SalesMode.Delivery => completedQuery.Where(o => o.PickupDate == null
                    && (o.OrderChannel == OrderChannel.COD
                        || (o.ShippingAddress != null && o.ShippingAddress != ""))),
                _ => completedQuery.Where(o => o.PickupDate == null
                    && o.OrderChannel != OrderChannel.COD
                    && (o.ShippingAddress == null || o.ShippingAddress == ""))
            };

        var completed = await completedQuery
            .Select(o => new
            {
                o.Id,
                o.OrderCode,
                o.CreatedAt,
                o.CustomerSnapshotName,
                o.EmployeeId,
                o.EmployeeSnapshotName,
                o.OrderStatus,
                o.TotalAmount,
                o.FinalAmount,
                o.DiscountAmount,
                o.PickupDate,
                o.OrderChannel,
                o.ShippingAddress,
                // Không có cột PaidAmount — phải cộng từ các lần thu thành công.
                PaidAmount = o.Payments
                    .Where(p => p.PaymentStatus == PaymentStatus.Success)
                    .Sum(p => (decimal?)p.Amount) ?? 0m,
                PaidMethods = o.Payments
                    .Where(p => p.PaymentStatus == PaymentStatus.Success)
                    .Select(p => p.PaymentMethod)
                    .ToList(),
                Lines = o.OrderDetails.Select(d => new
                {
                    d.SkuId,
                    d.SkuSnapshotCode,
                    d.SkuSnapshotName,
                    d.CategorySnapshotName,
                    d.Quantity,
                    d.ReturnedQuantity,
                    d.SubTotal
                }).ToList()
            })
            .ToListAsync(ct);

        var products = completed
            .SelectMany(o => o.Lines.Select(l => new { o.Id, Line = l }))
            .GroupBy(x => x.Line.SkuId)
            .Select(g => new ProductSalesLineDto
            {
                SkuId = g.Key,
                SkuCode = g.First().Line.SkuSnapshotCode ?? string.Empty,
                SkuName = g.First().Line.SkuSnapshotName ?? string.Empty,
                CategoryName = g.First().Line.CategorySnapshotName,
                Quantity = g.Sum(x => x.Line.Quantity),
                ReturnedQuantity = g.Sum(x => x.Line.ReturnedQuantity),
                Revenue = g.Sum(x => x.Line.SubTotal),
                OrderCount = g.Select(x => x.Id).Distinct().Count()
            })
            .OrderByDescending(p => p.Revenue)
            .ToList();

        var bySalesMode = completed
            .GroupBy(o => DeriveSalesMode(o.PickupDate, o.OrderChannel, o.ShippingAddress))
            .Select(g => new SalesModeLineDto
            {
                SalesMode = g.Key.ToString(),
                Label = SalesModeLabel(g.Key),
                OrderCount = g.Count(),
                // AC-04: đếm số dòng hàng, không cộng chung Gram với Piece.
                Quantity = g.Sum(o => o.Lines.Count),
                Revenue = g.Sum(o => o.FinalAmount)
            })
            .OrderBy(l => l.SalesMode)
            .ToList();

        var byEmployee = completed
            .GroupBy(o => new { o.EmployeeId, Name = o.EmployeeSnapshotName })
            .Select(g => new EmployeeSalesLineDto
            {
                EmployeeId = g.Key.EmployeeId,
                EmployeeName = string.IsNullOrWhiteSpace(g.Key.Name) ? "Không xác định" : g.Key.Name!,
                OrderCount = g.Count(),
                Revenue = g.Sum(o => o.FinalAmount),
                Discount = g.Sum(o => o.DiscountAmount),
                CashCollected = g.Sum(o => o.PaidAmount)
            })
            .OrderByDescending(l => l.Revenue)
            .ToList();

        var byChannel = completed
            .GroupBy(o => o.OrderChannel)
            .Select(g => new ChannelSalesLineDto
            {
                Channel = g.Key.ToString(),
                Label = OrderChannelLabel(g.Key),
                OrderCount = g.Count(),
                Revenue = g.Sum(o => o.FinalAmount)
            })
            .OrderByDescending(l => l.Revenue)
            .ToList();

        var orders = completed
            .OrderByDescending(o => o.CreatedAt)
            .Select(o =>
            {
                var mode = DeriveSalesMode(o.PickupDate, o.OrderChannel, o.ShippingAddress);
                return new OrderSummaryLineDto
                {
                    OrderId = o.Id,
                    OrderCode = o.OrderCode,
                    CreatedAt = o.CreatedAt,
                    CustomerName = o.CustomerSnapshotName,
                    EmployeeName = o.EmployeeSnapshotName,
                    Channel = o.OrderChannel.ToString(),
                    ChannelLabel = OrderChannelLabel(o.OrderChannel),
                    SalesMode = mode.ToString(),
                    SalesModeLabel = SalesModeLabel(mode),
                    OrderStatus = o.OrderStatus.ToString(),
                    TotalAmount = o.TotalAmount,
                    DiscountAmount = o.DiscountAmount,
                    FinalAmount = o.FinalAmount,
                    PaidAmount = o.PaidAmount,
                    PaymentMethods = string.Join(", ", o.PaidMethods.Distinct().Select(PaymentMethodLabel)),
                    LineCount = o.Lines.Count
                };
            })
            .ToList();

        // Biểu đồ theo giờ hiển thị theo giờ Việt Nam (GMT+7), dữ liệu lưu ở UTC.
        var revenueByHour = completed
            .GroupBy(o => o.CreatedAt.AddHours(VietnamOffsetHours).Hour)
            .ToDictionary(g => g.Key, g => new { Revenue = g.Sum(o => o.FinalAmount), Count = g.Count() });

        var cashByHour = receipts
            .GroupBy(r => r.PaidAt.AddHours(VietnamOffsetHours).Hour)
            .ToDictionary(g => g.Key, g => g.Sum(r => r.Amount));

        var hourlyRevenue = revenueByHour.Keys
            .Concat(cashByHour.Keys)
            .Distinct()
            .OrderBy(h => h)
            .Select(h => new HourlyRevenueLineDto
            {
                Hour = h,
                Revenue = revenueByHour.TryGetValue(h, out var r) ? r.Revenue : 0m,
                OrderCount = revenueByHour.TryGetValue(h, out var c) ? c.Count : 0,
                CashIn = cashByHour.TryGetValue(h, out var cash) ? cash : 0m
            })
            .ToList();

        var statusCounts = await dbContext.Orders
            .AsNoTracking()
            .Where(o => o.CreatedAt >= fromUtc && o.CreatedAt <= toUtc
                        && (!employeeId.HasValue || o.EmployeeId == employeeId.Value)
                        && (!customerId.HasValue || o.CustomerId == customerId.Value)
                        && (!channel.HasValue || o.OrderChannel == channel.Value))
            .Select(o => new { o.OrderStatus, o.RefundStatus })
            .ToListAsync(ct);

        var cancelledOrders = statusCounts.Count(o => o.OrderStatus == OrderStatus.Cancelled);
        var refundedOrders = statusCounts.Count(o =>
            o.RefundStatus == BackorderRefundStatus.Approved || o.RefundStatus == BackorderRefundStatus.Completed);

        var totalIn = receipts.Sum(r => r.Amount);
        var totalOut = refunds.Sum(r => r.RefundAmount);
        var salesRevenue = completed.Sum(o => o.FinalAmount);
        var returnedRevenue = refunds.Sum(r => r.RefundAmount);
        var netRecognizedRevenue = salesRevenue - returnedRevenue;
        var forfeitedIncome = forfeited.Sum();

        var bridge = new RevenueCashBridgeDto
        {
            RecognizedRevenue = netRecognizedRevenue,
            UnpaidRevenue = completed.Sum(o => o.FinalAmount - o.PaidAmount),
            PriorPeriodCollections = receipts.Where(r => r.OrderCreatedAt < fromUtc).Sum(r => r.Amount),
            ForfeitedDeposit = forfeitedIncome,
            Refunds = totalOut,
            TotalCashIn = totalIn
        };

        return new DailyCashReconciliationResponse
        {
            ReportDate = fromUtc,
            CashIn = cashIn,
            CashOut = cashOut,
            ByPaymentMethod = byMethod,
            Receipts = receipts,
            TotalCashIn = totalIn,
            TotalCashOut = totalOut,
            NetCashFlow = totalIn - totalOut,
            ForfeitedDepositIncome = forfeitedIncome,
            ForfeitedDepositOrders = forfeited.Count,
            SalesRevenue = salesRevenue,
            SalesDiscount = completed.Sum(o => o.DiscountAmount),
            CompletedOrders = completed.Count,
            ReturnedRevenue = returnedRevenue,
            NetRecognizedRevenue = netRecognizedRevenue,
            TotalLineCount = completed.Sum(o => o.Lines.Count),
            DistinctSkuCount = completed.SelectMany(o => o.Lines).Select(l => l.SkuId).Distinct().Count(),
            CancelledOrders = cancelledOrders,
            RefundedOrders = refundedOrders,
            HourlyRevenue = hourlyRevenue,
            ByEmployee = byEmployee,
            ByChannel = byChannel,
            Orders = orders,
            Bridge = bridge,
            Products = products,
            BySalesMode = bySalesMode
        };
    }
}
