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
    IStockImportSlipRepository _importSlipRepo,
    IWarehouseBatchRepository _batchRepo,
    IStockExportBatchAllocationRepository _exportAllocationRepo,
    IProcessedIntegrationEventRepository _processedEvents,
    IInventoryEventPublisher _eventPublisher,
    IInventoryUnitOfWork _unitOfWork,
    IProductionOrderRepository _productionOrderRepo,
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

    public async Task<PagedResponse<StockDeductQueueResponse>> GetWaitingQueuesPagedAsync(
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (safePage, safePageSize) = NormalizePagination(page, pageSize);
        var (queues, totalCount) = await _queueRepo.GetWaitingPagedAsync(search, safePage, safePageSize, ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)safePageSize));
        return new PagedResponse<StockDeductQueueResponse>(
            queues.Select(MapQueue).ToList(),
            safePage,
            safePageSize,
            totalCount,
            totalPages);
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

        var result = await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var shortages = new List<StockShortage>();
            var stockBySkuId = new Dictionary<Guid, SkuStock>();

            foreach (var item in queue.Items)
            {
                var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(item.SkuId, innerCt);
                if (stock == null || stock.QuantityOnHand < item.Quantity)
                {
                    shortages.Add(new StockShortage(
                        item.SkuId,
                        item.SkuSnapshotName,
                        item.Quantity,
                        stock?.QuantityOnHand ?? 0,
                        item.Quantity - (stock?.QuantityOnHand ?? 0)));
                }
                else
                {
                    stockBySkuId[item.SkuId] = stock;
                }
            }

            if (shortages.Count > 0)
                throw new InsufficientStockException("Không đủ tồn kho để trừ.", shortages);

            foreach (var item in queue.Items)
            {
                var stock = stockBySkuId[item.SkuId];
                stock.QuantityOnHand -= item.Quantity;
                stock.UpdatedAt = DateTime.UtcNow;
            }

            queue.IsDeducted = true;
            queue.QueueStatus = QueueStatus.Confirmed;
            queue.OrderStockStatus = "deducted";
            queue.ConfirmedAt = DateTime.UtcNow;

            await _queueRepo.SaveChangesAsync(innerCt);
            return queue;
        }, ct);

        await _eventPublisher.PublishStockDeductedAsync(result.OrderId, result.OrderCode, true, ct);
        await CheckAndNotifyLowStockAsync(result.Items, ct);

        return new StockDeductConfirmResponse(
            result.Id, result.OrderId, result.OrderCode,
            result.QueueStatus.ToString().ToLowerInvariant(),
            result.OrderStockStatus,
            result.ConfirmedAt);
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

    public async Task<SkuStockResponse> UpdateLowStockThresholdAsync(
        Guid skuId, int threshold, CancellationToken ct = default)
    {
        if (threshold < 0)
            throw new InventoryValidationException("Ngưỡng tồn thấp không được âm.");

        var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct)
            ?? throw new InventoryNotFoundException($"Không tìm thấy tồn kho cho SKU '{skuId}'.");

        stock.LowStockThreshold = threshold;
        stock.UpdatedAt = DateTime.UtcNow;
        await _skuStockRepo.SaveChangesAsync(ct);
        return MapSkuStock(stock);
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

    private async Task CheckAndNotifyLowStockAsync(
        ICollection<StockDeductQueueItem> items, CancellationToken ct)
    {
        foreach (var item in items)
        {
            var stock = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, ct);
            if (stock != null && stock.QuantityOnHand <= stock.LowStockThreshold)
                await _eventPublisher.PublishLowStockAsync(
                    stock.SkuId, stock.SkuCode, stock.QuantityOnHand, stock.LowStockThreshold, ct);
        }
    }

    private async Task RestoreStockAsync(StockDeductQueue queue, CancellationToken ct)    {
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

        if (request.Items == null || request.Items.Count == 0)
            throw new InventoryValidationException("Yêu cầu phải có ít nhất một dòng SKU.");

        var skuIds = request.Items.Select(i => i.SkuId).ToList();
        if (skuIds.Distinct().Count() != skuIds.Count)
            throw new InventoryValidationException("Mỗi SKU chỉ được xuất hiện một lần trong cùng một yêu cầu.");

        var reason = request.Reason?.Trim();
        var hasDecrease = request.Items.Any(i => i.QuantityDelta < 0);
        if (hasDecrease && string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Yêu cầu có giảm tồn cần ghi rõ lý do chung cho lô.");

        var today = DateTime.UtcNow.Date;
        var countToday = await _adjustmentRequestRepo.CountCreatedSinceAsync(today, ct);
        var entity = new StockAdjustmentRequest
        {
            Id = Guid.NewGuid(),
            RequestCode = $"YC-{today:yyyyMMdd}-{(countToday + 1):D4}",
            Reason = reason,
            Status = StockAdjustmentRequestStatus.Pending,
            RequestedBy = requestedBy,
            RequestedAt = DateTime.UtcNow,
        };

        foreach (var line in request.Items)
        {
            if (line.QuantityDelta == 0)
                throw new InventoryValidationException("Số lượng thay đổi phải khác 0.");

            var stock = await _skuStockRepo.GetBySkuIdAsync(line.SkuId, ct);
            var onHand = stock?.QuantityOnHand ?? 0;
            var skuCode = line.SkuCode?.Trim()
                ?? stock?.SkuCode
                ?? line.SkuId.ToString()[..8];
            var skuName = line.SkuSnapshotName?.Trim() ?? skuCode;

            entity.Items.Add(new StockAdjustmentRequestItem
            {
                Id = Guid.NewGuid(),
                RequestId = entity.Id,
                SkuId = line.SkuId,
                SkuCode = skuCode,
                SkuSnapshotName = skuName,
                QuantityDelta = line.QuantityDelta,
                QuantityOnHandSnapshot = onHand,
            });
        }

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

    public async Task<PagedResponse<StockAdjustmentRequestResponse>> GetStockAdjustmentRequestsPagedAsync(
        string? status,
        Guid? requestedBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (parsedStatus, excludePending) = ParseAdjustmentStatus(status);
        var (safePage, safePageSize) = NormalizePagination(page, pageSize);
        var (items, totalCount) = await _adjustmentRequestRepo.GetPagedAsync(
            parsedStatus,
            excludePending,
            requestedBy,
            search,
            safePage,
            safePageSize,
            ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)safePageSize));
        return new PagedResponse<StockAdjustmentRequestResponse>(
            items.Select(MapAdjustmentRequest).ToList(),
            safePage,
            safePageSize,
            totalCount,
            totalPages);
    }

    private static (StockAdjustmentRequestStatus? Status, bool ExcludePending) ParseAdjustmentStatus(string? status)
    {
        if (string.Equals(status, "processed", StringComparison.OrdinalIgnoreCase))
            return (null, true);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<StockAdjustmentRequestStatus>(status, true, out var value))
        {
            return (value, false);
        }

        return (null, false);
    }

    private static (int Page, int PageSize) NormalizePagination(int page, int pageSize)
    {
        var safePage = page < 1 ? 1 : page;
        var safePageSize = pageSize < 1 ? 10 : Math.Min(pageSize, 50);
        return (safePage, safePageSize);
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

        if (entity.Items.Count == 0)
            throw new InventoryValidationException("Yêu cầu không có dòng SKU.");

        var exportSlips = new List<StockAdjustmentExportSlipSummary>();

        foreach (var line in entity.Items)
        {
            var stock = await GetOrCreateSkuStockAsync(line.SkuId, line.SkuCode, ct);
            StockExportSlip? exportSlip = null;

            if (line.QuantityDelta > 0)
            {
                var warehouseBefore = stock.WarehouseQuantityOnHand;
                var storeBefore = stock.QuantityOnHand;

                if (_inventoryOptions.SimulateWarehouse)
                {
                    stock.QuantityOnHand += line.QuantityDelta;
                    stock.UpdatedAt = DateTime.UtcNow;

                    exportSlip = await CreateExportSlipAsync(
                        entity,
                        line,
                        line.QuantityDelta,
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
                    var batchTotal = await _batchRepo.SumQuantityOnHandAsync(line.SkuId, ct);
                    if (batchTotal < line.QuantityDelta)
                    {
                        throw new InventoryValidationException(
                            $"SKU {line.SkuCode}: tồn lô trong kho không đủ để xuất. Có {batchTotal}, yêu cầu {line.QuantityDelta}. Hãy nhập lô trước.");
                    }

                    var allocations = await AllocateAndDeductBatchesFifoAsync(
                        line.SkuId, line.QuantityDelta, ct);

                    await SyncWarehouseQtyFromBatchesAsync(stock, ct);
                    stock.QuantityOnHand += line.QuantityDelta;
                    stock.UpdatedAt = DateTime.UtcNow;

                    exportSlip = await CreateExportSlipAsync(
                        entity,
                        line,
                        line.QuantityDelta,
                        warehouseBefore,
                        stock.WarehouseQuantityOnHand,
                        storeBefore,
                        stock.QuantityOnHand,
                        reviewedBy,
                        entity.Reason,
                        allocations,
                        ct);
                }

                line.ExportSlipId = exportSlip.Id;
                if (exportSlip != null)
                {
                    exportSlips.Add(new StockAdjustmentExportSlipSummary(
                        exportSlip.Id,
                        exportSlip.ExportCode,
                        line.SkuId,
                        line.SkuCode));
                }
            }
            else
            {
                if (stock.QuantityOnHand + line.QuantityDelta < 0)
                {
                    throw new InventoryValidationException(
                        $"SKU {line.SkuCode}: tồn cửa hàng không đủ. Hiện có {stock.QuantityOnHand}, yêu cầu giảm {Math.Abs(line.QuantityDelta)}.");
                }

                stock.QuantityOnHand = Math.Max(0, stock.QuantityOnHand + line.QuantityDelta);
                stock.UpdatedAt = DateTime.UtcNow;
            }

            line.QuantityOnHandAfter = stock.QuantityOnHand;
            line.WarehouseQuantityOnHandAfter = stock.WarehouseQuantityOnHand;
        }

        entity.Status = StockAdjustmentRequestStatus.Approved;
        entity.ReviewedBy = reviewedBy == Guid.Empty ? null : reviewedBy;
        entity.ReviewedAt = DateTime.UtcNow;
        await _skuStockRepo.SaveChangesAsync(ct);
        await _adjustmentRequestRepo.SaveChangesAsync(ct);

        return new StockAdjustmentReviewResponse(
            entity.Id,
            entity.RequestCode,
            entity.Status.ToString().ToLowerInvariant(),
            entity.ReviewedAt,
            exportSlips);
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

        return new StockAdjustmentReviewResponse(
            entity.Id,
            entity.RequestCode,
            entity.Status.ToString().ToLowerInvariant(),
            entity.ReviewedAt,
            []);
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
            entity.ReviewedAt,
            []);
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

    public async Task<List<StockImportSlipResponse>> GetStockImportSlipsAsync(
        string? search,
        CancellationToken ct = default)
    {
        var slips = await _importSlipRepo.GetListAsync(search, ct);
        return slips.Select(MapImportSlip).ToList();
    }

    public async Task<StockImportSlipResponse?> GetStockImportSlipAsync(Guid id, CancellationToken ct = default)
    {
        var slip = await _importSlipRepo.GetByIdAsync(id, ct);
        return slip == null ? null : MapImportSlip(slip);
    }

    private async Task<StockExportSlip> CreateExportSlipAsync(
        StockAdjustmentRequest request,
        StockAdjustmentRequestItem line,
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
            SkuId = line.SkuId,
            SkuCode = line.SkuCode,
            SkuSnapshotName = line.SkuSnapshotName,
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
        CancellationToken ct,
        string? sourceType = null,
        Guid? sourceReferenceId = null,
        string? sourceReferenceCode = null)
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
            SourceType = sourceType?.Trim(),
            SourceReferenceId = sourceReferenceId,
            SourceReferenceCode = sourceReferenceCode?.Trim(),
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

            var newMac = await _batchRepo.CalculateMovingAverageCostAsync(skuId, ct);
            await _eventPublisher.PublishCostPriceUpdatedAsync(skuId, newMac, ct);
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
        stock.LowStockThreshold,
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
            batch.SourceType,
            batch.SourceReferenceId,
            batch.SourceReferenceCode,
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
        slip.ProductionOrderId,
        slip.ProductionCode,
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
        slip.BatchAllocations.Select(MapExportBatchAllocation).ToList(),
        slip.Lines
            .OrderBy(l => l.SkuCode)
            .Select(MapExportSlipLine)
            .ToList());

    private static StockExportSlipLineResponse MapExportSlipLine(StockExportSlipLine line) => new(
        line.Id,
        line.SkuId,
        line.SkuCode,
        line.ProductSnapshotName,
        line.Quantity,
        line.WarehouseQtyBefore,
        line.WarehouseQtyAfter,
        line.StoreQtyBefore,
        line.StoreQtyAfter,
        line.Note,
        line.CreatedAt,
        line.BatchAllocations.Select(MapExportBatchAllocation).ToList());

    private static StockExportBatchAllocationResponse MapExportBatchAllocation(StockExportBatchAllocation allocation) => new(
        allocation.Id,
        allocation.StockExportSlipLineId,
        allocation.WarehouseBatchId,
        allocation.WarehouseBatchItemId,
        allocation.LotCode,
        allocation.SkuCode,
        allocation.Quantity);

    private static StockImportSlipResponse MapImportSlip(StockImportSlip slip) => new(
        slip.Id,
        slip.ImportCode,
        slip.ImportType,
        slip.SkuId,
        slip.SkuCode,
        slip.ProductSnapshotName,
        slip.Quantity,
        slip.WarehouseQtyBefore,
        slip.WarehouseQtyAfter,
        slip.StoreQtyBefore,
        slip.StoreQtyAfter,
        slip.WarehouseBatchId,
        slip.WarehouseBatchLotCode,
        slip.ProductionOrderId,
        slip.ProductionCode,
        slip.Note,
        slip.CreatedBy,
        slip.CreatedAt,
        BuildStockImportSlipLineResponses(slip));

    private static List<StockImportSlipLineResponse> BuildStockImportSlipLineResponses(StockImportSlip slip)
    {
        var lines = slip.Lines
            .OrderBy(l => l.SkuCode)
            .Select(MapImportSlipLine)
            .ToList();

        if (lines.Count > 0)
            return lines;

        return
        [
            new StockImportSlipLineResponse(
                Guid.Empty,
                slip.SkuId,
                slip.SkuCode,
                slip.ProductSnapshotName,
                slip.Quantity,
                slip.WarehouseQtyBefore,
                slip.WarehouseQtyAfter,
                slip.StoreQtyBefore,
                slip.StoreQtyAfter,
                slip.WarehouseBatchId,
                slip.WarehouseBatchLotCode,
                null,
                slip.Note,
                slip.CreatedAt)
        ];
    }

    private static StockImportSlipLineResponse MapImportSlipLine(StockImportSlipLine line) => new(
        line.Id,
        line.SkuId,
        line.SkuCode,
        line.ProductSnapshotName,
        line.Quantity,
        line.WarehouseQtyBefore,
        line.WarehouseQtyAfter,
        line.StoreQtyBefore,
        line.StoreQtyAfter,
        line.WarehouseBatchId,
        line.WarehouseBatchLotCode,
        line.ProductionOrderOutputLineId,
        line.Note,
        line.CreatedAt);

    private static StockAdjustmentRequestItemResponse MapAdjustmentRequestItem(StockAdjustmentRequestItem item) => new(
        item.Id,
        item.SkuId,
        item.SkuCode,
        item.SkuSnapshotName,
        item.QuantityDelta,
        item.QuantityOnHandSnapshot,
        item.QuantityOnHandAfter,
        item.WarehouseQuantityOnHandAfter,
        item.ExportSlipId,
        item.ExportSlip?.ExportCode);

    private static StockAdjustmentRequestResponse MapAdjustmentRequest(StockAdjustmentRequest entity) => new(
        entity.Id,
        entity.RequestCode,
        entity.Reason,
        entity.Status.ToString().ToLowerInvariant(),
        entity.RequestedBy,
        entity.RequestedAt,
        entity.ReviewedBy,
        entity.ReviewedAt,
        entity.ReviewNote,
        entity.Items
            .OrderBy(i => i.SkuCode)
            .Select(MapAdjustmentRequestItem)
            .ToList());

    public async Task<List<SkuStockResponse>> GetLowStockSkusAsync(CancellationToken ct = default)
    {
        var stocks = await _skuStockRepo.GetAllAsync(ct);
        return stocks
            .Where(s => s.QuantityOnHand <= s.LowStockThreshold)
            .Select(MapSkuStock)
            .ToList();
    }

    // ── Production Orders ──────────────────────────────────────────────────────

    public async Task<ProductionOrderResponse> CreateProductionOrderAsync(
        CreateProductionOrderRequest request,
        Guid userId,
        CancellationToken ct = default)
    {
        var output = ResolveSingleProductionOutput(request);

        if (output.Quantity <= 0)
            throw new InventoryValidationException("Số lượng sản xuất phải lớn hơn 0.");
        if (request.Lines == null || request.Lines.Count == 0)
            throw new InventoryValidationException("Lệnh sản xuất phải có ít nhất một dòng nguyên liệu.");
        foreach (var line in request.Lines)
        {
            if (line.PlannedQuantity <= 0)
                throw new InventoryValidationException($"Số lượng nguyên liệu {line.MaterialSkuCode} phải lớn hơn 0.");
        }

        var today = DateTime.UtcNow.Date;
        var countToday = await _productionOrderRepo.CountCreatedSinceAsync(today, ct);
        var now = DateTime.UtcNow;
        var orderId = Guid.NewGuid();

        var order = new ProductionOrder
        {
            Id = orderId,
            ProductionCode = $"SX-{today:yyyyMMdd}-{(countToday + 1):D4}",
            FinishedSkuId = output.FinishedSkuId,
            FinishedSkuCode = output.FinishedSkuCode,
            FinishedSkuSnapshotName = output.FinishedSkuSnapshotName,
            Quantity = output.Quantity,
            Note = request.Note?.Trim(),
            Status = ProductionOrderStatus.Draft,
            CreatedBy = userId,
            CreatedAt = now,
            UpdatedAt = now,
            OutputLines =
            [
                new ProductionOrderOutputLine
                {
                    Id = Guid.NewGuid(),
                    ProductionOrderId = orderId,
                    FinishedSkuId = output.FinishedSkuId,
                    FinishedSkuCode = output.FinishedSkuCode,
                    FinishedSkuSnapshotName = output.FinishedSkuSnapshotName,
                    Quantity = output.Quantity,
                    CreatedAt = now,
                }
            ],
            Lines = request.Lines.Select(l => new ProductionOrderLine
            {
                Id = Guid.NewGuid(),
                MaterialSkuId = l.MaterialSkuId,
                MaterialSkuCode = l.MaterialSkuCode,
                MaterialSnapshotName = l.MaterialSnapshotName,
                PlannedQuantity = l.PlannedQuantity,
                CreatedAt = now,
            }).ToList()
        };

        await _productionOrderRepo.AddAsync(order, ct);
        await _productionOrderRepo.SaveChangesAsync(ct);

        return MapProductionOrder(order);
    }

    private static ProductionOrderOutputLineInput ResolveSingleProductionOutput(CreateProductionOrderRequest request)
    {
        if (request.Outputs is { Count: > 1 })
            throw new InventoryValidationException("Multi-output production orders are not enabled in this batch.");

        if (request.Outputs is { Count: 1 })
            return request.Outputs[0];

        return new ProductionOrderOutputLineInput(
            request.FinishedSkuId,
            request.FinishedSkuCode,
            request.FinishedSkuSnapshotName,
            request.Quantity);
    }

    public async Task<ProductionOrderResponse> CompleteProductionOrderAsync(
        Guid id,
        Guid userId,
        CancellationToken ct = default)
    {
        var order = await _productionOrderRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy lệnh sản xuất.");

        if (order.Status != ProductionOrderStatus.Draft)
            throw new InventoryValidationException("Chỉ có thể hoàn thành lệnh đang ở trạng thái Nháp.");

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var now = DateTime.UtcNow;
            var materialSkuIds = new List<Guid>();
            var outputLine = EnsureSingleProductionOutputLine(order, now);
            var materialLines = order.Lines.OrderBy(l => l.MaterialSkuCode).ToList();
            if (materialLines.Count == 0)
                throw new InventoryValidationException("Lệnh sản xuất phải có ít nhất một dòng nguyên liệu.");

            var firstMaterialLine = materialLines[0];
            var exportCountToday = await _exportSlipRepo.CountCreatedSinceAsync(now.Date, innerCt);
            var exportSlip = new StockExportSlip
            {
                Id = Guid.NewGuid(),
                ExportCode = $"PX-{now:yyyyMMdd}-{(exportCountToday + 1):D4}",
                ExportType = "production",
                StockAdjustmentRequestId = null,
                ProductionOrderId = order.Id,
                ProductionCode = order.ProductionCode,
                SkuId = materialLines.Count == 1 ? firstMaterialLine.MaterialSkuId : Guid.Empty,
                SkuCode = materialLines.Count == 1 ? firstMaterialLine.MaterialSkuCode : "MULTI",
                SkuSnapshotName = materialLines.Count == 1
                    ? firstMaterialLine.MaterialSnapshotName
                    : $"{materialLines.Count} dòng nguyên liệu",
                Quantity = materialLines.Sum(l => l.PlannedQuantity),
                WarehouseQtyBefore = 0,
                WarehouseQtyAfter = 0,
                StoreQtyBefore = 0,
                StoreQtyAfter = 0,
                Note = $"Xuất nguyên liệu cho lệnh sản xuất {order.ProductionCode}",
                CreatedBy = userId,
                CreatedAt = now,
            };
            var allAllocations = new List<StockExportBatchAllocation>();

            foreach (var line in materialLines)
            {
                var stock = await _skuStockRepo.GetBySkuIdAsync(line.MaterialSkuId, innerCt);
                var warehouseBefore = stock?.WarehouseQuantityOnHand ?? 0;
                var storeBefore = stock?.QuantityOnHand ?? 0;

                var allocations = await AllocateAndDeductBatchesFifoAsync(
                    line.MaterialSkuId, line.PlannedQuantity, innerCt);

                if (stock != null)
                    await SyncWarehouseQtyFromBatchesAsync(stock, innerCt);

                var warehouseAfter = stock?.WarehouseQuantityOnHand ?? 0;
                var storeAfter = stock?.QuantityOnHand ?? 0;

                var slipLine = new StockExportSlipLine
                {
                    Id = Guid.NewGuid(),
                    StockExportSlipId = exportSlip.Id,
                    SkuId = line.MaterialSkuId,
                    SkuCode = line.MaterialSkuCode,
                    ProductSnapshotName = line.MaterialSnapshotName,
                    Quantity = line.PlannedQuantity,
                    WarehouseQtyBefore = warehouseBefore,
                    WarehouseQtyAfter = warehouseAfter,
                    StoreQtyBefore = storeBefore,
                    StoreQtyAfter = storeAfter,
                    Note = $"Sản xuất lô {order.ProductionCode}",
                    CreatedAt = now,
                };

                foreach (var alloc in allocations)
                {
                    alloc.StockExportSlipId = exportSlip.Id;
                    alloc.StockExportSlipLineId = slipLine.Id;
                }

                exportSlip.WarehouseQtyBefore += warehouseBefore;
                exportSlip.WarehouseQtyAfter += warehouseAfter;
                exportSlip.StoreQtyBefore += storeBefore;
                exportSlip.StoreQtyAfter += storeAfter;
                exportSlip.Lines.Add(slipLine);
                allAllocations.AddRange(allocations);
                materialSkuIds.Add(line.MaterialSkuId);
            }

            await _exportSlipRepo.AddAsync(exportSlip, innerCt);
            await _exportSlipRepo.SaveChangesAsync(innerCt);

            if (allAllocations.Count > 0)
            {
                await _exportAllocationRepo.AddRangeAsync(allAllocations, innerCt);
                await _exportAllocationRepo.SaveChangesAsync(innerCt);
            }

            var finishedStockBefore = await _skuStockRepo.GetBySkuIdAsync(order.FinishedSkuId, innerCt);
            var finishedWarehouseBefore = finishedStockBefore?.WarehouseQuantityOnHand ?? 0;
            var finishedStoreBefore = finishedStockBefore?.QuantityOnHand ?? 0;

            var finishedBatch = await CreateWarehouseBatchInternalAsync(
                lotCode: $"SX-{now:yyyyMMddHHmmss}",
                supplier: null,
                expiresAt: null,
                note: $"Sản xuất lô {order.ProductionCode}",
                items: [new CreateWarehouseBatchItemRequest(
                    order.FinishedSkuId,
                    order.FinishedSkuCode,
                    order.FinishedSkuSnapshotName,
                    order.Quantity,
                    null)],
                createdBy: userId,
                ct: innerCt,
                sourceType: "production_finished_goods",
                sourceReferenceId: order.Id,
                sourceReferenceCode: order.ProductionCode);

            outputLine.WarehouseBatchId = finishedBatch.Id;
            outputLine.WarehouseBatchLotCode = finishedBatch.LotCode;
            await _productionOrderRepo.SaveChangesAsync(innerCt);

            var finishedStockAfter = await _skuStockRepo.GetBySkuIdAsync(order.FinishedSkuId, innerCt);
            var finishedWarehouseAfter = finishedStockAfter?.WarehouseQuantityOnHand ?? finishedWarehouseBefore;
            var finishedStoreAfter = finishedStockAfter?.QuantityOnHand ?? finishedStoreBefore;
            var importCountToday = await _importSlipRepo.CountCreatedSinceAsync(now.Date, innerCt);
            var importSlipId = Guid.NewGuid();
            var importSlip = new StockImportSlip
            {
                Id = importSlipId,
                ImportCode = $"PN-{now:yyyyMMdd}-{(importCountToday + 1):D4}",
                ImportType = "production_finished_goods_receipt",
                SkuId = order.FinishedSkuId,
                SkuCode = order.FinishedSkuCode,
                ProductSnapshotName = order.FinishedSkuSnapshotName,
                Quantity = order.Quantity,
                WarehouseQtyBefore = finishedWarehouseBefore,
                WarehouseQtyAfter = finishedWarehouseAfter,
                StoreQtyBefore = finishedStoreBefore,
                StoreQtyAfter = finishedStoreAfter,
                WarehouseBatchId = finishedBatch.Id,
                WarehouseBatchLotCode = finishedBatch.LotCode,
                ProductionOrderId = order.Id,
                ProductionCode = order.ProductionCode,
                Note = $"Nhập thành phẩm từ lệnh {order.ProductionCode}",
                CreatedBy = userId,
                CreatedAt = now,
                Lines =
                [
                    new StockImportSlipLine
                    {
                        Id = Guid.NewGuid(),
                        StockImportSlipId = importSlipId,
                        SkuId = order.FinishedSkuId,
                        SkuCode = order.FinishedSkuCode,
                        ProductSnapshotName = order.FinishedSkuSnapshotName,
                        Quantity = order.Quantity,
                        WarehouseQtyBefore = finishedWarehouseBefore,
                        WarehouseQtyAfter = finishedWarehouseAfter,
                        StoreQtyBefore = finishedStoreBefore,
                        StoreQtyAfter = finishedStoreAfter,
                        WarehouseBatchId = finishedBatch.Id,
                        WarehouseBatchLotCode = finishedBatch.LotCode,
                        ProductionOrderOutputLineId = outputLine.Id,
                        Note = $"Nhập thành phẩm từ lệnh {order.ProductionCode}",
                        CreatedAt = now,
                    }
                ],
            };
            await _importSlipRepo.AddAsync(importSlip, innerCt);
            await _importSlipRepo.SaveChangesAsync(innerCt);

            order.Status = ProductionOrderStatus.Completed;
            order.CompletedAt = now;
            order.UpdatedAt = now;
            await _productionOrderRepo.SaveChangesAsync(innerCt);

            foreach (var skuId in materialSkuIds)
            {
                var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, innerCt);
                if (stock != null && stock.WarehouseQuantityOnHand <= stock.LowStockThreshold)
                    await _eventPublisher.PublishLowStockAsync(
                        stock.SkuId, stock.SkuCode, stock.WarehouseQuantityOnHand, stock.LowStockThreshold, innerCt);
            }

            return MapProductionOrder(order);
        }, ct);
    }

    private static ProductionOrderOutputLine EnsureSingleProductionOutputLine(ProductionOrder order, DateTime now)
    {
        if (order.OutputLines.Count > 1)
            throw new InventoryValidationException("Multi-output production orders are not enabled in this batch.");

        var outputLine = order.OutputLines.FirstOrDefault();
        if (outputLine != null) return outputLine;

        outputLine = new ProductionOrderOutputLine
        {
            Id = Guid.NewGuid(),
            ProductionOrderId = order.Id,
            FinishedSkuId = order.FinishedSkuId,
            FinishedSkuCode = order.FinishedSkuCode,
            FinishedSkuSnapshotName = order.FinishedSkuSnapshotName,
            Quantity = order.Quantity,
            CreatedAt = order.CreatedAt == default ? now : order.CreatedAt,
        };
        order.OutputLines.Add(outputLine);
        return outputLine;
    }

    public async Task<ProductionOrderResponse> CancelProductionOrderAsync(
        Guid id,
        Guid userId,
        CancellationToken ct = default)
    {
        var order = await _productionOrderRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy lệnh sản xuất.");

        if (order.Status != ProductionOrderStatus.Draft)
            throw new InventoryValidationException("Chỉ có thể hủy lệnh đang ở trạng thái Nháp.");

        order.Status = ProductionOrderStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;
        await _productionOrderRepo.SaveChangesAsync(ct);

        return MapProductionOrder(order);
    }

    public async Task<PagedResponse<ProductionOrderResponse>> GetProductionOrdersAsync(
        string? status,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        ProductionOrderStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ProductionOrderStatus>(status, true, out var parsed))
            statusFilter = parsed;

        var (items, total) = await _productionOrderRepo.GetPagedAsync(statusFilter, page, pageSize, ct);
        var totalPages = (int)Math.Ceiling(total / (double)pageSize);

        return new PagedResponse<ProductionOrderResponse>(
            items.Select(MapProductionOrder).ToList(),
            page,
            pageSize,
            total,
            totalPages);
    }

    public async Task<ProductionOrderResponse?> GetProductionOrderByIdAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _productionOrderRepo.GetByIdAsync(id, ct);
        return order == null ? null : MapProductionOrder(order);
    }

    private static ProductionOrderResponse MapProductionOrder(ProductionOrder order) => new(
        order.Id,
        order.ProductionCode,
        order.FinishedSkuId,
        order.FinishedSkuCode,
        order.FinishedSkuSnapshotName,
        order.Quantity,
        order.Note,
        order.Status.ToString(),
        order.CreatedBy,
        order.CreatedAt,
        order.CompletedAt,
        order.Lines
            .OrderBy(l => l.MaterialSkuCode)
            .Select(l => new ProductionOrderLineResponse(
                l.Id,
                l.MaterialSkuId,
                l.MaterialSkuCode,
                l.MaterialSnapshotName,
                l.PlannedQuantity))
            .ToList(),
        BuildProductionOrderOutputResponses(order));

    private static List<ProductionOrderOutputLineResponse> BuildProductionOrderOutputResponses(ProductionOrder order)
    {
        var outputLines = order.OutputLines
            .OrderBy(l => l.FinishedSkuCode)
            .Select(l => new ProductionOrderOutputLineResponse(
                l.Id,
                l.FinishedSkuId,
                l.FinishedSkuCode,
                l.FinishedSkuSnapshotName,
                l.Quantity,
                l.WarehouseBatchId,
                l.WarehouseBatchLotCode,
                l.CreatedAt))
            .ToList();

        if (outputLines.Count > 0)
            return outputLines;

        return
        [
            new ProductionOrderOutputLineResponse(
                Guid.Empty,
                order.FinishedSkuId,
                order.FinishedSkuCode,
                order.FinishedSkuSnapshotName,
                order.Quantity,
                null,
                null,
                order.CreatedAt)
        ];
    }

    public async Task DeductMaterialsAsync(
        IEnumerable<(Guid SkuId, int Quantity)> items,
        CancellationToken ct = default)
    {
        var itemList = items.ToList();
        foreach (var (skuId, quantity) in itemList)
        {
            if (quantity <= 0) continue;

            var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct)
                ?? throw new InventoryValidationException($"Không tìm thấy tồn kho cho SKU {skuId}.");

            await AllocateAndDeductBatchesFifoAsync(skuId, quantity, ct);
            await SyncWarehouseQtyFromBatchesAsync(stock, ct);
        }

        foreach (var (skuId, _) in itemList)
        {
            var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct);
            if (stock != null && stock.WarehouseQuantityOnHand <= stock.LowStockThreshold)
                await _eventPublisher.PublishLowStockAsync(
                    stock.SkuId, stock.SkuCode, stock.WarehouseQuantityOnHand, stock.LowStockThreshold, ct);
        }
    }
}
