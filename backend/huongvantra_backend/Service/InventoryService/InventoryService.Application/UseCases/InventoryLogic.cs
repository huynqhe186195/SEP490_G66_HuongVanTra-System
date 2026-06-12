using HuongVanTra.Shared.Messages;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.Interfaces;
using InventoryService.Application.Options;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Domain.Exceptions;
using Microsoft.Extensions.Options;

namespace InventoryService.Application.UseCases;

public class InventoryLogic(
    ISkuStockRepository _skuStockRepo,
    IStockDeductQueueRepository _queueRepo,
    IStockAdjustmentRequestRepository _adjustmentRequestRepo,
    IStockExportSlipRepository _exportSlipRepo,
    IWarehouseBatchRepository _batchRepo,
    IStockExportBatchAllocationRepository _exportAllocationRepo,
    IProcessedIntegrationEventRepository _processedEvents,
    IInventoryEventPublisher _eventPublisher,
    IOptions<InventoryOptions> inventoryOptions)
{
    private readonly InventoryOptions _inventoryOptions = inventoryOptions.Value;

    public bool IsSimulateWarehouse => _inventoryOptions.SimulateWarehouse;

    public const string SkuCreatedEventType = "SkuCreated";
    public const string OrderPlacedEventType = "OrderPlaced";
    public const string OrderCancelledEventType = "OrderCancelled";
    public const string OrderReturnedEventType = "OrderReturned";

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
            WarehouseQuantityOnHand = 0,
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

    public async Task HandleOrderReturnedAsync(OrderReturnedEvent message, CancellationToken ct = default)
    {
        if (await _processedEvents.ExistsAsync(OrderReturnedEventType, message.ReturnId, ct))
            return;

        var queue = await _queueRepo.GetByOrderIdAsync(message.OrderId, ct);
        if (queue == null)
        {
            await _processedEvents.AddAsync(OrderReturnedEventType, message.ReturnId, ct);
            await _queueRepo.SaveChangesAsync(ct);
            return;
        }

        if (queue.IsDeducted)
        {
            await RestorePartialStockAsync(
                message.Items.Select(i => (i.SkuId, i.Quantity)),
                ct);
        }

        await _processedEvents.AddAsync(OrderReturnedEventType, message.ReturnId, ct);
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
        var warehouseQtyBySku = await _batchRepo.GetQuantitySumsBySkuAsync(ct);
        var now = DateTime.UtcNow;
        var dirty = false;

        foreach (var stock in stocks)
        {
            var fromBatches = warehouseQtyBySku.GetValueOrDefault(stock.SkuId, 0);
            if (stock.WarehouseQuantityOnHand == fromBatches) continue;
            stock.WarehouseQuantityOnHand = fromBatches;
            stock.UpdatedAt = now;
            dirty = true;
        }

        if (dirty)
            await _skuStockRepo.SaveChangesAsync(ct);

        return stocks.Select(MapSkuStock).ToList();
    }

    public async Task<SkuStockResponse> AdjustStoreStockAsync(
        Guid skuId, int quantityDelta, string? skuCode = null, CancellationToken ct = default)
    {
        if (quantityDelta == 0)
            throw new InventoryValidationException("Số lượng thay đổi phải khác 0.");

        var stock = await GetOrCreateSkuStockAsync(skuId, skuCode, ct);
        if (quantityDelta < 0 && stock.QuantityOnHand + quantityDelta < 0)
        {
            throw new InventoryValidationException(
                $"Tồn cửa hàng không đủ. Hiện có {stock.QuantityOnHand}, yêu cầu giảm {Math.Abs(quantityDelta)}.");
        }

        stock.QuantityOnHand = Math.Max(0, stock.QuantityOnHand + quantityDelta);
        stock.UpdatedAt = DateTime.UtcNow;
        await _skuStockRepo.SaveChangesAsync(ct);
        return MapSkuStock(stock);
    }

    public Task<SkuStockResponse> SimulateAdjustStoreStockAsync(
        Guid skuId, int quantityDelta, string? skuCode = null, CancellationToken ct = default)
    {
        if (!_inventoryOptions.SimulateWarehouse)
        {
            throw new InventoryValidationException(
                "Chỉ dùng nhập tồn giả lập khi bật Inventory:SimulateWarehouse.");
        }

        return AdjustStoreStockAsync(skuId, quantityDelta, skuCode, ct);
    }

    public async Task<SkuStockResponse> AdjustWarehouseStockAsync(
        Guid skuId, int quantityDelta, string? skuCode = null, CancellationToken ct = default)
    {
        if (quantityDelta == 0)
            throw new InventoryValidationException("Số lượng thay đổi phải khác 0.");

        var stock = await GetOrCreateSkuStockAsync(skuId, skuCode, ct);
        var resolvedSkuCode = stock.SkuCode;

        if (quantityDelta > 0)
        {
            var lotCode = $"DC-{DateTime.UtcNow:yyyyMMddHHmmss}";
            await CreateWarehouseBatchInternalAsync(
                lotCode,
                null,
                null,
                "Điều chỉnh thủ công kho tổng",
                [
                    new CreateWarehouseBatchItemRequest(
                        skuId,
                        resolvedSkuCode,
                        null,
                        quantityDelta,
                        null)
                ],
                Guid.Empty,
                ct);
        }
        else
        {
            await AllocateAndDeductBatchesFifoAsync(skuId, Math.Abs(quantityDelta), ct);
            await SyncWarehouseQtyFromBatchesAsync(stock, ct);
        }

        return MapSkuStock(stock);
    }

    public async Task<WarehouseBatchResponse> CreateWarehouseBatchAsync(
        CreateWarehouseBatchRequest request,
        Guid createdBy,
        CancellationToken ct = default)
    {
        if (createdBy == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người nhập lô.");

        return await CreateWarehouseBatchInternalAsync(
            request.LotCode,
            request.Supplier,
            request.ExpiresAt,
            request.Note,
            request.Items,
            createdBy,
            ct);
    }

    public async Task<List<WarehouseBatchResponse>> GetWarehouseBatchesAsync(
        Guid? skuId,
        string? search,
        bool availableOnly,
        CancellationToken ct = default)
    {
        var items = await _batchRepo.GetListAsync(skuId, search, availableOnly, ct);
        return items.Select(MapWarehouseBatch).ToList();
    }

    public async Task<WarehouseBatchResponse?> GetWarehouseBatchAsync(Guid id, CancellationToken ct = default)
    {
        var batch = await _batchRepo.GetByIdAsync(id, ct);
        return batch == null ? null : MapWarehouseBatch(batch);
    }

    private async Task RestoreStockAsync(StockDeductQueue queue, CancellationToken ct)
    {
        await RestorePartialStockAsync(
            queue.Items.Select(item => (item.SkuId, item.Quantity)),
            ct);
    }

    private async Task RestorePartialStockAsync(
        IEnumerable<(Guid SkuId, int Quantity)> items,
        CancellationToken ct)
    {
        foreach (var (skuId, quantity) in items)
        {
            if (quantity <= 0) continue;

            var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct);
            if (stock == null) continue;

            stock.QuantityOnHand += quantity;
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

    public async Task<StockAdjustmentRequestResponse> CreateStockAdjustmentRequestAsync(
        CreateStockAdjustmentRequest request,
        Guid requestedBy,
        CancellationToken ct = default)
    {
        if (requestedBy == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người gửi yêu cầu.");

        if (request.QuantityDelta == 0)
            throw new InventoryValidationException("Số lượng thay đổi phải khác 0.");

        var reason = request.Reason?.Trim();
        if (request.QuantityDelta < 0 && string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Yêu cầu giảm tồn cần ghi rõ lý do.");

        var stock = await _skuStockRepo.GetBySkuIdAsync(request.SkuId, ct);
        var onHand = stock?.QuantityOnHand ?? 0; // tồn cửa hàng tại thời điểm gửi
        var skuCode = request.SkuCode?.Trim()
            ?? stock?.SkuCode
            ?? request.SkuId.ToString()[..8];
        var skuName = request.SkuSnapshotName?.Trim() ?? skuCode;

        var today = DateTime.UtcNow.Date;
        var countToday = await _adjustmentRequestRepo.CountCreatedSinceAsync(today, ct);
        var entity = new StockAdjustmentRequest
        {
            Id = Guid.NewGuid(),
            RequestCode = $"YC-{today:yyyyMMdd}-{(countToday + 1):D4}",
            SkuId = request.SkuId,
            SkuCode = skuCode,
            SkuSnapshotName = skuName,
            QuantityDelta = request.QuantityDelta,
            Reason = reason,
            Status = StockAdjustmentRequestStatus.Pending,
            QuantityOnHandSnapshot = onHand,
            RequestedBy = requestedBy,
            RequestedAt = DateTime.UtcNow,
        };

        await _adjustmentRequestRepo.AddAsync(entity, ct);
        await _adjustmentRequestRepo.SaveChangesAsync(ct);
        return MapAdjustmentRequest(entity);
    }

    public async Task<List<StockAdjustmentRequestResponse>> GetStockAdjustmentRequestsAsync(
        string? status,
        Guid? requestedBy,
        string? search,
        CancellationToken ct = default)
    {
        StockAdjustmentRequestStatus? parsedStatus = null;
        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<StockAdjustmentRequestStatus>(status, true, out var value))
        {
            parsedStatus = value;
        }

        var items = await _adjustmentRequestRepo.GetListAsync(parsedStatus, requestedBy, search, ct);
        return items.Select(MapAdjustmentRequest).ToList();
    }

    public async Task<StockAdjustmentRequestResponse?> GetStockAdjustmentRequestAsync(
        Guid id,
        CancellationToken ct = default)
    {
        var entity = await _adjustmentRequestRepo.GetByIdAsync(id, ct);
        return entity == null ? null : MapAdjustmentRequest(entity);
    }

    public async Task<StockAdjustmentReviewResponse> ApproveStockAdjustmentRequestAsync(
        Guid id,
        Guid reviewedBy,
        CancellationToken ct = default)
    {
        var entity = await _adjustmentRequestRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy yêu cầu điều chỉnh tồn.");

        if (entity.Status != StockAdjustmentRequestStatus.Pending)
            throw new InventoryValidationException("Yêu cầu không còn ở trạng thái chờ duyệt.");

        var stock = await GetOrCreateSkuStockAsync(entity.SkuId, entity.SkuCode, ct);
        StockExportSlip? exportSlip = null;

        if (entity.QuantityDelta > 0)
        {
            var warehouseBefore = stock.WarehouseQuantityOnHand;
            var storeBefore = stock.QuantityOnHand;

            if (_inventoryOptions.SimulateWarehouse)
            {
                stock.QuantityOnHand += entity.QuantityDelta;
                stock.UpdatedAt = DateTime.UtcNow;

                exportSlip = await CreateExportSlipAsync(
                    entity,
                    entity.QuantityDelta,
                    warehouseBefore,
                    warehouseBefore,
                    storeBefore,
                    stock.QuantityOnHand,
                    reviewedBy,
                    "Giả lập — chưa trừ kho tổng (module kho đang phát triển).",
                    null,
                    ct);
            }
            else
            {
                var batchTotal = await _batchRepo.SumQuantityOnHandAsync(entity.SkuId, ct);
                if (batchTotal < entity.QuantityDelta)
                {
                    throw new InventoryValidationException(
                        $"Tồn lô trong kho không đủ để xuất. Có {batchTotal} (theo lô), yêu cầu {entity.QuantityDelta}. Hãy nhập lô trước.");
                }

                var allocations = await AllocateAndDeductBatchesFifoAsync(
                    entity.SkuId, entity.QuantityDelta, ct);

                await SyncWarehouseQtyFromBatchesAsync(stock, ct);
                stock.QuantityOnHand += entity.QuantityDelta;
                stock.UpdatedAt = DateTime.UtcNow;

                exportSlip = await CreateExportSlipAsync(
                    entity,
                    entity.QuantityDelta,
                    warehouseBefore,
                    stock.WarehouseQuantityOnHand,
                    storeBefore,
                    stock.QuantityOnHand,
                    reviewedBy,
                    entity.Reason,
                    allocations,
                    ct);
            }

            entity.ExportSlipId = exportSlip.Id;
        }
        else
        {
            if (stock.QuantityOnHand + entity.QuantityDelta < 0)
            {
                throw new InventoryValidationException(
                    $"Tồn cửa hàng không đủ. Hiện có {stock.QuantityOnHand}, yêu cầu giảm {Math.Abs(entity.QuantityDelta)}.");
            }

            stock.QuantityOnHand = Math.Max(0, stock.QuantityOnHand + entity.QuantityDelta);
            stock.UpdatedAt = DateTime.UtcNow;
        }

        entity.Status = StockAdjustmentRequestStatus.Approved;
        entity.QuantityOnHandAfter = stock.QuantityOnHand;
        entity.WarehouseQuantityOnHandAfter = stock.WarehouseQuantityOnHand;
        entity.ReviewedBy = reviewedBy == Guid.Empty ? null : reviewedBy;
        entity.ReviewedAt = DateTime.UtcNow;
        await _skuStockRepo.SaveChangesAsync(ct);
        await _adjustmentRequestRepo.SaveChangesAsync(ct);

        return new StockAdjustmentReviewResponse(
            entity.Id,
            entity.RequestCode,
            entity.Status.ToString().ToLowerInvariant(),
            stock.QuantityOnHand,
            stock.WarehouseQuantityOnHand,
            entity.ReviewedAt,
            exportSlip?.Id,
            exportSlip?.ExportCode);
    }

    public async Task<StockAdjustmentReviewResponse> RejectStockAdjustmentRequestAsync(
        Guid id,
        Guid reviewedBy,
        RejectStockAdjustmentRequest request,
        CancellationToken ct = default)
    {
        var entity = await _adjustmentRequestRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy yêu cầu điều chỉnh tồn.");

        if (entity.Status != StockAdjustmentRequestStatus.Pending)
            throw new InventoryValidationException("Yêu cầu không còn ở trạng thái chờ duyệt.");

        entity.Status = StockAdjustmentRequestStatus.Rejected;
        entity.ReviewedBy = reviewedBy == Guid.Empty ? null : reviewedBy;
        entity.ReviewedAt = DateTime.UtcNow;
        entity.ReviewNote = request.Reason?.Trim();
        await _adjustmentRequestRepo.SaveChangesAsync(ct);

        var stock = await _skuStockRepo.GetBySkuIdAsync(entity.SkuId, ct);
        return new StockAdjustmentReviewResponse(
            entity.Id,
            entity.RequestCode,
            entity.Status.ToString().ToLowerInvariant(),
            stock?.QuantityOnHand ?? entity.QuantityOnHandSnapshot,
            stock?.WarehouseQuantityOnHand ?? 0,
            entity.ReviewedAt,
            null,
            null);
    }

    public async Task<StockAdjustmentReviewResponse> CancelStockAdjustmentRequestAsync(
        Guid id,
        Guid requestedBy,
        CancellationToken ct = default)
    {
        var entity = await _adjustmentRequestRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy yêu cầu điều chỉnh tồn.");

        if (entity.Status != StockAdjustmentRequestStatus.Pending)
            throw new InventoryValidationException("Chỉ có thể hủy yêu cầu đang chờ duyệt.");

        if (entity.RequestedBy != requestedBy)
            throw new InventoryValidationException("Bạn không thể hủy yêu cầu của người khác.");

        entity.Status = StockAdjustmentRequestStatus.Cancelled;
        entity.ReviewedAt = DateTime.UtcNow;
        await _adjustmentRequestRepo.SaveChangesAsync(ct);

        return new StockAdjustmentReviewResponse(
            entity.Id,
            entity.RequestCode,
            entity.Status.ToString().ToLowerInvariant(),
            entity.QuantityOnHandSnapshot,
            0,
            entity.ReviewedAt,
            null,
            null);
    }

    public async Task<List<StockExportSlipResponse>> GetStockExportSlipsAsync(
        string? search,
        CancellationToken ct = default)
    {
        var slips = await _exportSlipRepo.GetListAsync(search, ct);
        return slips.Select(MapExportSlip).ToList();
    }

    public async Task<StockExportSlipResponse?> GetStockExportSlipAsync(Guid id, CancellationToken ct = default)
    {
        var slip = await _exportSlipRepo.GetByIdAsync(id, ct);
        return slip == null ? null : MapExportSlip(slip);
    }

    private async Task<StockExportSlip> CreateExportSlipAsync(
        StockAdjustmentRequest request,
        int quantity,
        int warehouseBefore,
        int warehouseAfter,
        int storeBefore,
        int storeAfter,
        Guid createdBy,
        string? note,
        List<StockExportBatchAllocation>? batchAllocations,
        CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var countToday = await _exportSlipRepo.CountCreatedSinceAsync(today, ct);
        var slip = new StockExportSlip
        {
            Id = Guid.NewGuid(),
            ExportCode = $"PX-{today:yyyyMMdd}-{(countToday + 1):D4}",
            ExportType = _inventoryOptions.SimulateWarehouse ? "simulated_transfer" : "transfer_to_store",
            StockAdjustmentRequestId = request.Id,
            SkuId = request.SkuId,
            SkuCode = request.SkuCode,
            SkuSnapshotName = request.SkuSnapshotName,
            Quantity = quantity,
            WarehouseQtyBefore = warehouseBefore,
            WarehouseQtyAfter = warehouseAfter,
            StoreQtyBefore = storeBefore,
            StoreQtyAfter = storeAfter,
            Note = note ?? request.Reason,
            CreatedBy = createdBy == Guid.Empty ? request.RequestedBy : createdBy,
            CreatedAt = DateTime.UtcNow,
        };

        await _exportSlipRepo.AddAsync(slip, ct);
        await _exportSlipRepo.SaveChangesAsync(ct);

        if (batchAllocations is { Count: > 0 })
        {
            foreach (var allocation in batchAllocations)
                allocation.StockExportSlipId = slip.Id;

            await _exportAllocationRepo.AddRangeAsync(batchAllocations, ct);
            await _exportAllocationRepo.SaveChangesAsync(ct);
        }

        return slip;
    }

    private async Task<WarehouseBatchResponse> CreateWarehouseBatchInternalAsync(
        string lotCode,
        string? supplier,
        DateTime? expiresAt,
        string? note,
        List<CreateWarehouseBatchItemRequest> items,
        Guid createdBy,
        CancellationToken ct)
    {
        if (items == null || items.Count == 0)
            throw new InventoryValidationException("Lô phải có ít nhất một dòng SKU.");

        var normalizedLot = NormalizeLotCode(lotCode);
        if (string.IsNullOrWhiteSpace(normalizedLot))
            throw new InventoryValidationException("Mã lô là bắt buộc.");

        if (await _batchRepo.ExistsLotCodeAsync(normalizedLot, ct: ct))
            throw new InventoryValidationException($"Mã lô '{normalizedLot}' đã tồn tại.");

        var skuIds = items.Select(i => i.SkuId).ToList();
        if (skuIds.Distinct().Count() != skuIds.Count)
            throw new InventoryValidationException("Mỗi SKU chỉ xuất hiện một lần trong cùng một lô.");

        var now = DateTime.UtcNow;
        var batch = new WarehouseBatch
        {
            Id = Guid.NewGuid(),
            LotCode = normalizedLot,
            Supplier = supplier?.Trim(),
            ExpiresAt = expiresAt,
            Note = note?.Trim(),
            Status = "active",
            CreatedBy = createdBy == Guid.Empty ? Guid.Empty : createdBy,
            CreatedAt = now,
            UpdatedAt = now,
        };

        var touchedSkuIds = new HashSet<Guid>();
        foreach (var line in items)
        {
            if (line.Quantity <= 0)
                throw new InventoryValidationException("Số lượng nhập lô phải lớn hơn 0.");
            if (line.UnitCost is < 0)
                throw new InventoryValidationException("Giá vốn không được âm.");

            var stock = await GetOrCreateSkuStockAsync(line.SkuId, line.SkuCode, ct);
            batch.Items.Add(new WarehouseBatchItem
            {
                Id = Guid.NewGuid(),
                WarehouseBatchId = batch.Id,
                SkuId = line.SkuId,
                SkuCode = stock.SkuCode,
                ProductSnapshotName = line.ProductSnapshotName?.Trim(),
                QuantityOnHand = line.Quantity,
                InitialQuantity = line.Quantity,
                UnitCost = line.UnitCost,
                CreatedAt = now,
                UpdatedAt = now,
            });
            touchedSkuIds.Add(line.SkuId);
        }

        await _batchRepo.AddAsync(batch, ct);
        await _batchRepo.SaveChangesAsync(ct);

        foreach (var skuId in touchedSkuIds)
        {
            var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct);
            if (stock != null)
                await SyncWarehouseQtyFromBatchesAsync(stock, ct);
        }

        return MapWarehouseBatch(batch);
    }

    private async Task<List<StockExportBatchAllocation>> AllocateAndDeductBatchesFifoAsync(
        Guid skuId,
        int quantity,
        CancellationToken ct)
    {
        if (quantity <= 0)
            throw new InventoryValidationException("Số lượng xuất lô phải lớn hơn 0.");

        var batchItems = await _batchRepo.GetAvailableItemsForSkuAsync(skuId, ct);
        var remaining = quantity;
        var allocations = new List<StockExportBatchAllocation>();
        var touchedBatchIds = new HashSet<Guid>();

        foreach (var item in batchItems)
        {
            if (remaining <= 0) break;

            var take = Math.Min(item.QuantityOnHand, remaining);
            item.QuantityOnHand -= take;
            item.UpdatedAt = DateTime.UtcNow;

            allocations.Add(new StockExportBatchAllocation
            {
                Id = Guid.NewGuid(),
                WarehouseBatchId = item.WarehouseBatchId,
                WarehouseBatchItemId = item.Id,
                LotCode = item.Batch?.LotCode ?? string.Empty,
                SkuCode = item.SkuCode,
                Quantity = take,
            });

            touchedBatchIds.Add(item.WarehouseBatchId);
            remaining -= take;
        }

        if (remaining > 0)
        {
            throw new InventoryValidationException(
                $"Tồn lô không đủ. Thiếu {remaining} đơn vị so với yêu cầu {quantity}.");
        }

        await _batchRepo.SaveChangesAsync(ct);
        await RefreshBatchStatusesAsync(touchedBatchIds, ct);
        return allocations;
    }

    private async Task RefreshBatchStatusesAsync(IEnumerable<Guid> batchIds, CancellationToken ct)
    {
        foreach (var batchId in batchIds.Distinct())
        {
            var batch = await _batchRepo.GetByIdAsync(batchId, ct);
            if (batch == null) continue;

            var hasStock = batch.Items.Any(i => i.QuantityOnHand > 0);
            batch.Status = hasStock ? "active" : "depleted";
            batch.UpdatedAt = DateTime.UtcNow;
        }

        await _batchRepo.SaveChangesAsync(ct);
    }

    private async Task SyncWarehouseQtyFromBatchesAsync(SkuStock stock, CancellationToken ct)
    {
        stock.WarehouseQuantityOnHand = await _batchRepo.SumQuantityOnHandAsync(stock.SkuId, ct);
        stock.UpdatedAt = DateTime.UtcNow;
        await _skuStockRepo.SaveChangesAsync(ct);
    }

    private static string NormalizeLotCode(string lotCode) =>
        lotCode.Trim().ToUpperInvariant();

    private async Task<SkuStock> GetOrCreateSkuStockAsync(
        Guid skuId,
        string? skuCode,
        CancellationToken ct)
    {
        var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct);
        if (stock != null) return stock;

        stock = new SkuStock
        {
            SkuId = skuId,
            SkuCode = string.IsNullOrWhiteSpace(skuCode) ? skuId.ToString()[..8] : skuCode.Trim(),
            WeightInGrams = 0,
            QuantityOnHand = 0,
            WarehouseQuantityOnHand = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await _skuStockRepo.AddAsync(stock, ct);
        return stock;
    }

    private static SkuStockResponse MapSkuStock(SkuStock stock) => new(
        stock.SkuId,
        stock.SkuCode,
        stock.WeightInGrams,
        stock.QuantityOnHand,
        stock.WarehouseQuantityOnHand,
        stock.UpdatedAt);

    private static WarehouseBatchResponse MapWarehouseBatch(WarehouseBatch batch)
    {
        var items = batch.Items
            .OrderBy(i => i.SkuCode)
            .Select(i => new WarehouseBatchItemResponse(
                i.Id,
                i.SkuId,
                i.SkuCode,
                i.ProductSnapshotName,
                i.QuantityOnHand,
                i.InitialQuantity,
                i.UnitCost))
            .ToList();

        return new WarehouseBatchResponse(
            batch.Id,
            batch.LotCode,
            batch.Supplier,
            batch.ExpiresAt,
            batch.Note,
            batch.Status,
            items.Sum(i => i.QuantityOnHand),
            items.Count,
            batch.CreatedBy,
            batch.CreatedAt,
            batch.UpdatedAt,
            items);
    }

    private static StockExportSlipResponse MapExportSlip(StockExportSlip slip) => new(
        slip.Id,
        slip.ExportCode,
        slip.ExportType,
        slip.StockAdjustmentRequestId,
        null,
        slip.SkuId,
        slip.SkuCode,
        slip.SkuSnapshotName,
        slip.Quantity,
        slip.WarehouseQtyBefore,
        slip.WarehouseQtyAfter,
        slip.StoreQtyBefore,
        slip.StoreQtyAfter,
        slip.Note,
        slip.CreatedBy,
        slip.CreatedAt,
        slip.BatchAllocations.Select(a => new StockExportBatchAllocationResponse(
            a.Id, a.WarehouseBatchId, a.WarehouseBatchItemId, a.LotCode, a.SkuCode, a.Quantity)).ToList());

    private static StockAdjustmentRequestResponse MapAdjustmentRequest(StockAdjustmentRequest entity) => new(
        entity.Id,
        entity.RequestCode,
        entity.SkuId,
        entity.SkuCode,
        entity.SkuSnapshotName,
        entity.QuantityDelta,
        entity.Reason,
        entity.Status.ToString().ToLowerInvariant(),
        entity.QuantityOnHandSnapshot,
        entity.QuantityOnHandAfter,
        entity.RequestedBy,
        entity.RequestedAt,
        entity.ReviewedBy,
        entity.ReviewedAt,
        entity.ReviewNote,
        entity.ExportSlipId,
        entity.ExportSlip?.ExportCode);
}
