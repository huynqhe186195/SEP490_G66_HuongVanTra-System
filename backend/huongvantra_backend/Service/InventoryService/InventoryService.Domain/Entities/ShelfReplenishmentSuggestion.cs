using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

/// <summary>
/// Gợi ý bổ sung Kệ Hàng sinh tự động sau khi duyệt phiếu kiểm kệ.
/// Chỉ ghi nhận hiện trạng tồn tại thời điểm kiểm, không tính số lượng cần bổ sung;
/// Warehouse tự quyết định số lượng khi tạo phiếu điều chuyển.
/// </summary>
public class ShelfReplenishmentSuggestion
{
    public Guid Id { get; set; }
    public string SuggestionCode { get; set; } = string.Empty;

    /// <summary>Phiếu kiểm kệ nguồn; unique để duyệt lại không sinh trùng gợi ý.</summary>
    public Guid SourceStocktakeRequestId { get; set; }
    public string SourceStocktakeCode { get; set; } = string.Empty;

    public ShelfReplenishmentSuggestionStatus Status { get; set; } = ShelfReplenishmentSuggestionStatus.Open;
    public DateTime CreatedAt { get; set; }

    public Guid? HandledBy { get; set; }
    public string? HandledByName { get; set; }
    public string? HandledByRoleName { get; set; }
    public DateTime? HandledAt { get; set; }
    public string? HandledNote { get; set; }

    public StocktakeRequest? SourceStocktakeRequest { get; set; }
    public ICollection<ShelfReplenishmentSuggestionItem> Items { get; set; } = new List<ShelfReplenishmentSuggestionItem>();
}
