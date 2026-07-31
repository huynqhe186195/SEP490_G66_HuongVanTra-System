using InventoryService.Domain.Entities;

namespace InventoryService.Application.Interfaces;

public interface IWarehouseBatchRepository
{
    Task<WarehouseBatch?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<WarehouseBatch?> GetByBatchCodeAsync(string batchCode, CancellationToken ct = default);
    Task<WarehouseBatch?> GetByLotCodeAsync(string lotCode, CancellationToken ct = default);

    /// <summary>
    /// Tìm lô NCC theo khóa nghiệp vụ SupplierId + SkuId + mã lô đã chuẩn hóa.
    /// Trả về lô đang tồn tại để tái sử dụng thay vì tạo lô trùng.
    /// </summary>
    Task<WarehouseBatch?> FindBySupplierLotIdentityAsync(
        Guid supplierId,
        Guid skuId,
        string normalizedSupplierLotCode,
        CancellationToken ct = default);
    Task<List<WarehouseBatch>> GetListAsync(Guid? skuId, string? search, bool availableOnly, CancellationToken ct = default);
    Task<List<WarehouseBatchItem>> GetAvailableItemsForSkuAsync(Guid skuId, CancellationToken ct = default);
    Task<List<WarehouseBatchItem>> GetAvailableItemsForSkuAsync(Guid skuId, string location, CancellationToken ct = default);
    Task<bool> ExistsBatchCodeAsync(string batchCode, Guid? excludeId = null, CancellationToken ct = default);
    Task<bool> ExistsLotCodeAsync(string lotCode, Guid? excludeId = null, CancellationToken ct = default);
    Task<int> SumQuantityOnHandAsync(Guid skuId, CancellationToken ct = default);
    Task<int> SumQuantityOnHandAsync(Guid skuId, string location, CancellationToken ct = default);
    Task<decimal> CalculateMovingAverageCostAsync(Guid skuId, CancellationToken ct = default);

    /// <summary>
    /// Tổng tồn còn lại theo từng lô, đọc thẳng từ database và không phụ thuộc navigation đã nạp.
    /// Dùng khi cần biết một lô nhiều SKU đã cạn thật hay chưa; navigation Items của lô chỉ chứa
    /// các dòng mà truy vấn trước đó nạp vào nên không đủ để kết luận.
    /// </summary>
    Task<Dictionary<Guid, int>> GetQuantitySumsByBatchAsync(
        IEnumerable<Guid> batchIds,
        CancellationToken ct = default);
    Task<Dictionary<Guid, int>> GetQuantitySumsBySkuAsync(CancellationToken ct = default);
    Task<int> CountActiveLotsForSkuAsync(Guid skuId, CancellationToken ct = default);
    Task<decimal> CalculateTotalWarehouseValueAsync(CancellationToken ct = default);
    Task AddAsync(WarehouseBatch batch, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
