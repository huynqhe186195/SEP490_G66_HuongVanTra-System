using OrderService.Application.DTOs.Responses;

namespace OrderService.Application.Interfaces;

public interface IReportRepository
{
    Task<SalesStatisticsResponse> GetSalesStatisticsAsync(int? month, int? year, CancellationToken ct = default);
    Task<List<TopProductDto>> GetTopSellingProductsAsync(int topCount, int? month, int? year, CancellationToken ct = default);
}
