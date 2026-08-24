namespace InventoryService.Domain.Entities;

public class Supplier
{
    public Guid Id { get; set; }
    public string SupplierCode { get; set; } = string.Empty;
    /// <summary>Bản upper-case của SupplierCode — cột duy nhất tham gia unique index, để so sánh case-insensitive không phụ thuộc collation toàn cục.</summary>
    public string NormalizedSupplierCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    /// <summary>Mã số thuế (tuỳ chọn).</summary>
    public string? TaxCode { get; set; }
    /// <summary>Điều khoản thanh toán (tuỳ chọn), ví dụ: Net 30, COD…</summary>
    public string? PaymentTerms { get; set; }
    public string? Note { get; set; }
    public bool IsDeleted { get; set; } = false;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
