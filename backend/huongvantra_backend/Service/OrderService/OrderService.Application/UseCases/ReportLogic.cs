using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;

namespace OrderService.Application.UseCases;

public class ReportLogic(IReportRepository reportRepository) : IReportLogic
{
    public Task<SalesStatisticsResponse> GetSalesStatisticsAsync(int? month, int? year, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetSalesStatisticsAsync(month, year, cancellationToken);
    }

    public Task<List<TopProductDto>> GetTopSellingProductsAsync(int topCount, int? month, int? year, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetTopSellingProductsAsync(topCount, month, year, cancellationToken);
    }

    public Task<List<CategorySalesDto>> GetSalesByCategoryAsync(int? month, int? year, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetSalesByCategoryAsync(month, year, cancellationToken);
    }
}
