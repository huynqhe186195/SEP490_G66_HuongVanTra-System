using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;

namespace OrderService.Application.UseCases;

/// <summary>
/// Tầng nghiệp vụ của Báo cáo cuối ngày. Việc quy đổi ngày GMT+7 sang UTC và giới hạn
/// phạm vi theo quyền đã làm ở controller; ở đây chỉ chuyển tiếp xuống repository.
/// </summary>
public class EndOfDayReportLogic(IEndOfDayReportRepository repository) : IEndOfDayReportLogic
{
    public Task<EndOfDaySummaryResponse> GetSummaryAsync(EndOfDayReportFilter filter, CancellationToken ct = default)
        => repository.GetSummaryAsync(filter, ct);

    public Task<EndOfDaySalesResponse> GetSalesAsync(EndOfDayPagedFilter filter, CancellationToken ct = default)
        => repository.GetSalesAsync(filter, ct);

    public Task<EndOfDayPaymentsResponse> GetPaymentsAsync(EndOfDayPagedFilter filter, CancellationToken ct = default)
        => repository.GetPaymentsAsync(filter, ct);

    public Task<EndOfDayProductsResponse> GetProductsAsync(EndOfDayPagedFilter filter, CancellationToken ct = default)
        => repository.GetProductsAsync(filter, ct);

    public Task<EndOfDayExceptionsResponse> GetExceptionsAsync(EndOfDayPagedFilter filter, CancellationToken ct = default)
        => repository.GetExceptionsAsync(filter, ct);
}
