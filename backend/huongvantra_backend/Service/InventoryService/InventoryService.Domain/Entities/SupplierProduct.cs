namespace InventoryService.Domain.Entities;

/// <summary>
/// Danh mục sản phẩm/nguyên liệu mà một nhà cung cấp có thể cung cấp.
/// SkuId là tham chiếu lỏng sang ProductService (DB khác) nên chỉ đánh index, không khoá ngoại.
/// </summary>
public class SupplierProduct
{
    public Guid Id { get; set; }
    public Guid SupplierId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCodeSnapshot { get; set; } = string.Empty;
    public string SkuNameSnapshot { get; set; } = string.Empty;
    public string ProductTypeSnapshot { get; set; } = string.Empty;
    public string InventoryUnitSnapshot { get; set; } = string.Empty;
    public string? SupplierItemCode { get; set; }
    /// <summary>Bản upper-case của SupplierItemCode — cột duy nhất tham gia unique index cùng SupplierId.</summary>
    public string? NormalizedSupplierItemCode { get; set; }
    public string? SupplierItemName { get; set; }
    /// <summary>Giá chào của nhà cung cấp. TUYỆT ĐỐI không dùng để ghi giá vốn SKU.</summary>
    public decimal? QuotedPrice { get; set; }
    public int? MinimumOrderQuantity { get; set; }
    public int? LeadTimeDays { get; set; }
    public bool IsPrimarySource { get; set; }
    public string? Note { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Supplier? Supplier { get; set; }
}
