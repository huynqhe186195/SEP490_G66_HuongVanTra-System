using Microsoft.Extensions.Logging;
using ProductService.Application.Interfaces;
using ProductService.Infrastructure.Messaging;

namespace ProductService.Infrastructure.Services;

public record CostBasisReconciliationResult(
    int SkuProcessedCount,
    int SkuUpdatedCount,
    int SkuSkippedNoDataCount,
    string Source,
    int ReevaluatedGroupCount = 0,
    int DeferredGroupCount = 0);

/// <summary>
/// Dựng lại cumulative cost basis (TotalApprovedInboundQuantity/Value và CostPrice)
/// cho ProductVariant.
///
/// Nguồn authoritative duy nhất: approved Supplier Receipt lines của InventoryService,
/// đọc qua HTTP endpoint. KHÔNG đọc trực tiếp database InventoryService.
/// KHÔNG trộn ProductCostPriceHistory vào phép tính — history chỉ là audit trail;
/// trộn một phần Product history với một phần Inventory history sẽ double-count.
///
/// Mỗi SKU được recompute toàn bộ (replace snapshot, không cộng dồn) trong
/// transaction có SKU lock, nên idempotent: chạy lại nhiều lần cho cùng kết quả.
/// Không giả lập baseline từ tồn kho hiện tại, không xóa lịch sử cũ,
/// không tạo side effect tồn kho/outbox/approval.
/// </summary>
public interface ICostBasisReconciliationService
{
    Task<CostBasisReconciliationResult> ReconcileAsync(
        Guid? skuId,
        string? bearerToken,
        CancellationToken ct = default);
}

public sealed class CostBasisReconciliationService(
    ISupplierReceiptCostStore store,
    IInventorySupplierReceiptCostClient inventoryClient,
    SupplierReceiptApprovedCostRecordedConsumer costConsumer,
    ILogger<CostBasisReconciliationService> logger)
    : ICostBasisReconciliationService
{
    private const string AuthoritativeSource = "inventory_http";

    public async Task<CostBasisReconciliationResult> ReconcileAsync(
        Guid? skuId,
        string? bearerToken,
        CancellationToken ct = default)
    {
        var singleSkuId = skuId.HasValue && skuId.Value != Guid.Empty
            ? skuId.Value
            : (Guid?)null;
        var targetSkuIds = singleSkuId.HasValue
            ? [singleSkuId.Value]
            : await store.GetActiveVariantIdsAsync(ct);

        // Một lần đọc duy nhất từ nguồn authoritative, rồi gom theo SKU.
        var remote = await inventoryClient.GetApprovedLinesAsync(singleSkuId, bearerToken, ct);
        var targets = targetSkuIds.ToHashSet();
        var totalsBySku = new Dictionary<Guid, (decimal Quantity, decimal Value)>();
        var reconciledLineIdsBySku = new Dictionary<Guid, HashSet<Guid>>();

        foreach (var line in remote.Items)
        {
            if (!targets.Contains(line.SkuId)
                || line.ActualQuantity <= 0
                || line.UnitCost <= 0)
            {
                continue;
            }

            totalsBySku.TryGetValue(line.SkuId, out var current);
            totalsBySku[line.SkuId] = (
                current.Quantity + line.ActualQuantity,
                current.Value + line.ActualQuantity * line.UnitCost);

            if (!reconciledLineIdsBySku.TryGetValue(line.SkuId, out var lineIds))
            {
                lineIds = [];
                reconciledLineIdsBySku[line.SkuId] = lineIds;
            }
            lineIds.Add(line.SourceReceiptLineId);
        }

        var updated = 0;
        var skipped = 0;
        var reevaluated = 0;
        var deferred = 0;

        foreach (var target in targetSkuIds)
        {
            if (!totalsBySku.TryGetValue(target, out var totals)
                || totals.Quantity <= 0
                || totals.Value <= 0)
            {
                skipped++;
                continue;
            }

            var applied = false;
            await store.ExecuteReadCommittedAsync(async innerCt =>
            {
                var variant = await store.LockVariantAsync(target, innerCt);
                if (variant is null)
                    return;

                var newCostPrice = SupplierReceiptApprovedCostRecordedConsumer.CalculateWeightedAverageCost(
                    totals.Quantity,
                    totals.Value,
                    variant.CostPrice);

                // Replace snapshot, không cộng dồn — đây là điều kiện của idempotency.
                variant.TotalApprovedInboundQuantity = totals.Quantity;
                variant.TotalApprovedInboundValue = totals.Value;
                variant.CostPrice = newCostPrice;
                variant.CostBasisReconciledAt = DateTime.UtcNow;
                variant.UpdatedAt = DateTime.UtcNow;
                await store.SaveChangesAsync(innerCt);
                applied = true;
            }, ct);

            if (!applied)
            {
                skipped++;
                continue;
            }

            updated++;

            // Consumer đã ACK các event bị chặn bởi gate nên RabbitMQ sẽ không
            // redeliver. Sau khi snapshot đã đúng, chủ động re-evaluate các group
            // còn treo. Mỗi group chạy trong SKU lock riêng, theo sequence và
            // idempotency hiện có; không publish event, không đụng Inventory.
            var reconciledLineIds = reconciledLineIdsBySku.TryGetValue(target, out var ids)
                ? ids
                : [];
            var pendingReceiptIds = await store.GetPendingReconciliationReceiptIdsAsync(target, ct);

            foreach (var receiptId in pendingReceiptIds)
            {
                SupplierReceiptApprovedCostRecordedConsumer.ReceiptGroupReevaluationOutcome outcome;
                try
                {
                    outcome = await costConsumer.ReevaluateReconciliationRequiredGroupAsync(
                        target,
                        receiptId,
                        reconciledLineIds,
                        ct);
                }
                catch (Exception exception)
                {
                    // Transaction đã rollback nên history vẫn ở reconciliation_required
                    // (recoverable). Không làm hỏng phần reconciliation đã commit.
                    logger.LogError(
                        exception,
                        "Re-evaluate receipt group {ReceiptId} của SKU {SkuId} thất bại; giữ reconciliation_required.",
                        receiptId,
                        target);
                    deferred++;
                    continue;
                }

                switch (outcome)
                {
                    case SupplierReceiptApprovedCostRecordedConsumer.ReceiptGroupReevaluationOutcome.SettledByReconciliation:
                    case SupplierReceiptApprovedCostRecordedConsumer.ReceiptGroupReevaluationOutcome.Reapplied:
                        reevaluated++;
                        break;
                    case SupplierReceiptApprovedCostRecordedConsumer.ReceiptGroupReevaluationOutcome.Deferred:
                        deferred++;
                        break;
                }
            }
        }

        logger.LogInformation(
            "Cost basis reconciliation finished. Processed={Processed} Updated={Updated} Skipped={Skipped} Reevaluated={Reevaluated} Deferred={Deferred} Source={Source}",
            targetSkuIds.Count,
            updated,
            skipped,
            reevaluated,
            deferred,
            AuthoritativeSource);

        return new CostBasisReconciliationResult(
            targetSkuIds.Count,
            updated,
            skipped,
            AuthoritativeSource,
            reevaluated,
            deferred);
    }
}
