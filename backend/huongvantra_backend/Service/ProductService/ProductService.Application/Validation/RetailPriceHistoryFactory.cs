using ProductService.Domain.Entities;

namespace ProductService.Application.Validation;

/// <summary>
/// Append-only retail price history: never update/delete existing rows.
/// Returns null when old and new prices are equal after rounding.
/// </summary>
public static class RetailPriceHistoryFactory
{
    public const string SourceManualAccounting = "manual_admin_accounting";
    public const string SourceProductCatalogUpdate = "product_catalog_update";
    public const string SourceApprovedPriceChangeRequest = "approved_price_change_request";

    public static ProductRetailPriceHistory? TryCreate(
        Guid skuId,
        decimal oldRetailPrice,
        decimal newRetailPrice,
        Guid? changedBy,
        string? changedByName,
        string sourceType,
        string? note = null,
        DateTime? changedAtUtc = null)
    {
        if (skuId == Guid.Empty)
            return null;

        var normalizedOld = Math.Round(oldRetailPrice, 2, MidpointRounding.AwayFromZero);
        var normalizedNew = Math.Round(newRetailPrice, 2, MidpointRounding.AwayFromZero);
        if (normalizedOld == normalizedNew)
            return null;

        var name = string.IsNullOrWhiteSpace(changedByName) ? null : changedByName.Trim();
        var source = string.IsNullOrWhiteSpace(sourceType)
            ? SourceManualAccounting
            : sourceType.Trim();

        return new ProductRetailPriceHistory
        {
            Id = Guid.NewGuid(),
            SkuId = skuId,
            OldRetailPrice = normalizedOld,
            NewRetailPrice = normalizedNew,
            ChangedBy = changedBy is { } id && id != Guid.Empty ? id : null,
            ChangedByName = name,
            ChangedAt = changedAtUtc ?? DateTime.UtcNow,
            SourceType = source,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim()
        };
    }
}
