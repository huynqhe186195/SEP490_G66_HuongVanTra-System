using InventoryService.Domain.Entities;

namespace InventoryService.Application.Interfaces;

public interface ISupplierProductRepository
{
    Task<SupplierProduct?> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<(List<SupplierProduct> Items, int TotalCount)> GetPagedBySupplierAsync(
        Guid? supplierId,
        string? search,
        string? productType,
        bool includeInactive,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<List<SupplierProduct>> GetActiveBySupplierAsync(Guid supplierId, CancellationToken ct = default);

    Task<List<SupplierProduct>> GetBySkuIdAsync(Guid skuId, CancellationToken ct = default);

    /// <summary>BR-01: một nhà cung cấp chỉ có một bản ghi cho mỗi SKU.</summary>
    Task<bool> ExistsAsync(Guid supplierId, Guid skuId, Guid? excludeId = null, CancellationToken ct = default);

    /// <summary>BR-02: mã hàng nhà cung cấp duy nhất trong phạm vi một nhà cung cấp.</summary>
    Task<bool> NormalizedItemCodeExistsAsync(
        Guid supplierId,
        string normalizedItemCode,
        Guid? excludeId = null,
        CancellationToken ct = default);

    /// <summary>BR-04: mỗi SKU tối đa một nguồn cung chính — bỏ cờ ở mọi bản ghi khác.</summary>
    Task ClearPrimarySourceAsync(Guid skuId, Guid keepId, CancellationToken ct = default);

    Task<List<SupplierProductPriceHistory>> GetPriceHistoryAsync(
        Guid supplierProductId,
        CancellationToken ct = default);

    Task AddAsync(SupplierProduct entity, CancellationToken ct = default);

    Task AddPriceHistoryAsync(SupplierProductPriceHistory entry, CancellationToken ct = default);

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
