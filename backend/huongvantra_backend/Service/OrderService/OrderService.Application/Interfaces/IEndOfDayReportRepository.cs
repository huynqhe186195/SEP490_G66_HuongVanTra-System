using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;

namespace OrderService.Application.Interfaces;

/// <summary>
/// Truy vấn cho Báo cáo cuối ngày. Tách khỏi <see cref="IReportRepository"/> để các endpoint
/// thống kê cũ giữ nguyên hành vi.
/// </summary>
public interface IEndOfDayReportRepository
{
    Task<EndOfDaySummaryResponse> GetSummaryAsync(EndOfDayReportFilter filter, CancellationToken ct = default);
    Task<EndOfDaySalesResponse> GetSalesAsync(EndOfDayPagedFilter filter, CancellationToken ct = default);
    Task<EndOfDayPaymentsResponse> GetPaymentsAsync(EndOfDayPagedFilter filter, CancellationToken ct = default);
    Task<EndOfDayProductsResponse> GetProductsAsync(EndOfDayPagedFilter filter, CancellationToken ct = default);
    Task<EndOfDayExceptionsResponse> GetExceptionsAsync(EndOfDayPagedFilter filter, CancellationToken ct = default);
}
