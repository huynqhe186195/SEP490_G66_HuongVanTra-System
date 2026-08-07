using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.Interfaces;

namespace InventoryService.Application.UseCases;

/// <summary>
/// Báo cáo cuối ngày phần Kho/Kệ. Lớp này chỉ chuyển tiếp sang repository — mọi phép gộp đều
/// thực hiện dưới DB. Quy đổi ngày làm việc GMT+7 sang UTC dùng lại
/// <see cref="WarehouseDailyReportLogic.ToUtcDayRange"/> để hai báo cáo không lệch mốc ngày.
/// </summary>
public sealed class EndOfDayInventoryReportLogic(IEndOfDayInventoryReportRepository _repo)
{
    public Task<EndOfDayInventorySummaryResponse> GetSummaryAsync(
        EndOfDayInventoryFilter filter, CancellationToken ct = default) =>
        _repo.GetSummaryAsync(filter, ct);

    public Task<EndOfDayInventoryQueuesResponse> GetQueuesAsync(
        EndOfDayInventoryPagedFilter filter, CancellationToken ct = default) =>
        _repo.GetQueuesAsync(filter, ct);

    public Task<EndOfDayInventoryTransfersResponse> GetTransfersAsync(
        EndOfDayInventoryPagedFilter filter, CancellationToken ct = default) =>
        _repo.GetTransfersAsync(filter, ct);

    public Task<EndOfDayInventoryCustomOrdersResponse> GetCustomOrdersAsync(
        EndOfDayInventoryPagedFilter filter, CancellationToken ct = default) =>
        _repo.GetCustomOrdersAsync(filter, ct);
}
