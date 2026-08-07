namespace InventoryService.Application.DTOs.Responses;

/// <summary>
/// Số lượng của một đơn vị tính, kèm chiều nhập/xuất. Gram và Piece không bao giờ được cộng
/// chung vào một con số duy nhất — mỗi đơn vị là một dòng riêng.
/// </summary>
public sealed record EndOfDayInventoryUnitFlowDto(
    string Unit,
    string UnitLabel,
    int QuantityIn,
    int QuantityOut,
    int NetQuantity,
    int EntryCount);

/// <summary>Số lượng theo đơn vị cho các nghiệp vụ một chiều (điều chuyển, sản xuất).</summary>
public sealed record EndOfDayInventoryUnitQuantityDto(
    string Unit,
    string UnitLabel,
    int Quantity,
    int LineCount);

public sealed record EndOfDayInventoryLedgerRowDto(
    string Location,
    string LocationLabel,
    string TransactionType,
    int EntryCount,
    IReadOnlyList<EndOfDayInventoryUnitFlowDto> ByUnit);

public sealed record EndOfDayInventoryLocationTotalsDto(
    string Location,
    string LocationLabel,
    int EntryCount,
    IReadOnlyList<EndOfDayInventoryUnitFlowDto> ByUnit);

public sealed record EndOfDayInventoryQueueCountsDto(
    int CreatedInPeriod,
    int Waiting,
    int Insufficient,
    int Confirmed,
    int Cancelled);

/// <summary>
/// Tồn cuối kỳ lấy theo trạng thái hiện tại của <c>SkuStocks</c>. Bảng này không lưu đơn vị tính
/// nên không tách được Gram/Piece — xem <c>DataGaps</c>.
/// </summary>
public sealed record EndOfDayInventoryStockSnapshotDto(
    int SkuCount,
    int ShelfQuantityTotal,
    int WarehouseQuantityTotal,
    int ShelfReservedTotal,
    int ShelfAvailableTotal,
    int ShelfLowStockSkuCount,
    int WarehouseLowStockSkuCount);

public sealed record EndOfDayInventorySummaryResponse(
    DateTime FromUtc,
    DateTime ToUtcExclusive,
    string Timezone,
    DateTime GeneratedAtUtc,
    IReadOnlyList<EndOfDayInventoryLedgerRowDto> LedgerByLocationAndType,
    IReadOnlyList<EndOfDayInventoryLocationTotalsDto> LedgerTotalsByLocation,
    EndOfDayInventoryQueueCountsDto Queues,
    int TransfersCompleted,
    IReadOnlyList<EndOfDayInventoryUnitQuantityDto> TransferQuantityByUnit,
    int ProductionOrdersCompleted,
    int SupplierReceiptsCompleted,
    int StocktakesCompleted,
    EndOfDayInventoryStockSnapshotDto EndingStock,
    IReadOnlyList<string> DataGaps);

public sealed record EndOfDayInventoryQueueRowDto(
    Guid QueueId,
    Guid OrderId,
    string OrderCode,
    string QueueStatus,
    string QueueStatusLabel,
    string? CustomerName,
    decimal TotalAmount,
    bool IsDeducted,
    bool IsReserved,
    DateTime CreatedAt,
    DateTime? ConfirmedAt,
    string? ConfirmedByName,
    DateTime? CancelledAt,
    string? CancelledByName,
    string? CancelReason,
    string? LastShortageReason,
    int ItemCount,
    /// <summary>Tổng số lượng dòng hàng của hàng đợi. Bảng hàng đợi không lưu đơn vị tính nên
    /// con số này không tách được Gram/Piece — chỉ dùng để đối chiếu, không dùng làm KPI.</summary>
    int TotalQuantityUnknownUnit);

public sealed record EndOfDayInventoryQueuesResponse(
    IReadOnlyList<EndOfDayInventoryQueueRowDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    EndOfDayInventoryQueueCountsDto Counts,
    IReadOnlyList<string> DataGaps);

public sealed record EndOfDayInventoryTransferRowDto(
    Guid Id,
    string TransferCode,
    string SourceLocation,
    string DestinationLocation,
    string Status,
    DateTime? CompletedAtUtc,
    string? ActorName,
    string? SourceRequestCode,
    int SkuCount,
    IReadOnlyList<EndOfDayInventoryUnitQuantityDto> QuantityByUnit);

public sealed record EndOfDayInventoryTransfersResponse(
    IReadOnlyList<EndOfDayInventoryTransferRowDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    IReadOnlyList<EndOfDayInventoryUnitQuantityDto> TotalsByUnit,
    IReadOnlyList<string> DataGaps);

/// <summary>
/// Lệnh sản xuất hoàn tất trong kỳ — nguồn của hàng đặt làm theo yêu cầu (kịch bản POS-06 số 3).
/// </summary>
public sealed record EndOfDayInventoryCustomOrderRowDto(
    Guid Id,
    string ProductionCode,
    string Status,
    DateTime? CompletedAtUtc,
    string? ActorName,
    string? Note,
    int MaterialLineCount,
    int OutputLineCount,
    /// <summary>Tổng sản lượng kế hoạch của các dòng thành phẩm; bảng này không lưu đơn vị tính.</summary>
    int PlannedOutputQuantityUnknownUnit);

public sealed record EndOfDayInventoryCustomOrdersResponse(
    IReadOnlyList<EndOfDayInventoryCustomOrderRowDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    int TotalOutputLineCount,
    IReadOnlyList<string> DataGaps);
