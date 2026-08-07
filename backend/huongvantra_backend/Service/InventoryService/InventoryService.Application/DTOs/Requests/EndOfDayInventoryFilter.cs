using InventoryService.Domain.Enums;

namespace InventoryService.Application.DTOs.Requests;

/// <summary>
/// Bộ lọc Báo cáo cuối ngày phần Kho/Kệ. Khoảng thời gian đã được controller quy đổi từ ngày
/// làm việc GMT+7 sang UTC theo quy ước nửa mở <c>[FromUtc, ToUtcExclusive)</c> — giống
/// <see cref="InventoryService.Application.UseCases.WarehouseDailyReportLogic"/>.
/// </summary>
public class EndOfDayInventoryFilter
{
    public DateTime FromUtc { get; set; }
    public DateTime ToUtcExclusive { get; set; }

    /// <summary>Null = cả Kho và Kệ. Tab báo cáo là "Kho/Kệ" nên mặc định không giới hạn.</summary>
    public InventoryLocation? Location { get; set; }
}

public class EndOfDayInventoryPagedFilter : EndOfDayInventoryFilter
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;

    /// <summary>Chỉ dùng cho endpoint queues.</summary>
    public QueueStatus? QueueStatus { get; set; }
}
