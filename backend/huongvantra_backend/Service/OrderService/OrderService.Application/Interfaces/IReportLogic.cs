using OrderService.Application.DTOs.Responses;

namespace OrderService.Application.Interfaces;

public interface IReportLogic
{
    Task<SalesStatisticsResponse> GetSalesStatisticsAsync(int? month, int? year, CancellationToken cancellationToken = default);
    Task<List<TopProductDto>> GetTopSellingProductsAsync(int topCount, int? month, int? year, CancellationToken cancellationToken = default);
    Task<List<CategorySalesDto>> GetSalesByCategoryAsync(int? month, int? year, CancellationToken cancellationToken = default);
}
