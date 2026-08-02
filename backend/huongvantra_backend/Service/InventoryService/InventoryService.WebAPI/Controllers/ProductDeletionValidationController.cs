using HuongVanTra.Shared.Auth;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.WebAPI.Controllers;

public record ProductDeletionValidationRequest(List<Guid> SkuIds);

public record SkuDeletionValidationResult(
    Guid SkuId,
    string? SkuCode,
    int WarehouseQuantityOnHand,
    int QuantityOnHand,
    int ActiveProductionOrderCount,
    int PendingStockDeductQueueCount,
    int PendingStockAdjustmentRequestCount,
    List<string> BlockingReasons);

public record ProductDeletionValidationResponse(List<SkuDeletionValidationResult> Items);

[ApiController]
[Route("api/v1/inventory/product-deletion-validation")]
public class ProductDeletionValidationController(InventoryDbContext _db) : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = PermissionNames.ViewProductRequest)]
    public async Task<IActionResult> Validate([FromBody] ProductDeletionValidationRequest request, CancellationToken ct = default)
    {
        var skuIds = (request.SkuIds ?? [])
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        if (skuIds.Count == 0)
            return Ok(new ProductDeletionValidationResponse([]));

        var stocks = await _db.SkuStocks.AsNoTracking()
            .Where(stock => skuIds.Contains(stock.SkuId))
            .ToListAsync(ct);

        var activeProductionStatuses = new[]
        {
            ProductionOrderStatus.Draft,
            ProductionOrderStatus.PendingApproval,
            ProductionOrderStatus.Approved,
            ProductionOrderStatus.Rejected,
        };

        var activeProductionCounts = await _db.ProductionOrders.AsNoTracking()
            .Where(order => activeProductionStatuses.Contains(order.Status))
            .SelectMany(order => order.Lines.Select(line => new { line.MaterialSkuId, order.Id })
                .Concat(order.OutputLines.Select(line => new { MaterialSkuId = line.FinishedSkuId, order.Id })))
            .Where(row => skuIds.Contains(row.MaterialSkuId))
            .GroupBy(row => row.MaterialSkuId)
            .Select(group => new { SkuId = group.Key, Count = group.Select(row => row.Id).Distinct().Count() })
            .ToDictionaryAsync(row => row.SkuId, row => row.Count, ct);

        var pendingQueueCounts = await _db.StockDeductQueueItems.AsNoTracking()
            .Where(item => skuIds.Contains(item.SkuId)
                && (item.Queue.QueueStatus == QueueStatus.Waiting || item.Queue.QueueStatus == QueueStatus.Insufficient))
            .GroupBy(item => item.SkuId)
            .Select(group => new { SkuId = group.Key, Count = group.Select(item => item.QueueId).Distinct().Count() })
            .ToDictionaryAsync(row => row.SkuId, row => row.Count, ct);

        var pendingAdjustmentCounts = await _db.StockAdjustmentRequestItems.AsNoTracking()
            .Where(item => skuIds.Contains(item.SkuId)
                && item.Request != null
                && item.Request.Status == StockAdjustmentRequestStatus.Pending)
            .GroupBy(item => item.SkuId)
            .Select(group => new { SkuId = group.Key, Count = group.Select(item => item.RequestId).Distinct().Count() })
            .ToDictionaryAsync(row => row.SkuId, row => row.Count, ct);

        var stockBySkuId = stocks.ToDictionary(stock => stock.SkuId);
        var items = skuIds.Select(skuId =>
        {
            stockBySkuId.TryGetValue(skuId, out var stock);
            activeProductionCounts.TryGetValue(skuId, out var productionCount);
            pendingQueueCounts.TryGetValue(skuId, out var queueCount);
            pendingAdjustmentCounts.TryGetValue(skuId, out var adjustmentCount);

            var reasons = new List<string>();
            var warehouseQuantity = stock?.WarehouseQuantityOnHand ?? 0;
            var shelfQuantity = stock?.QuantityOnHand ?? 0;
            if (warehouseQuantity > 0) reasons.Add($"Còn tồn Kho: {warehouseQuantity}.");
            if (shelfQuantity > 0) reasons.Add($"Còn tồn Kệ Hàng: {shelfQuantity}.");
            if (productionCount > 0) reasons.Add($"Đang được tham chiếu bởi {productionCount} ProductionOrder chưa hoàn tất.");
            if (queueCount > 0) reasons.Add($"Đang có {queueCount} StockDeductQueue chưa xử lý.");
            if (adjustmentCount > 0) reasons.Add($"Đang có {adjustmentCount} StockAdjustmentRequest đang chờ duyệt.");

            return new SkuDeletionValidationResult(
                skuId,
                stock?.SkuCode,
                warehouseQuantity,
                shelfQuantity,
                productionCount,
                queueCount,
                adjustmentCount,
                reasons);
        }).ToList();

        return Ok(new ProductDeletionValidationResponse(items));
    }
}
