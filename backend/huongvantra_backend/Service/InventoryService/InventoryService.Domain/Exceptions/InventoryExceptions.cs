namespace InventoryService.Domain.Exceptions;

public class InventoryNotFoundException(string message) : Exception(message);

public class InsufficientStockException(string message, IEnumerable<StockShortage> shortages)
    : Exception(message)
{
    public IReadOnlyList<StockShortage> Shortages { get; } = shortages.ToList();
}

public record StockShortage(
    Guid SkuId,
    string SkuName,
    int RequiredQuantity,
    int AvailableQuantity,
    int ShortageQuantity);
