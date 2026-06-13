using OrderService.Application.DTOs.Responses;

namespace OrderService.Application.Interfaces;

public interface IReportRepository
{
    Task<SalesStatisticsResponse> GetSalesStatisticsAsync(int? quarter, int? month, int? year, CancellationToken ct = default);
    Task<List<TopProductDto>> GetTopSellingProductsAsync(int topCount, int? quarter, int? month, int? year, CancellationToken ct = default);
    Task<List<CategorySalesDto>> GetSalesByCategoryAsync(int? quarter, int? month, int? year, CancellationToken ct = default);
}
