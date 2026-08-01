namespace InventoryService.Domain.Entities;

/// <summary>
/// Một SKU dưới ngưỡng trong gợi ý bổ sung Kệ Hàng.
/// Chỉ chụp lại hiện trạng tồn Kệ / ngưỡng / tồn Kho tại thời điểm duyệt kiểm kệ.
/// </summary>
public class ShelfReplenishmentSuggestionItem
{
    public Guid Id { get; set; }
    public Guid SuggestionId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuSnapshotName { get; set; } = string.Empty;
    public string? InventoryUnitSnapshot { get; set; }

    public int ShelfQuantityAtStocktake { get; set; }
    public int ShelfReservedAtStocktake { get; set; }
    public int ShelfLowStockThreshold { get; set; }
    public int WarehouseQuantityAtStocktake { get; set; }

    public ShelfReplenishmentSuggestion? Suggestion { get; set; }
}
