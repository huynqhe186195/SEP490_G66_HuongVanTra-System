using HuongVanTra.Shared.Messages;
using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Domain.Exceptions;

namespace InventoryService.Application.UseCases;

public class InventoryLogic(
    ISkuStockRepository _skuStockRepo,
    IStockDeductQueueRepository _queueRepo,
    IProcessedIntegrationEventRepository _processedEvents,
    IInventoryEventPublisher _eventPublisher)
{
    public const string SkuCreatedEventType = "SkuCreated";
    public const string OrderPlacedEventType = "OrderPlaced";
    public const string OrderCancelledEventType = "OrderCancelled";

    public async Task HandleSkuCreatedAsync(SkuCreatedEvent message, CancellationToken ct = default)
    {
        if (await _processedEvents.ExistsAsync(SkuCreatedEventType, message.SkuId, ct))
            return;

        if (await _skuStockRepo.GetBySkuIdAsync(message.SkuId, ct) != null)
        {
            await _processedEvents.AddAsync(SkuCreatedEventType, message.SkuId, ct);
            await _skuStockRepo.SaveChangesAsync(ct);
            return;
        }

        await _skuStockRepo.AddAsync(new SkuStock
        {
            SkuId = message.SkuId,
            SkuCode = message.SkuCode,
            WeightInGrams = message.WeightInGrams,
            QuantityOnHand = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        }, ct);

        await _processedEvents.AddAsync(SkuCreatedEventType, message.SkuId, ct);
        await _skuStockRepo.SaveChangesAsync(ct);
    }

    public async Task HandleOrderPlacedAsync(OrderPlacedEvent message, CancellationToken ct = default)
    {
        if (await _processedEvents.ExistsAsync(OrderPlacedEventType, message.OrderId, ct))
        {
            if (string.Equals(message.OrderStatus, "Completed", StringComparison.OrdinalIgnoreCase))
            {
                var existingQueue = await _queueRepo.GetByOrderIdAsync(message.OrderId, ct);
                if (existingQueue is { IsDeducted: false })
                    await TryAutoConfirmQueueAsync(existingQueue.Id, ct);
            }

            return;
        }

        if (await _queueRepo.GetByOrderIdAsync(message.OrderId, ct) != null)
        {
            await _processedEvents.AddAsync(OrderPlacedEventType, message.OrderId, ct);
            await _queueRepo.SaveChangesAsync(ct);
            return;
        }

        var queue = new StockDeductQueue
        {
            Id = Guid.NewGuid(),
            OrderId = message.OrderId,
            OrderCode = message.OrderCode,
            OrderPaymentStatus = message.OrderStatus.ToLowerInvariant(),
            OrderStockStatus = "pending_deduct",
            QueueStatus = QueueStatus.Waiting,
            TotalAmount = message.TotalAmount,
            IsDeducted = false,
            CreatedAt = DateTime.UtcNow,
            Items = message.Items.Select(i => new StockDeductQueueItem
            {
                Id = Guid.NewGuid(),
                SkuId = i.SkuId,
                SkuSnapshotName = i.SkuName ?? i.SkuCode ?? i.SkuId.ToString(),
                SkuSnapshotCode = i.SkuCode,
                Quantity = i.Quantity
            }).ToList()
        };

        foreach (var item in queue.Items)
            item.QueueId = queue.Id;

        await _queueRepo.AddAsync(queue, ct);
        await _processedEvents.AddAsync(OrderPlacedEventType, message.OrderId, ct);
        await _queueRepo.SaveChangesAsync(ct);

        if (string.Equals(message.OrderStatus, "Completed", StringComparison.OrdinalIgnoreCase))
            await TryAutoConfirmQueueAsync(queue.Id, ct);
    }

    private async Task TryAutoConfirmQueueAsync(Guid queueId, CancellationToken ct)
    {
        try
        {
            await ConfirmQueueAsync(queueId, ct);
        }
        catch (InsufficientStockException)
        {
            // POS đã bán xong nhưng thiếu tồn — giữ hàng chờ để nhập kho / xử lý thủ công.
        }
    }

    public async Task HandleOrderCancelledAsync(OrderCancelledEvent message, CancellationToken ct = default)
    {
        if (await _processedEvents.ExistsAsync(OrderCancelledEventType, message.OrderId, ct))
            return;

        var queue = await _queueRepo.GetByOrderIdAsync(message.OrderId, ct);
        if (queue == null)
        {
            await _processedEvents.AddAsync(OrderCancelledEventType, message.OrderId, ct);
            await _queueRepo.SaveChangesAsync(ct);
            return;
        }

        if (queue.IsDeducted)
        {
            await RestoreStockAsync(queue, ct);
            queue.IsDeducted = false;
        }

        queue.QueueStatus = QueueStatus.Cancelled;
        queue.OrderStockStatus = queue.IsDeducted ? "restored" : "cancelled";
        queue.ConfirmedAt ??= DateTime.UtcNow;

        await _processedEvents.AddAsync(OrderCancelledEventType, message.OrderId, ct);
        await _queueRepo.SaveChangesAsync(ct);
    }

    public async Task<List<StockDeductQueueResponse>> GetWaitingQueuesAsync(string? search, CancellationToken ct = default)
    {
        var queues = await _queueRepo.GetWaitingAsync(search, ct);
        return queues.Select(MapQueue).ToList();
    }

    public async Task<StockDeductPreviewResponse> PreviewQueueAsync(Guid queueId, CancellationToken ct = default)
    {
        var queue = await _queueRepo.GetByIdAsync(queueId, ct)
            ?? throw new InventoryNotFoundException($"Queue '{queueId}' not found.");

        var previewItems = await BuildPreviewItemsAsync(queue, ct);
        var canDeduct = previewItems.All(i => i.ShortageQuantity <= 0);
        var orderStockStatus = canDeduct ? queue.OrderStockStatus : "waiting_stock";

        return new StockDeductPreviewResponse(
            queue.Id, queue.OrderId, queue.OrderCode,
            queue.QueueStatus.ToString().ToLowerInvariant(),
            orderStockStatus,
            canDeduct,
            previewItems);
    }

    public async Task<StockDeductConfirmResponse> ConfirmQueueAsync(Guid queueId, CancellationToken ct = default)
    {
        var queue = await _queueRepo.GetByIdAsync(queueId, ct)
            ?? throw new InventoryNotFoundException($"Queue '{queueId}' not found.");

        if (queue.QueueStatus != QueueStatus.Waiting)
            throw new InventoryNotFoundException("Chỉ có thể trừ kho cho hàng chờ xử lý.");

        var previewItems = await BuildPreviewItemsAsync(queue, ct);
        var shortages = previewItems
            .Where(i => i.ShortageQuantity > 0)
            .Select(i => new StockShortage(
                i.SkuId, i.MaterialName, i.RequiredQuantity, i.AvailableQuantity, i.ShortageQuantity))
            .ToList();

        if (shortages.Count > 0)
            throw new InsufficientStockException("Không đủ tồn kho để trừ.", shortages);

        foreach (var item in queue.Items)
        {
            var stock = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, ct);
            if (stock == null)
                throw new InsufficientStockException("Không đủ tồn kho để trừ.", [
                    new StockShortage(item.SkuId, item.SkuSnapshotName, item.Quantity, 0, item.Quantity)
                ]);

            stock.QuantityOnHand -= item.Quantity;
            stock.UpdatedAt = DateTime.UtcNow;
        }

        queue.IsDeducted = true;
        queue.QueueStatus = QueueStatus.Confirmed;
        queue.OrderStockStatus = "deducted";
        queue.ConfirmedAt = DateTime.UtcNow;

        await _queueRepo.SaveChangesAsync(ct);
        await _eventPublisher.PublishStockDeductedAsync(queue.OrderId, queue.OrderCode, true, ct);

        return new StockDeductConfirmResponse(
            queue.Id, queue.OrderId, queue.OrderCode,
            queue.QueueStatus.ToString().ToLowerInvariant(),
            queue.OrderStockStatus,
            queue.ConfirmedAt);
    }

    public async Task<StockDeductConfirmResponse> CancelQueueAsync(Guid queueId, CancellationToken ct = default)
    {
        var queue = await _queueRepo.GetByIdAsync(queueId, ct)
            ?? throw new InventoryNotFoundException($"Queue '{queueId}' not found.");

        if (queue.QueueStatus != QueueStatus.Waiting)
            throw new InventoryNotFoundException("Chỉ có thể hủy hàng chờ xử lý.");

        queue.QueueStatus = QueueStatus.Cancelled;
        queue.OrderStockStatus = "cancelled";
        queue.ConfirmedAt = DateTime.UtcNow;
        await _queueRepo.SaveChangesAsync(ct);

        return new StockDeductConfirmResponse(
            queue.Id, queue.OrderId, queue.OrderCode,
            queue.QueueStatus.ToString().ToLowerInvariant(),
            queue.OrderStockStatus,
            queue.ConfirmedAt);
    }

    public async Task<List<SkuStockResponse>> GetSkuStocksAsync(CancellationToken ct = default)
    {
        var stocks = await _skuStockRepo.GetAllAsync(ct);
        return stocks.Select(s => new SkuStockResponse(
            s.SkuId, s.SkuCode, s.WeightInGrams, s.QuantityOnHand, s.UpdatedAt)).ToList();
    }

    public async Task<SkuStockResponse> AdjustSkuStockAsync(
        Guid skuId, int quantityDelta, string? skuCode = null, CancellationToken ct = default)
    {
        var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct);
        if (stock == null)
        {
            stock = new SkuStock
            {
                SkuId = skuId,
                SkuCode = string.IsNullOrWhiteSpace(skuCode) ? skuId.ToString()[..8] : skuCode.Trim(),
                WeightInGrams = 0,
                QuantityOnHand = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await _skuStockRepo.AddAsync(stock, ct);
        }

        stock.QuantityOnHand = Math.Max(0, stock.QuantityOnHand + quantityDelta);
        stock.UpdatedAt = DateTime.UtcNow;
        await _skuStockRepo.SaveChangesAsync(ct);

        return new SkuStockResponse(
            stock.SkuId, stock.SkuCode, stock.WeightInGrams, stock.QuantityOnHand, stock.UpdatedAt);
    }

    private async Task RestoreStockAsync(StockDeductQueue queue, CancellationToken ct)
    {
        foreach (var item in queue.Items)
        {
            var stock = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, ct);
            if (stock == null) continue;

            stock.QuantityOnHand += item.Quantity;
            stock.UpdatedAt = DateTime.UtcNow;
        }
    }

    private async Task<List<StockDeductPreviewItemResponse>> BuildPreviewItemsAsync(
        StockDeductQueue queue, CancellationToken ct)
    {
        var result = new List<StockDeductPreviewItemResponse>();

        foreach (var item in queue.Items)
        {
            var stock = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, ct);
            var available = stock?.QuantityOnHand ?? 0;
            var shortage = Math.Max(0, item.Quantity - available);
            var status = shortage > 0 ? "insufficient" : "ok";

            result.Add(new StockDeductPreviewItemResponse(
                item.SkuId,
                item.SkuId,
                item.SkuSnapshotName,
                item.Quantity,
                available,
                shortage,
                status));
        }

        return result;
    }

    private static StockDeductQueueResponse MapQueue(StockDeductQueue q) => new(
        q.Id, q.OrderId, q.OrderCode,
        q.QueueStatus.ToString().ToLowerInvariant(),
        q.OrderPaymentStatus,
        q.OrderStockStatus,
        q.TotalAmount,
        q.CreatedAt);
}
