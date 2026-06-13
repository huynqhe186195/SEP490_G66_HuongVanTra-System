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
}
