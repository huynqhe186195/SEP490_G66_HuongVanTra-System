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

        // Keep the two navigations as separate SQL queries. A correlated Concat here
        // becomes CROSS APPLY, which MySQL/Pomelo cannot translate at runtime.
        var activeMaterialReferences = await _db.ProductionOrderLines.AsNoTracking()
            .Where(line => line.Order != null
                && activeProductionStatuses.Contains(line.Order.Status)
                && skuIds.Contains(line.MaterialSkuId))
            .Select(line => new { SkuId = line.MaterialSkuId, OrderId = line.ProductionOrderId })
            .Distinct()
            .ToListAsync(ct);

        var activeOutputReferences = await _db.ProductionOrderOutputLines.AsNoTracking()
            .Where(line => line.Order != null
                && activeProductionStatuses.Contains(line.Order.Status)
                && skuIds.Contains(line.FinishedSkuId))
            .Select(line => new { SkuId = line.FinishedSkuId, OrderId = line.ProductionOrderId })
            .Distinct()
            .ToListAsync(ct);

        var activeProductionCounts = activeMaterialReferences
            .Concat(activeOutputReferences)
            .GroupBy(row => row.SkuId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(row => row.OrderId).Distinct().Count());

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
