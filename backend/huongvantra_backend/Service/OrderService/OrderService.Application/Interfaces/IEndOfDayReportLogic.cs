using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;

namespace OrderService.Application.Interfaces;

public interface IEndOfDayReportLogic
{
    Task<EndOfDaySummaryResponse> GetSummaryAsync(EndOfDayReportFilter filter, CancellationToken ct = default);
    Task<EndOfDaySalesResponse> GetSalesAsync(EndOfDayPagedFilter filter, CancellationToken ct = default);
    Task<EndOfDayPaymentsResponse> GetPaymentsAsync(EndOfDayPagedFilter filter, CancellationToken ct = default);
    Task<EndOfDayProductsResponse> GetProductsAsync(EndOfDayPagedFilter filter, CancellationToken ct = default);
    Task<EndOfDayExceptionsResponse> GetExceptionsAsync(EndOfDayPagedFilter filter, CancellationToken ct = default);
}
