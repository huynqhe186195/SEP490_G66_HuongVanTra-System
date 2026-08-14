using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Messaging;

/// <summary>
/// ProductService-owned average cost calculation. The durable history row is
/// both the audit record and the DB-backed Inbox key for a receipt line.
/// </summary>
public sealed class SupplierReceiptApprovedCostRecordedConsumer(
    ISupplierReceiptCostStore store,
    ILogger<SupplierReceiptApprovedCostRecordedConsumer> logger)
    : IConsumer<SupplierReceiptApprovedCostRecordedEvent>
{
    public enum ReceiptSequenceState
    {
        Incomplete,
        Complete,
        Invalid
    }

    public sealed record ReceiptSequenceValidation(
        ReceiptSequenceState State,
        int ExpectedCount,
        int ActualCount,
        IReadOnlyList<int> Orders);

    public async Task Consume(ConsumeContext<SupplierReceiptApprovedCostRecordedEvent> context) =>
        await ProcessAsync(context.Message, context.CancellationToken);

    public async Task ProcessAsync(
        SupplierReceiptApprovedCostRecordedEvent message,
        CancellationToken cancellationToken = default)
    {
        if (message.EventId == Guid.Empty
            || message.SupplierReceiptId == Guid.Empty
            || message.SupplierReceiptLineId == Guid.Empty
            || message.SkuId == Guid.Empty
            || message.ActualQuantity <= 0
            || message.UnitCost <= 0)
        {
            logger.LogWarning(
                "Acknowledging invalid Supplier Receipt cost event {EventId}; no CostPrice mutation was made.",
                message.EventId);
            return;
        }

        try
        {
            await store.ExecuteReadCommittedAsync(async ct =>
            {
                // This must remain the first database operation after the
                // ReadCommitted transaction begins.
                var variant = await store.LockVariantAsync(message.SkuId, ct);
                if (variant is null)
                {
                    logger.LogError(
                        "Cannot process Supplier Receipt cost event {EventId}: ProductVariant {SkuId} was not found.",
                        message.EventId,
                        message.SkuId);
                    throw new InvalidOperationException(
                        $"Không tìm thấy ProductVariant {message.SkuId} để cập nhật giá vốn.");
                }

                var existing = await store.FindHistoryAsync(
                    message.EventId,
                    message.SupplierReceiptLineId,
                    ct);
                if (existing is not null)
                {
                    if (existing.SkuId != message.SkuId
                        || existing.SourceReceiptId != message.SupplierReceiptId)
                    {
                        logger.LogError(
                            "Supplier Receipt cost event identity collision. EventId {EventId}, ReceiptId {ReceiptId}, SkuId {SkuId}.",
                            message.EventId,
                            message.SupplierReceiptId,
                            message.SkuId);
                        throw new InvalidOperationException(
                            $"Event {message.EventId} trùng idempotency key với một cost history khác.");
                    }

                    if (IsTerminal(existing))
                        return;
                }

                var history = existing ?? CreateHistory(message, variant.CostPrice);
                var isNewHistory = existing is null;
                if (isNewHistory)
                    store.AddHistory(history);

                // The persisted rows use SourceReceiptId + SkuId as the group
                // key. A newly tracked history is appended because SaveChanges
                // intentionally happens once, after the whole group is decided.
                var group = await store.GetReceiptGroupAsync(
                    history.SourceReceiptId,
                    history.SkuId,
                    ct);
                if (isNewHistory)
                    group.Add(history);

                await EvaluateAndApplyGroupAsync(variant, group, ct);
                await store.SaveChangesAsync(ct);
            }, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogError(
                exception,
                "Supplier Receipt cost processing failed. EventId {EventId}, ReceiptId {ReceiptId}, SkuId {SkuId}.",
                message.EventId,
                message.SupplierReceiptId,
                message.SkuId);
            throw;
        }
    }

    public enum ReceiptGroupReevaluationOutcome
    {
        /// <summary>Không còn group nào ở trạng thái reconciliation_required.</summary>
        NotPending,

        /// <summary>Group đã nằm trong snapshot reconciliation — đánh dấu terminal, không cộng lại.</summary>
        SettledByReconciliation,

        /// <summary>Group chưa nằm trong snapshot — áp dụng incremental theo luồng chuẩn.</summary>
        Reapplied,

        /// <summary>Không xử lý được; history giữ nguyên reconciliation_required để chạy lại.</summary>
        Deferred
    }

    /// <summary>
    /// Re-evaluate một receipt group đang ở trạng thái reconciliation_required sau khi
    /// cost basis của SKU đã được reconcile. Chạy trong SKU lock, tôn trọng sequence
    /// và idempotency hiện có. Không publish event, không tạo Inventory side effect,
    /// không xóa history.
    ///
    /// <paramref name="reconciledReceiptLineIds"/> là tập SourceReceiptLineId đã được
    /// tính vào snapshot authoritative. Group nằm trọn trong tập này KHÔNG được cộng
    /// lại (sẽ double-count); group nằm ngoài mới đi qua đường incremental.
    /// </summary>
    public async Task<ReceiptGroupReevaluationOutcome> ReevaluateReconciliationRequiredGroupAsync(
        Guid skuId,
        Guid sourceReceiptId,
        IReadOnlySet<Guid> reconciledReceiptLineIds,
        CancellationToken cancellationToken = default)
    {
        var outcome = ReceiptGroupReevaluationOutcome.Deferred;

        await store.ExecuteReadCommittedAsync(async ct =>
        {
            var variant = await store.LockVariantAsync(skuId, ct);
            if (variant is null)
            {
                logger.LogWarning(
                    "Không thể re-evaluate receipt group {ReceiptId}: ProductVariant {SkuId} không tồn tại.",
                    sourceReceiptId,
                    skuId);
                outcome = ReceiptGroupReevaluationOutcome.Deferred;
                return;
            }

            var group = await store.GetReceiptGroupAsync(sourceReceiptId, skuId, ct);
            var pending = group
                .Where(history =>
                    !history.WasApplied
                    && history.ProcessingResult == "reconciliation_required")
                .ToList();
            if (pending.Count == 0)
            {
                outcome = ReceiptGroupReevaluationOutcome.NotPending;
                return;
            }

            if (EvaluateReceiptSequence(group).State != ReceiptSequenceState.Complete)
            {
                logger.LogWarning(
                    "Receipt group {ReceiptId} của SKU {SkuId} chưa đủ sequence; giữ reconciliation_required.",
                    sourceReceiptId,
                    skuId);
                outcome = ReceiptGroupReevaluationOutcome.Deferred;
                return;
            }

            var coveredCount = group.Count(history =>
                reconciledReceiptLineIds.Contains(history.SourceReceiptLineId));

            if (coveredCount == group.Count)
            {
                // Snapshot đã bao gồm toàn bộ dòng của group. Chỉ đóng trạng thái
                // audit theo snapshot hiện tại; không đụng lũy kế và không đổi CostPrice.
                var updatedAt = DateTime.UtcNow;
                foreach (var history in group)
                {
                    history.OldCostPrice = variant.CostPrice;
                    history.NewCostPrice = variant.CostPrice;
                    history.TotalQuantityBefore = variant.TotalApprovedInboundQuantity;
                    history.TotalValueBefore = variant.TotalApprovedInboundValue;
                    history.TotalQuantityAfter = variant.TotalApprovedInboundQuantity;
                    history.TotalValueAfter = variant.TotalApprovedInboundValue;
                    history.WasApplied = true;
                    history.ProcessingResult = "settled_by_reconciliation";
                    history.UpdatedAt = updatedAt;
                }

                await store.SaveChangesAsync(ct);
                outcome = ReceiptGroupReevaluationOutcome.SettledByReconciliation;
                return;
            }

            if (coveredCount > 0)
            {
                // Một phần dòng nằm trong snapshot, một phần không: cộng incremental sẽ
                // sai, đóng terminal cũng sai. Giữ recoverable và báo để xử lý thủ công.
                logger.LogError(
                    "Receipt group {ReceiptId} của SKU {SkuId} chỉ được snapshot reconciliation bao phủ một phần ({Covered}/{Total}); giữ reconciliation_required.",
                    sourceReceiptId,
                    skuId,
                    coveredCount,
                    group.Count);
                outcome = ReceiptGroupReevaluationOutcome.Deferred;
                return;
            }

            // Không dòng nào nằm trong snapshot: đi luồng chuẩn, có kiểm tra
            // superseded và cộng lũy kế đúng một lần.
            foreach (var history in group)
                history.ProcessingResult = "waiting_sequence";

            await EvaluateAndApplyGroupAsync(variant, group, ct);
            await store.SaveChangesAsync(ct);

            outcome = group.Any(history =>
                history.ProcessingResult == "reconciliation_required")
                ? ReceiptGroupReevaluationOutcome.Deferred
                : ReceiptGroupReevaluationOutcome.Reapplied;
        }, cancellationToken);

        return outcome;
    }

    private static ProductCostPriceHistory CreateHistory(
        SupplierReceiptApprovedCostRecordedEvent message,
        decimal currentCostPrice)
    {
        var receiptLineOrder = message.ReceiptLineOrder > 0
            ? message.ReceiptLineOrder
            : 1;
        var receiptSkuLineCount = message.ReceiptSkuLineCount > 0
            ? message.ReceiptSkuLineCount
            : 1;

        return new ProductCostPriceHistory
        {
            Id = Guid.NewGuid(),
            EventId = message.EventId,
            SkuId = message.SkuId,
            OldCostPrice = currentCostPrice,
            IncomingUnitCost = message.UnitCost,
            IncomingQuantity = message.ActualQuantity,
            IncomingValue = message.ActualQuantity * message.UnitCost,
            QuantityOnHandBefore = message.QuantityOnHandBefore < 0
                ? 0m
                : message.QuantityOnHandBefore,
            NewCostPrice = currentCostPrice,
            SourceType = "supplier_receipt",
            SourceReceiptId = message.SupplierReceiptId,
            SourceReceiptLineId = message.SupplierReceiptLineId,
            SourceReceiptCode = message.ReceiptCode,
            SourceApprovedAt = message.ApprovedAt,
            ReceiptLineOrder = receiptLineOrder,
            ReceiptSkuLineCount = receiptSkuLineCount,
            WasApplied = false,
            ProcessingResult = "waiting_sequence",
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = "supplier-receipt-consumer"
        };
    }

    private async Task EvaluateAndApplyGroupAsync(
        ProductVariant variant,
        List<ProductCostPriceHistory> group,
        CancellationToken cancellationToken)
    {
        var validation = EvaluateReceiptSequence(group);
        if (validation.State == ReceiptSequenceState.Incomplete)
        {
            foreach (var history in group.Where(IsRecoverable))
            {
                history.WasApplied = false;
                history.ProcessingResult = "sequence_incomplete";
                history.UpdatedAt = DateTime.UtcNow;
            }
            return;
        }

        if (validation.State == ReceiptSequenceState.Invalid
            || group.Any(IsTerminal))
        {
            foreach (var history in group.Where(IsRecoverable))
            {
                history.WasApplied = false;
                history.ProcessingResult = "sequence_invalid";
                history.UpdatedAt = DateTime.UtcNow;
            }

            var sourceReceiptId = group.FirstOrDefault()?.SourceReceiptId ?? Guid.Empty;
            logger.LogError(
                "Invalid Supplier Receipt cost sequence. ReceiptId {ReceiptId}, SkuId {SkuId}, ExpectedCount {ExpectedCount}, ActualCount {ActualCount}, Orders {Orders}.",
                sourceReceiptId,
                variant.Id,
                validation.ExpectedCount,
                validation.ActualCount,
                string.Join(",", validation.Orders));
            return;
        }

        var ordered = group
            .OrderBy(history => history.ReceiptLineOrder)
            .ThenBy(history => history.SourceReceiptLineId)
            .ToList();
        var groupApprovedAt = ordered.Min(history => history.SourceApprovedAt);
        var groupReceiptId = ordered[0].SourceReceiptId;
        var latestApplied = await store.GetLatestAppliedHistoryAsync(
            variant.Id,
            cancellationToken);

        if (RequiresCostBasisReconciliation(variant, latestApplied))
        {
            foreach (var history in ordered)
            {
                history.OldCostPrice = variant.CostPrice;
                history.NewCostPrice = variant.CostPrice;
                history.TotalQuantityBefore = variant.TotalApprovedInboundQuantity;
                history.TotalValueBefore = variant.TotalApprovedInboundValue;
                history.TotalQuantityAfter = variant.TotalApprovedInboundQuantity;
                history.TotalValueAfter = variant.TotalApprovedInboundValue;
                history.WasApplied = false;
                history.ProcessingResult = "reconciliation_required";
                history.UpdatedAt = DateTime.UtcNow;
            }

            logger.LogWarning(
                "Supplier Receipt cost group requires cost basis reconciliation. ReceiptId {ReceiptId}, SkuId {SkuId}, CostPrice {CostPrice}, TotalQuantity {TotalQuantity}. Chạy cost-basis-reconciliation trước khi phiếu mới được tính vào lũy kế.",
                groupReceiptId,
                variant.Id,
                variant.CostPrice,
                variant.TotalApprovedInboundQuantity);
            return;
        }

        var isSuperseded = latestApplied is not null
            && CompareBusinessOrder(
                groupApprovedAt,
                groupReceiptId,
                latestApplied.SourceApprovedAt,
                latestApplied.SourceReceiptId) < 0;
        var updatedAt = DateTime.UtcNow;

        // Phiếu đầu tiên trên SKU đã có CostPrice catalog nhưng chưa có inbound lũy kế:
        // seed basis = tồn trước phiếu × CostPrice cũ, rồi mới cộng dòng nhập (WAC thật).
        // Nếu không seed, quantityBefore=0 → CostPrice nhảy thẳng bằng đơn giá phiếu mới.
        if (!isSuperseded)
            TrySeedOpeningCostBasisFromOnHand(variant, ordered);

        foreach (var history in ordered)
        {
            var oldCostPrice = variant.CostPrice;
            var quantityBefore = variant.TotalApprovedInboundQuantity;
            var valueBefore = variant.TotalApprovedInboundValue;
            history.OldCostPrice = oldCostPrice;
            history.TotalQuantityBefore = quantityBefore;
            history.TotalValueBefore = valueBefore;

            if (isSuperseded)
            {
                // Sự kiện cũ hơn: không đổi giá vốn và không đổi lũy kế.
                history.NewCostPrice = oldCostPrice;
                history.TotalQuantityAfter = quantityBefore;
                history.TotalValueAfter = valueBefore;
                history.WasApplied = false;
                history.ProcessingResult = "superseded";
                history.UpdatedAt = updatedAt;
                continue;
            }

            var quantityAfter = quantityBefore + history.IncomingQuantity;
            var valueAfter = valueBefore + history.IncomingValue;
            var newCostPrice = CalculateWeightedAverageCost(quantityAfter, valueAfter, oldCostPrice);

            history.TotalQuantityAfter = quantityAfter;
            history.TotalValueAfter = valueAfter;
            history.NewCostPrice = newCostPrice;
            history.WasApplied = true;
            history.ProcessingResult = "applied";
            history.UpdatedAt = updatedAt;

            variant.TotalApprovedInboundQuantity = quantityAfter;
            variant.TotalApprovedInboundValue = valueAfter;
            variant.CostPrice = newCostPrice;
        }

        if (!isSuperseded)
            variant.UpdatedAt = updatedAt;
    }

    /// <summary>
    /// Khi chưa có TotalApprovedInbound* nhưng đã có CostPrice catalog và tồn trước phiếu &gt; 0,
    /// ghi nhận tồn đó như basis ảo để WAC lần đầu không nhảy thẳng bằng UnitCost phiếu mới.
    /// </summary>
    internal static void TrySeedOpeningCostBasisFromOnHand(
        ProductVariant variant,
        IReadOnlyList<ProductCostPriceHistory> orderedGroup)
    {
        if (variant.TotalApprovedInboundQuantity > 0 || variant.TotalApprovedInboundValue > 0)
            return;

        if (variant.CostPrice <= 0)
            return;

        var openingQuantity = orderedGroup
            .Select(history => history.QuantityOnHandBefore)
            .Where(quantity => quantity > 0)
            .DefaultIfEmpty(0m)
            .Min();
        if (openingQuantity <= 0)
            return;

        variant.TotalApprovedInboundQuantity = openingQuantity;
        variant.TotalApprovedInboundValue = Math.Round(
            openingQuantity * variant.CostPrice,
            4,
            MidpointRounding.AwayFromZero);
    }

    public static ReceiptSequenceValidation EvaluateReceiptSequence(
        IReadOnlyCollection<ProductCostPriceHistory> lines)
    {
        if (lines.Count == 0)
        {
            return new ReceiptSequenceValidation(
                ReceiptSequenceState.Incomplete,
                0,
                0,
                []);
        }

        var expectedCounts = lines
            .Select(line => line.ReceiptSkuLineCount)
            .Distinct()
            .ToList();
        var orders = lines
            .Select(line => line.ReceiptLineOrder)
            .OrderBy(order => order)
            .ToList();
        var expectedCount = expectedCounts.Count == 1
            ? expectedCounts[0]
            : expectedCounts.Where(count => count > 0).DefaultIfEmpty(0).Max();
        var hasInvalidMetadata = expectedCounts.Count != 1
            || expectedCount <= 0
            || lines.Select(line => line.SourceReceiptLineId).Distinct().Count() != lines.Count
            || orders.Distinct().Count() != lines.Count
            || orders.Any(order => order <= 0 || order > expectedCount)
            || lines.Count > expectedCount;
        if (hasInvalidMetadata)
        {
            return new ReceiptSequenceValidation(
                ReceiptSequenceState.Invalid,
                expectedCount,
                lines.Count,
                orders);
        }

        if (lines.Count < expectedCount)
        {
            return new ReceiptSequenceValidation(
                ReceiptSequenceState.Incomplete,
                expectedCount,
                lines.Count,
                orders);
        }

        var isComplete = Enumerable.Range(1, expectedCount).SequenceEqual(orders);
        return new ReceiptSequenceValidation(
            isComplete ? ReceiptSequenceState.Complete : ReceiptSequenceState.Invalid,
            expectedCount,
            lines.Count,
            orders);
    }

    public static int CompareBusinessOrder(
        DateTime leftApprovedAt,
        Guid leftReceiptId,
        DateTime rightApprovedAt,
        Guid rightReceiptId)
    {
        var approvedAtComparison = leftApprovedAt.CompareTo(rightApprovedAt);
        return approvedAtComparison != 0
            ? approvedAtComparison
            : string.CompareOrdinal(
                leftReceiptId.ToString("D"),
                rightReceiptId.ToString("D"));
    }

    /// <summary>
    /// Chặn phiếu mới chỉ khi cumulative đã từng được áp dụng (có history applied)
    /// nhưng snapshot TotalApprovedInbound* lại về 0 — dữ liệu lệch, cần reconcile tay.
    /// Giá vốn catalog/seed (CostPrice &gt; 0, chưa có inbound lũy kế) KHÔNG chặn:
    /// phiếu nhập đầu tiên được phép lập basis bình quân gia quyền.
    /// </summary>
    private static bool RequiresCostBasisReconciliation(
        ProductVariant variant,
        ProductCostPriceHistory? latestApplied)
    {
        if (variant.CostBasisReconciledAt is not null)
            return false;

        if (variant.TotalApprovedInboundQuantity > 0 || variant.TotalApprovedInboundValue > 0)
            return false;

        // Catalog seed CostPrice alone must not block the first real receipt.
        return latestApplied is not null;
    }

    private static bool IsRecoverable(ProductCostPriceHistory history) =>
        !history.WasApplied
        && history.ProcessingResult is
            "waiting_sequence"
            or "sequence_incomplete"
            or "reconciliation_required"
            or "pending";

    private static bool IsTerminal(ProductCostPriceHistory history) =>
        history.WasApplied
        || history.ProcessingResult is
            "applied"
            or "settled_by_reconciliation"
            or "superseded"
            or "sequence_invalid"
            or "invalid";

    public static bool HasCompleteReceiptSequence(
        IEnumerable<(int ReceiptLineOrder, int ReceiptSkuLineCount)> lines)
    {
        var sequence = lines.ToList();
        if (sequence.Count == 0)
            return false;

        var expectedCounts = sequence
            .Select(line => line.ReceiptSkuLineCount)
            .Distinct()
            .ToList();
        if (expectedCounts.Count != 1 || expectedCounts[0] <= 0)
            return false;

        var expectedCount = expectedCounts[0];
        var orders = sequence
            .Select(line => line.ReceiptLineOrder)
            .OrderBy(order => order)
            .ToList();
        return sequence.Count == expectedCount
            && Enumerable.Range(1, expectedCount).SequenceEqual(orders);
    }

    /// <summary>
    /// Weighted Average Cost = TotalApprovedInboundValue / TotalApprovedInboundQuantity.
    /// Không dùng CostPrice hiện tại làm thành phần tính; fallback chỉ để tránh chia 0.
    /// </summary>
    public static decimal CalculateWeightedAverageCost(
        decimal totalQuantity,
        decimal totalValue,
        decimal fallbackCostPrice)
    {
        if (totalQuantity <= 0)
            return Math.Round(fallbackCostPrice, 2, MidpointRounding.AwayFromZero);

        return Math.Round(totalValue / totalQuantity, 2, MidpointRounding.AwayFromZero);
    }
}
