using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Interfaces;

public interface IStockTransferRepository
{
    Task<StockTransfer?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<StockTransfer?> GetTrackedByIdAsync(Guid id, CancellationToken ct = default);
    Task<(List<StockTransfer> Items, int TotalCount)> GetPagedAsync(
        StockTransferStatus? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default,
        Guid? sourceRequestId = null,
        string? transferType = null,
        Guid? createdBy = null,
        DateTime? fromDateUtc = null,
        DateTime? toDateUtc = null,
        string? sort = null);
    /// <summary>Đếm theo Status với cùng filter list, bỏ status.</summary>
    Task<Dictionary<string, int>> CountByStatusAsync(
        string? search,
        CancellationToken ct = default,
        Guid? sourceRequestId = null,
        string? transferType = null,
        Guid? createdBy = null,
        DateTime? fromDateUtc = null,
        DateTime? toDateUtc = null);
    Task<bool> TryLockDraftForUpdateAsync(Guid id, DateTime updatedAt, CancellationToken ct = default);
    Task<bool> TryClaimDraftForCompletionAsync(Guid id, DateTime claimedAt, CancellationToken ct = default);
    Task<bool> TryCancelDraftAsync(
        Guid id,
        Guid cancelledBy,
        DateTime cancelledAt,
        string reason,
        CancellationToken ct = default);
    Task AddAsync(StockTransfer transfer, CancellationToken ct = default);
    /// <summary>
    /// Đăng ký dòng SKU mới cho một Phiếu điều chuyển đang được theo dõi.
    /// Khóa chính Guid được gán ở tầng ứng dụng nên phải Add tường minh; nếu chỉ thêm vào
    /// navigation, EF Core coi bản ghi là Modified và sinh UPDATE trên dòng chưa tồn tại.
    /// </summary>
    Task AddLinesAsync(IEnumerable<StockTransferLine> lines, CancellationToken ct = default);
    /// <summary>
    /// Đăng ký bản ghi phân bổ lô mới cho một Phiếu điều chuyển đang được theo dõi.
    /// Lý do Add tường minh giống <see cref="AddLinesAsync"/>.
    /// </summary>
    Task AddBatchAllocationsAsync(
        IEnumerable<StockTransferBatchAllocation> allocations,
        CancellationToken ct = default);
    /// <summary>
    /// Tổng số lượng đang nằm trên các Phiếu điều chuyển Draft của cùng một Yêu cầu bổ sung Kệ Hàng,
    /// nhóm theo dòng yêu cầu nguồn. Dùng để chặn tạo phiếu vượt quá số lượng yêu cầu.
    /// </summary>
    Task<Dictionary<Guid, int>> GetDraftQuantitiesBySourceRequestAsync(
        Guid sourceRequestId,
        Guid? excludeTransferId,
        CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
