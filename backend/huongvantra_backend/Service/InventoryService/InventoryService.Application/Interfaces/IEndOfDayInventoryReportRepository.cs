using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.DTOs.Responses;

namespace InventoryService.Application.Interfaces;

/// <summary>
/// Truy vấn phần Kho/Kệ của Báo cáo cuối ngày. Tách khỏi
/// <see cref="IWarehouseDailyReportRepository"/> để báo cáo thủ kho hiện tại không đổi hành vi.
/// </summary>
public interface IEndOfDayInventoryReportRepository
{
    Task<EndOfDayInventorySummaryResponse> GetSummaryAsync(
        EndOfDayInventoryFilter filter, CancellationToken ct = default);

    Task<EndOfDayInventoryQueuesResponse> GetQueuesAsync(
        EndOfDayInventoryPagedFilter filter, CancellationToken ct = default);

    Task<EndOfDayInventoryTransfersResponse> GetTransfersAsync(
        EndOfDayInventoryPagedFilter filter, CancellationToken ct = default);

    Task<EndOfDayInventoryCustomOrdersResponse> GetCustomOrdersAsync(
        EndOfDayInventoryPagedFilter filter, CancellationToken ct = default);
}
