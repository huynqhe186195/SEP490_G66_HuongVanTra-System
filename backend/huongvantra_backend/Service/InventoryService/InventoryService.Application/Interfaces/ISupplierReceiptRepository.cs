using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Interfaces;

public sealed record SupplierReceiptApprovalContext(
    SupplierReceiptStatus Status,
    Guid CreatedBy,
    IReadOnlyList<Guid> SkuIds);

/// <summary>Thống kê phiếu nhập đã hoàn tất của một nhà cung cấp. Phiếu nháp/chờ duyệt/bị từ chối/đã huỷ không tính.</summary>
public sealed record SupplierReceiptStats(int Count, decimal TotalValue);

public interface ISupplierReceiptRepository
{
    Task<SupplierReceipt?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<SupplierReceiptApprovalContext?> GetApprovalContextAsync(
        Guid id,
        CancellationToken ct = default);
    Task<(List<SupplierReceipt> Items, int TotalCount)> GetPagedAsync(
        SupplierReceiptStatus? status,
        Guid? createdBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<Dictionary<string, int>> CountByStatusAsync(
        Guid? createdBy,
        string? search,
        CancellationToken ct = default);
    Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default);
    Task<SupplierReceiptStats> GetStatsBySupplierIdAsync(Guid supplierId, CancellationToken ct = default);
    Task<SupplierReceipt?> FindDuplicateDocumentAsync(Guid? supplierId, string? supplierDocumentNumber, Guid? excludeId, CancellationToken ct = default);
    Task AddAsync(SupplierReceipt receipt, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
