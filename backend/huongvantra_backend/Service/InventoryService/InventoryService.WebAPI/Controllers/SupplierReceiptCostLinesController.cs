using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.WebAPI.Controllers;

public record SupplierReceiptCostLineResult(
    Guid SourceReceiptId,
    Guid SourceReceiptLineId,
    string ReceiptCode,
    Guid SkuId,
    string SkuCode,
    decimal ActualQuantity,
    decimal UnitCost,
    DateTime ApprovedAt);

public record SupplierReceiptCostLinesResponse(List<SupplierReceiptCostLineResult> Items);

/// <summary>
/// Endpoint nội bộ cho ProductService dựng lại cost basis lịch sử.
/// Chỉ đọc, không tạo side effect tồn kho.
/// </summary>
[ApiController]
[Route("api/v1/inventory/supplier-receipt-cost-lines")]
public class SupplierReceiptCostLinesController(InventoryDbContext _db) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Admin,Manager,Accountant")]
    public async Task<IActionResult> GetApprovedLines(
        [FromQuery] Guid? skuId = null,
        CancellationToken ct = default)
    {
        var query = _db.SupplierReceiptItems.AsNoTracking()
            .Where(item =>
                item.SupplierReceipt != null
                && item.SupplierReceipt.Status == SupplierReceiptStatus.Completed
                && item.SupplierReceipt.ReviewedAt != null
                && item.SupplierReceipt.StockImportSlipId != null
                && item.SubmittedQuantity > 0
                && item.UnitCost != null
                && item.UnitCost > 0);

        if (skuId.HasValue && skuId.Value != Guid.Empty)
            query = query.Where(item => item.SkuId == skuId.Value);

        var items = await query
            .OrderBy(item => item.SupplierReceipt!.ReviewedAt)
            .ThenBy(item => item.SupplierReceipt!.ReceiptCode)
            .ThenBy(item => item.SkuCode)
            .ThenBy(item => item.LotCode)
            .ThenBy(item => item.Id)
            .Select(item => new SupplierReceiptCostLineResult(
                item.SupplierReceiptId,
                item.Id,
                item.SupplierReceipt!.ReceiptCode,
                item.SkuId,
                item.SkuCode,
                item.SubmittedQuantity,
                item.UnitCost!.Value,
                item.SupplierReceipt!.ReviewedAt!.Value))
            .ToListAsync(ct);

        return Ok(new SupplierReceiptCostLinesResponse(items));
    }
}
