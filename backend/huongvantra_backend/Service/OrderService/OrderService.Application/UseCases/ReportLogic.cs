using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;

namespace OrderService.Application.UseCases;

public class ReportLogic(IReportRepository reportRepository) : IReportLogic
{
    public Task<SalesStatisticsResponse> GetSalesStatisticsAsync(int? month, int? year, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetSalesStatisticsAsync(month, year, cancellationToken);
    }
}
