using OrderService.Application.DTOs.Responses;

namespace OrderService.Application.Interfaces;

public interface IReportLogic
{
    Task<SalesStatisticsResponse> GetSalesStatisticsAsync(int? quarter, int? month, int? year, CancellationToken cancellationToken = default);
    Task<List<TopProductDto>> GetTopSellingProductsAsync(int topCount, string sortBy, int? quarter, int? month, int? year, CancellationToken cancellationToken = default);
    Task<List<CategorySalesDto>> GetSalesByCategoryAsync(int? quarter, int? month, int? year, CancellationToken cancellationToken = default);
    Task<List<TimeSeriesPointDto>> GetCustomerGrowthTimeSeriesAsync(int? quarter, int? month, int? year, CancellationToken cancellationToken = default);
    Task<List<TimeSeriesPointDto>> GetRevenueTimeSeriesAsync(int? quarter, int? month, int? year, CancellationToken cancellationToken = default);
    Task<List<CategorySalesDto>> GetSalesByChannelAsync(int? quarter, int? month, int? year, CancellationToken cancellationToken = default);
    Task<List<TimeSeriesPointDto>> GetOrderCountTimeSeriesAsync(int? quarter, int? month, int? year, CancellationToken cancellationToken = default);
}
