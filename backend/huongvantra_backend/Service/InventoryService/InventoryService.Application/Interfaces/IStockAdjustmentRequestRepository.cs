using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Interfaces;

public interface IStockAdjustmentRequestRepository
{
    Task<StockAdjustmentRequest?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<StockAdjustmentRequest>> GetListAsync(
        StockAdjustmentRequestStatus? status,
        Guid? requestedBy,
        string? search,
        CancellationToken ct = default);
    Task<(List<StockAdjustmentRequest> Items, int TotalCount)> GetPagedAsync(
        StockAdjustmentRequestStatus? status,
        bool excludePending,
        Guid? requestedBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default,
        string? creatorRole = null,
        DateTime? fromDateUtc = null,
        DateTime? toDateUtc = null,
        bool onlyRemaining = false,
        string? sort = null);
    /// <summary>Số lượng khớp từng chip của danh sách Yêu cầu bổ sung, không áp dụng chip trạng thái đang chọn.</summary>
    Task<Dictionary<string, int>> CountQuickFiltersAsync(
        Guid? requestedBy,
        string? search,
        string? creatorRole = null,
        DateTime? fromDateUtc = null,
        DateTime? toDateUtc = null,
        CancellationToken ct = default);
    /// <summary>
    /// Danh sách vai trò người tạo đã xuất hiện trong dữ liệu, dùng để đổ tùy chọn bộ lọc
    /// mà không cần gọi UserService.
    /// </summary>
    Task<List<string>> GetCreatorRolesAsync(CancellationToken ct = default);
    /// <summary>Danh sách người tạo (id kèm tên snapshot) đã xuất hiện trong dữ liệu.</summary>
    Task<List<(Guid Id, string? Name, string? RoleName)>> GetCreatorsAsync(CancellationToken ct = default);
    Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default);
    /// <summary>
    /// Các dòng yêu cầu chưa xử lý xong của những SKU truyền vào, kèm phiếu cha.
    /// Dùng để chặn gửi trùng SKU khi yêu cầu trước đó còn treo.
    /// </summary>
    Task<List<StockAdjustmentRequestItem>> GetOpenItemsBySkuIdsAsync(
        IEnumerable<Guid> skuIds,
        CancellationToken ct = default);
    /// <summary>Các Phiếu điều chuyển Kho → Kệ đã sinh ra từ một Yêu cầu bổ sung Kệ Hàng.</summary>
    Task<List<StockTransfer>> GetTransfersBySourceRequestAsync(Guid requestId, CancellationToken ct = default);
    /// <summary>
    /// Tổng số lượng đang bị giữ trên các Phiếu điều chuyển Nháp, gom theo Id dòng yêu cầu.
    /// Dùng để tính AvailableToTransferQuantity = ApprovedQuantity - FulfilledQuantity - DraftReservedQuantity.
    /// </summary>
    Task<Dictionary<Guid, int>> GetDraftReservedQuantitiesAsync(
        IEnumerable<Guid> requestIds,
        CancellationToken ct = default);
    Task AddAsync(StockAdjustmentRequest request, CancellationToken ct = default);
    /// <summary>
    /// Sinh RequestCode theo ngày rồi lưu, thử lại khi hai người gửi cùng lúc trùng mã.
    /// Mã được gán vào entity trước khi trả về.
    /// </summary>
    Task AddWithGeneratedCodeAsync(StockAdjustmentRequest request, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
