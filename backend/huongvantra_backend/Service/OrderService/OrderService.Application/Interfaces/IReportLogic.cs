using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;

namespace OrderService.Application.Interfaces;

public interface IReportLogic
{
    Task<SalesStatisticsResponse> GetSalesStatisticsAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default);
    Task<List<TopProductDto>> GetTopSellingProductsAsync(int topCount, string sortBy, int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default);
    Task<List<CategorySalesDto>> GetSalesByCategoryAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default);
    Task<List<TimeSeriesPointDto>> GetCustomerGrowthTimeSeriesAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default);
    Task<List<TimeSeriesPointDto>> GetRevenueTimeSeriesAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default);
    Task<List<RevenueProfitTimeSeriesPointDto>> GetRevenueProfitTimeSeriesAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default);
    Task<List<CategorySalesDto>> GetSalesByChannelAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default);
    Task<List<TimeSeriesPointDto>> GetOrderCountTimeSeriesAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default);
    Task<DailyCashReconciliationResponse> GetDailyCashReconciliationAsync(DailyReportFilter filter, CancellationToken cancellationToken = default);
}
