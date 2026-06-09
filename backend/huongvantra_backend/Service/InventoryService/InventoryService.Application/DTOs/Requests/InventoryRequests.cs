namespace InventoryService.Application.DTOs.Requests;

public record AdjustSkuStockRequest(int QuantityDelta);

public record CancelStockDeductRequest(string? Reason);
