using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.UseCases;

public class ReportLogic(IReportRepository reportRepository) : IReportLogic
{
    public Task<SalesStatisticsResponse> GetSalesStatisticsAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetSalesStatisticsAsync(quarter, month, year, employeeId, cancellationToken);
    }

    public Task<List<TopProductDto>> GetTopSellingProductsAsync(int topCount, string sortBy, int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default)
    {
        if (topCount is < 1 or > 100)
            throw new OrderValidationException("Số lượng sản phẩm top phải từ 1 đến 100.");
        if (!string.Equals(sortBy, "revenue", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(sortBy, "quantity", StringComparison.OrdinalIgnoreCase))
            throw new OrderValidationException("Kiểu sắp xếp phải là revenue hoặc quantity.");
        if (quarter is < 1 or > 4)
            throw new OrderValidationException("Quý phải từ 1 đến 4.");
        if (month is < 1 or > 12)
            throw new OrderValidationException("Tháng phải từ 1 đến 12.");

        return reportRepository.GetTopSellingProductsAsync(topCount, sortBy, quarter, month, year, employeeId, cancellationToken);
    }

    public Task<List<CategorySalesDto>> GetSalesByCategoryAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetSalesByCategoryAsync(quarter, month, year, employeeId, cancellationToken);
    }

    public Task<List<TimeSeriesPointDto>> GetCustomerGrowthTimeSeriesAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetCustomerGrowthTimeSeriesAsync(quarter, month, year, employeeId, cancellationToken);
    }

    public Task<List<TimeSeriesPointDto>> GetRevenueTimeSeriesAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetRevenueTimeSeriesAsync(quarter, month, year, employeeId, cancellationToken);
    }

    public Task<List<RevenueProfitTimeSeriesPointDto>> GetRevenueProfitTimeSeriesAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetRevenueProfitTimeSeriesAsync(quarter, month, year, employeeId, cancellationToken);
    }

    public Task<List<CategorySalesDto>> GetSalesByChannelAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetSalesByChannelAsync(quarter, month, year, employeeId, cancellationToken);
    }

    public Task<List<TimeSeriesPointDto>> GetOrderCountTimeSeriesAsync(int? quarter, int? month, int? year, Guid? employeeId = null, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetOrderCountTimeSeriesAsync(quarter, month, year, employeeId, cancellationToken);
    }

    public Task<DailyCashReconciliationResponse> GetDailyCashReconciliationAsync(DailyReportFilter filter, CancellationToken cancellationToken = default)
    {
        return reportRepository.GetDailyCashReconciliationAsync(filter, cancellationToken);
    }
}
