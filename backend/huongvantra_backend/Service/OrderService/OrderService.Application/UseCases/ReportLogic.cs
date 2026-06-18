using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;

namespace OrderService.Application.UseCases;

public class ReportLogic(IReportRepository reportRepository) : IReportLogic
{
    public Task<SalesStatisticsResponse> GetSalesStatisticsAsync(int? quarter, int? month, int? year, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetSalesStatisticsAsync(quarter, month, year, cancellationToken);
    }

    public Task<List<TopProductDto>> GetTopSellingProductsAsync(int topCount, int? quarter, int? month, int? year, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetTopSellingProductsAsync(topCount, quarter, month, year, cancellationToken);
    }

    public Task<List<CategorySalesDto>> GetSalesByCategoryAsync(int? quarter, int? month, int? year, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetSalesByCategoryAsync(quarter, month, year, cancellationToken);
    }

    public Task<List<TimeSeriesPointDto>> GetCustomerGrowthTimeSeriesAsync(int? quarter, int? month, int? year, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetCustomerGrowthTimeSeriesAsync(quarter, month, year, cancellationToken);
    }

    public Task<List<TimeSeriesPointDto>> GetRevenueTimeSeriesAsync(int? quarter, int? month, int? year, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetRevenueTimeSeriesAsync(quarter, month, year, cancellationToken);
    }

    public Task<List<CategorySalesDto>> GetSalesByChannelAsync(int? quarter, int? month, int? year, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetSalesByChannelAsync(quarter, month, year, cancellationToken);
    }

    public Task<List<TimeSeriesPointDto>> GetOrderCountTimeSeriesAsync(int? quarter, int? month, int? year, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetOrderCountTimeSeriesAsync(quarter, month, year, cancellationToken);
    }
}
