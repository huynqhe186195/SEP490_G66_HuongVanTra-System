using HuongVanTra.Shared.Messages;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.Interfaces;
using InventoryService.Application.Options;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Domain.Exceptions;
using Microsoft.Extensions.Options;
using System.Text.Json;

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
    IProductCatalogClient _productCatalogClient,
    IOptions<InventoryOptions> inventoryOptions)
{
    private readonly InventoryOptions _inventoryOptions = inventoryOptions.Value;

    public bool IsSimulateWarehouse => _inventoryOptions.SimulateWarehouse;

    public const string SkuCreatedEventType = "SkuCreated";
    public const string OrderPlacedEventType = "OrderPlaced";
    public const string OrderCancelledEventType = "OrderCancelled";
    public const string OrderReturnedEventType = "OrderReturned";
    private const string StockHandlingModeImmediate = "ImmediateFinishedStockOnly";
    private const string StockHandlingModeFullBomPending = "FullBomPending";
    private const string StockHandlingModePartialBomPending = "PartialFinishedDeductedBomPending";
    private const string StockHandlingModeLegacy = "LegacyPendingFinishedStock";
    private static readonly JsonSerializerOptions MaterialSnapshotJsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
    };

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
            return;

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

    }

    private async Task TryAutoConfirmQueueAsync(Guid queueId, CancellationToken ct)
    {
        try
        {
            await ConfirmQueueAsync(queueId, Guid.Empty, null, ct);
        }
        catch (InsufficientStockException)
        {
            // POS đã bán xong nhưng thiếu tồn — giữ hàng chờ để nhập kho / xử lý thủ công.
        }
    }

    public async Task<PosStockHandlingResponse> PreparePosStockDeductionAsync(
        PreparePosStockDeductionRequest request,
        Guid createdBy,
        CreatorSnapshot? creator,
        CancellationToken ct = default)
    {
        if (request.OrderId == Guid.Empty)
            throw new InventoryValidationException("OrderId là bắt buộc khi xử lý tồn POS.");
        if (string.IsNullOrWhiteSpace(request.OrderCode))
            throw new InventoryValidationException("Mã đơn hàng là bắt buộc khi xử lý tồn POS.");

        var normalizedItems = NormalizePosStockItems(request.Items);
        var catalog = await _productCatalogClient.GetCatalogAsync(ct);

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var existingQueue = await _queueRepo.GetByOrderIdAsync(request.OrderId, innerCt);
            if (existingQueue != null)
            {
                var existingLines = BuildQueueLineResponses(existingQueue);
                return new PosStockHandlingResponse(
                    request.OrderId,
                    request.OrderCode.Trim(),
                    "ExistingPendingReconciliation",
                    true,
                    "Đơn đã có queue chờ đối soát/trừ tồn, không tạo lại.",
                    [existingQueue.Id],
                    existingLines.Select(MapQueueLineToPosLine).ToList());
            }

            var decisions = new List<PosStockDecision>();
            foreach (var item in normalizedItems)
            {
                var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(item.SkuId, innerCt);
                var counterQty = Math.Max(0, stock?.QuantityOnHand ?? 0);
                var immediateQty = Math.Min(item.Quantity, counterQty);
                var pendingQty = Math.Max(0, item.Quantity - immediateQty);

                decisions.Add(new PosStockDecision
                {
                    SkuId = item.SkuId,
                    SkuCode = NormalizeSnapshotText(item.SkuSnapshotCode),
                    SkuName = NormalizeSnapshotText(item.SkuSnapshotName) ?? item.SkuSnapshotCode ?? item.SkuId.ToString(),
                    OrderedQuantity = item.Quantity,
                    FinishedDeductedQuantity = immediateQty,
                    PendingBomQuantity = pendingQty,
                    Stock = stock
                });
            }

            await ResolvePendingBomMaterialSnapshotsAsync(decisions, catalog, innerCt);

            var now = DateTime.UtcNow;
            await DeductImmediateFinishedStockAsync(
                request.OrderCode.Trim(),
                decisions,
                createdBy,
                creator,
                now,
                innerCt);

            var queueIds = new List<Guid>();
            var pendingDecisions = decisions.Where(d => d.PendingBomQuantity > 0).ToList();
            if (pendingDecisions.Count > 0)
            {
                var queue = new StockDeductQueue
                {
                    Id = Guid.NewGuid(),
                    OrderId = request.OrderId,
                    OrderCode = request.OrderCode.Trim(),
                    OrderPaymentStatus = string.IsNullOrWhiteSpace(request.OrderStatus)
                        ? "completed"
                        : request.OrderStatus.Trim().ToLowerInvariant(),
                    OrderStockStatus = "pending_bom_reconciliation",
                    QueueStatus = QueueStatus.Waiting,
                    TotalAmount = request.TotalAmount,
                    IsDeducted = false,
                    CreatedAt = now,
                    Items = pendingDecisions.Select(d => new StockDeductQueueItem
                    {
                        Id = Guid.NewGuid(),
                        SkuId = d.SkuId,
                        SkuSnapshotName = d.SkuName,
                        SkuSnapshotCode = d.SkuCode,
                        Quantity = d.PendingBomQuantity,
                        OrderedQuantity = d.OrderedQuantity,
                        FinishedDeductedQuantity = d.FinishedDeductedQuantity,
                        PendingBomQuantity = d.PendingBomQuantity,
                        StockHandlingMode = d.FinishedDeductedQuantity > 0
                            ? StockHandlingModePartialBomPending
                            : StockHandlingModeFullBomPending,
                        MaterialRequirementSnapshotJson = JsonSerializer.Serialize(
                            d.MaterialRequirements,
                            MaterialSnapshotJsonOptions)
                    }).ToList()
                };

                foreach (var item in queue.Items)
                    item.QueueId = queue.Id;

                await _queueRepo.AddAsync(queue, innerCt);
                queueIds.Add(queue.Id);
            }

            await _skuStockRepo.SaveChangesAsync(innerCt);

            var hasPending = pendingDecisions.Count > 0;
            var mode = hasPending ? "PartialOrFullPendingBomReconciliation" : StockHandlingModeImmediate;
            return new PosStockHandlingResponse(
                request.OrderId,
                request.OrderCode.Trim(),
                mode,
                hasPending,
                BuildPosStockHandlingMessage(decisions),
                queueIds,
                decisions.Select(d => new PosStockHandlingLineResponse(
                    d.SkuId,
                    d.SkuCode,
                    d.SkuName,
                    d.OrderedQuantity,
                    d.FinishedDeductedQuantity,
                    d.PendingBomQuantity)).ToList());
        }, ct);
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

    public async Task<List<StockDeductQueueResponse>> GetWaitingQueuesAsync(
        string? status,
        string? search,
        CancellationToken ct = default)
    {
        var queues = await _queueRepo.GetWaitingAsync(status, search, ct);
        return queues.Select(MapQueue).ToList();
    }

    public async Task<PagedResponse<StockDeductQueueResponse>> GetWaitingQueuesPagedAsync(
        string? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (safePage, safePageSize) = NormalizePagination(page, pageSize);
        var (queues, totalCount) = await _queueRepo.GetWaitingPagedAsync(status, search, safePage, safePageSize, ct);
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
        var orderStockStatus = canDeduct
            ? queue.OrderStockStatus
            : IsBomReconciliationQueue(queue) ? "waiting_materials" : "waiting_stock";

        return new StockDeductPreviewResponse(
            queue.Id, queue.OrderId, queue.OrderCode,
            queue.QueueStatus.ToString().ToLowerInvariant(),
            orderStockStatus,
            canDeduct,
            previewItems,
            BuildQueueLineResponses(queue),
            IsBomReconciliationQueue(queue));
    }

    public async Task<StockDeductConfirmResponse> ConfirmQueueAsync(
        Guid queueId,
        Guid confirmedBy,
        CreatorSnapshot? confirmer,
        CancellationToken ct = default)
    {
        var queue = await _queueRepo.GetByIdAsync(queueId, ct)
            ?? throw new InventoryNotFoundException($"Queue '{queueId}' not found.");

        if (queue.QueueStatus is not (QueueStatus.Waiting or QueueStatus.Insufficient))
            throw new InventoryValidationException("Chỉ có thể trừ tồn cho queue đang chờ xử lý hoặc chờ hàng.");

        if (IsBomReconciliationQueue(queue))
            return await ConfirmBomReconciliationQueueAsync(queue, confirmedBy, confirmer, ct);

        var result = await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var now = DateTime.UtcNow;
            var shortages = new List<StockShortage>();
            var stockBySkuId = new Dictionary<Guid, SkuStock>();
            queue.LastAttemptAt = now;

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
            {
                queue.IsDeducted = false;
                queue.QueueStatus = QueueStatus.Insufficient;
                queue.OrderStockStatus = "waiting_stock";
                queue.LastShortageReason = BuildShortageReason(shortages);
                await _queueRepo.SaveChangesAsync(innerCt);
                return new StockDeductOperationResult(queue, false, shortages);
            }

            var orderedItems = queue.Items.OrderBy(i => i.SkuSnapshotCode ?? i.SkuSnapshotName).ToList();
            var exportCountToday = await _exportSlipRepo.CountCreatedSinceAsync(now.Date, innerCt);
            var slipId = Guid.NewGuid();
            var slipLines = new List<StockExportSlipLine>();

            foreach (var item in orderedItems)
            {
                var stock = stockBySkuId[item.SkuId];
                var warehouseBefore = stock.WarehouseQuantityOnHand;
                var storeBefore = stock.QuantityOnHand;
                var storeAfter = storeBefore - item.Quantity;

                slipLines.Add(new StockExportSlipLine
                {
                    Id = Guid.NewGuid(),
                    StockExportSlipId = slipId,
                    SkuId = item.SkuId,
                    SkuCode = item.SkuSnapshotCode ?? item.SkuId.ToString()[..8],
                    ProductSnapshotName = item.SkuSnapshotName,
                    Quantity = item.Quantity,
                    WarehouseQtyBefore = warehouseBefore,
                    WarehouseQtyAfter = warehouseBefore,
                    StoreQtyBefore = storeBefore,
                    StoreQtyAfter = storeAfter,
                    Note = $"Trừ tồn quầy cho đơn hàng {queue.OrderCode}",
                    CreatedAt = now,
                });

                stock.QuantityOnHand = storeAfter;
                stock.UpdatedAt = now;
            }

            var firstLine = slipLines[0];
            var effectiveConfirmedBy = confirmedBy == Guid.Empty ? Guid.Empty : confirmedBy;
            var exportSlip = new StockExportSlip
            {
                Id = slipId,
                ExportCode = $"PX-{now:yyyyMMdd}-{(exportCountToday + 1):D4}",
                ExportType = "sales_deduct_later",
                StockAdjustmentRequestId = null,
                ProductionOrderId = null,
                ProductionCode = null,
                SkuId = slipLines.Count == 1 ? firstLine.SkuId : Guid.Empty,
                SkuCode = slipLines.Count == 1 ? firstLine.SkuCode : "MULTI",
                SkuSnapshotName = slipLines.Count == 1 ? firstLine.ProductSnapshotName : $"{slipLines.Count} dòng hàng bán",
                Quantity = slipLines.Sum(l => l.Quantity),
                WarehouseQtyBefore = slipLines.Sum(l => l.WarehouseQtyBefore),
                WarehouseQtyAfter = slipLines.Sum(l => l.WarehouseQtyAfter),
                StoreQtyBefore = slipLines.Sum(l => l.StoreQtyBefore),
                StoreQtyAfter = slipLines.Sum(l => l.StoreQtyAfter),
                Note = $"Trừ tồn quầy cho đơn hàng {queue.OrderCode}",
                CreatedBy = effectiveConfirmedBy,
                CreatedById = effectiveConfirmedBy == Guid.Empty ? null : effectiveConfirmedBy,
                CreatedByName = NormalizeSnapshotText(confirmer?.CreatedByName),
                CreatedByRoleName = NormalizeSnapshotText(confirmer?.CreatedByRoleName),
                CreatedAt = now,
                Lines = slipLines,
            };

            queue.IsDeducted = true;
            queue.QueueStatus = QueueStatus.Confirmed;
            queue.OrderStockStatus = "deducted";
            queue.ConfirmedAt = now;
            queue.ConfirmedBy = effectiveConfirmedBy == Guid.Empty ? null : effectiveConfirmedBy;
            queue.ConfirmedByName = NormalizeSnapshotText(confirmer?.CreatedByName);
            queue.ConfirmedByRoleName = NormalizeSnapshotText(confirmer?.CreatedByRoleName);
            queue.LastShortageReason = null;

            await _exportSlipRepo.AddAsync(exportSlip, innerCt);
            await _queueRepo.SaveChangesAsync(innerCt);
            return new StockDeductOperationResult(queue, true, []);
        }, ct);

        if (!result.CanDeduct)
        {
            return new StockDeductConfirmResponse(
                result.Queue.Id,
                result.Queue.OrderId,
                result.Queue.OrderCode,
                result.Queue.QueueStatus.ToString().ToLowerInvariant(),
                result.Queue.OrderStockStatus,
                result.Queue.ConfirmedAt,
                false,
                MapShortageResponses(result.Shortages));
        }

        await _eventPublisher.PublishStockDeductedAsync(result.Queue.OrderId, result.Queue.OrderCode, true, ct);
        await CheckAndNotifyLowStockAsync(result.Queue.Items, ct);

        return new StockDeductConfirmResponse(
            result.Queue.Id, result.Queue.OrderId, result.Queue.OrderCode,
            result.Queue.QueueStatus.ToString().ToLowerInvariant(),
            result.Queue.OrderStockStatus,
            result.Queue.ConfirmedAt);
    }

    private async Task<StockDeductConfirmResponse> ConfirmBomReconciliationQueueAsync(
        StockDeductQueue queue,
        Guid confirmedBy,
        CreatorSnapshot? confirmer,
        CancellationToken ct)
    {
        var result = await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var currentQueue = await _queueRepo.GetByIdAsync(queue.Id, innerCt)
                ?? throw new InventoryNotFoundException($"Queue '{queue.Id}' not found.");
            var now = DateTime.UtcNow;
            currentQueue.LastAttemptAt = now;

            var materialGroups = BuildMaterialRequirementGroups(currentQueue);
            if (materialGroups.Count == 0)
                throw new InventoryValidationException("Queue không có snapshot nguyên liệu để đối soát.");

            var shortages = new List<StockShortage>();
            foreach (var group in materialGroups)
            {
                var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(group.MaterialSkuId, innerCt);
                var available = _inventoryOptions.SimulateWarehouse
                    ? Math.Max(0, stock?.WarehouseQuantityOnHand ?? 0)
                    : Math.Max(0, await _batchRepo.SumQuantityOnHandAsync(group.MaterialSkuId, innerCt));

                if (stock == null || available < group.RequiredQuantity)
                {
                    shortages.Add(new StockShortage(
                        group.MaterialSkuId,
                        group.MaterialName,
                        group.RequiredQuantity,
                        available,
                        group.RequiredQuantity - available));
                }
            }

            if (shortages.Count > 0)
            {
                currentQueue.IsDeducted = false;
                currentQueue.QueueStatus = QueueStatus.Insufficient;
                currentQueue.OrderStockStatus = "waiting_materials";
                currentQueue.LastShortageReason = BuildShortageReason(shortages);
                await _queueRepo.SaveChangesAsync(innerCt);
                return new StockDeductOperationResult(currentQueue, false, shortages);
            }

            var slipId = Guid.NewGuid();
            var slipLines = new List<StockExportSlipLine>();
            var allAllocations = new List<StockExportBatchAllocation>();
            var touchedSkuIds = new List<Guid>();

            foreach (var group in materialGroups.OrderBy(g => g.MaterialSkuCode ?? g.MaterialName))
            {
                var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(group.MaterialSkuId, innerCt)
                    ?? throw new InventoryValidationException($"Không tìm thấy tồn kho nguyên liệu {group.MaterialName}.");

                var warehouseBefore = _inventoryOptions.SimulateWarehouse
                    ? stock.WarehouseQuantityOnHand
                    : await _batchRepo.SumQuantityOnHandAsync(group.MaterialSkuId, innerCt);
                var storeBefore = stock.QuantityOnHand;
                List<StockExportBatchAllocation> allocations = [];

                if (_inventoryOptions.SimulateWarehouse)
                {
                    stock.WarehouseQuantityOnHand -= group.RequiredQuantity;
                    if (stock.WarehouseQuantityOnHand < 0)
                        throw new InventoryValidationException($"Nguyên liệu {group.MaterialName} không đủ tồn kho tổng.");
                    stock.UpdatedAt = now;
                }
                else
                {
                    allocations = await AllocateAndDeductBatchesFifoAsync(
                        group.MaterialSkuId,
                        group.RequiredQuantity,
                        innerCt);
                    await SyncWarehouseQtyFromBatchesAsync(stock, innerCt);
                }

                var warehouseAfter = stock.WarehouseQuantityOnHand;
                var slipLine = new StockExportSlipLine
                {
                    Id = Guid.NewGuid(),
                    StockExportSlipId = slipId,
                    SkuId = group.MaterialSkuId,
                    SkuCode = group.MaterialSkuCode ?? group.MaterialSkuId.ToString()[..8],
                    ProductSnapshotName = group.MaterialName,
                    Quantity = group.RequiredQuantity,
                    WarehouseQtyBefore = warehouseBefore,
                    WarehouseQtyAfter = warehouseAfter,
                    StoreQtyBefore = storeBefore,
                    StoreQtyAfter = storeBefore,
                    Note = $"Đối soát nguyên liệu bán trước cho đơn hàng {currentQueue.OrderCode}",
                    CreatedAt = now,
                };

                foreach (var allocation in allocations)
                {
                    allocation.StockExportSlipId = slipId;
                    allocation.StockExportSlipLineId = slipLine.Id;
                }

                slipLines.Add(slipLine);
                allAllocations.AddRange(allocations);
                touchedSkuIds.Add(group.MaterialSkuId);
            }

            var firstLine = slipLines[0];
            var exportCountToday = await _exportSlipRepo.CountCreatedSinceAsync(now.Date, innerCt);
            var effectiveConfirmedBy = confirmedBy == Guid.Empty ? Guid.Empty : confirmedBy;
            var exportSlip = new StockExportSlip
            {
                Id = slipId,
                ExportCode = $"PX-{now:yyyyMMdd}-{(exportCountToday + 1):D4}",
                ExportType = "sales_bom_reconciliation",
                StockAdjustmentRequestId = null,
                ProductionOrderId = null,
                ProductionCode = null,
                SkuId = slipLines.Count == 1 ? firstLine.SkuId : Guid.Empty,
                SkuCode = slipLines.Count == 1 ? firstLine.SkuCode : "MULTI",
                SkuSnapshotName = slipLines.Count == 1 ? firstLine.ProductSnapshotName : $"{slipLines.Count} dòng nguyên liệu",
                Quantity = slipLines.Sum(l => l.Quantity),
                WarehouseQtyBefore = slipLines.Sum(l => l.WarehouseQtyBefore),
                WarehouseQtyAfter = slipLines.Sum(l => l.WarehouseQtyAfter),
                StoreQtyBefore = slipLines.Sum(l => l.StoreQtyBefore),
                StoreQtyAfter = slipLines.Sum(l => l.StoreQtyAfter),
                Note = $"Xuất nguyên liệu đối soát bán trước cho đơn hàng {currentQueue.OrderCode}",
                CreatedBy = effectiveConfirmedBy,
                CreatedById = effectiveConfirmedBy == Guid.Empty ? null : effectiveConfirmedBy,
                CreatedByName = NormalizeSnapshotText(confirmer?.CreatedByName),
                CreatedByRoleName = NormalizeSnapshotText(confirmer?.CreatedByRoleName),
                CreatedAt = now,
                Lines = slipLines,
            };

            currentQueue.IsDeducted = true;
            currentQueue.QueueStatus = QueueStatus.Confirmed;
            currentQueue.OrderStockStatus = "deducted";
            currentQueue.ConfirmedAt = now;
            currentQueue.ConfirmedBy = effectiveConfirmedBy == Guid.Empty ? null : effectiveConfirmedBy;
            currentQueue.ConfirmedByName = NormalizeSnapshotText(confirmer?.CreatedByName);
            currentQueue.ConfirmedByRoleName = NormalizeSnapshotText(confirmer?.CreatedByRoleName);
            currentQueue.LastShortageReason = null;

            await _exportSlipRepo.AddAsync(exportSlip, innerCt);
            await _exportSlipRepo.SaveChangesAsync(innerCt);

            if (allAllocations.Count > 0)
            {
                await _exportAllocationRepo.AddRangeAsync(allAllocations, innerCt);
                await _exportAllocationRepo.SaveChangesAsync(innerCt);
            }

            await _queueRepo.SaveChangesAsync(innerCt);

            foreach (var skuId in touchedSkuIds.Distinct())
            {
                var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, innerCt);
                if (stock != null && stock.WarehouseQuantityOnHand <= stock.WarehouseLowStockThreshold)
                    await _eventPublisher.PublishLowStockAsync(
                        stock.SkuId, stock.SkuCode, stock.WarehouseQuantityOnHand, stock.WarehouseLowStockThreshold, innerCt);
            }

            return new StockDeductOperationResult(currentQueue, true, []);
        }, ct);

        if (!result.CanDeduct)
        {
            return new StockDeductConfirmResponse(
                result.Queue.Id,
                result.Queue.OrderId,
                result.Queue.OrderCode,
                result.Queue.QueueStatus.ToString().ToLowerInvariant(),
                result.Queue.OrderStockStatus,
                result.Queue.ConfirmedAt,
                false,
                MapShortageResponses(result.Shortages));
        }

        await _eventPublisher.PublishStockDeductedAsync(result.Queue.OrderId, result.Queue.OrderCode, true, ct);

        return new StockDeductConfirmResponse(
            result.Queue.Id,
            result.Queue.OrderId,
            result.Queue.OrderCode,
            result.Queue.QueueStatus.ToString().ToLowerInvariant(),
            result.Queue.OrderStockStatus,
            result.Queue.ConfirmedAt);
    }

    public async Task<StockDeductConfirmResponse> CancelQueueAsync(
        Guid queueId,
        CancelStockDeductRequest? request,
        Guid cancelledBy,
        CreatorSnapshot? canceller,
        CancellationToken ct = default)
    {
        var queue = await _queueRepo.GetByIdAsync(queueId, ct)
            ?? throw new InventoryNotFoundException($"Queue '{queueId}' not found.");

        if (queue.QueueStatus is not (QueueStatus.Waiting or QueueStatus.Insufficient))
            throw new InventoryValidationException("Chỉ có thể hủy queue đang chờ xử lý hoặc chờ hàng.");

        var reason = request?.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Lý do hủy là bắt buộc.");

        queue.QueueStatus = QueueStatus.Cancelled;
        queue.OrderStockStatus = "cancelled";
        queue.CancelledAt = DateTime.UtcNow;
        queue.CancelledBy = cancelledBy == Guid.Empty ? null : cancelledBy;
        queue.CancelledByName = NormalizeSnapshotText(canceller?.CreatedByName);
        queue.CancelledByRoleName = NormalizeSnapshotText(canceller?.CreatedByRoleName);
        queue.CancelReason = reason;
        queue.LastShortageReason = null;
        await _queueRepo.SaveChangesAsync(ct);

        await _eventPublisher.PublishStockDeductionCancelledAsync(
            queue.OrderId,
            queue.OrderCode,
            reason,
            ct);

        return new StockDeductConfirmResponse(
            queue.Id, queue.OrderId, queue.OrderCode,
            queue.QueueStatus.ToString().ToLowerInvariant(),
            queue.OrderStockStatus,
            queue.ConfirmedAt,
            false,
            [],
            queue.CancelledAt,
            queue.CancelReason);
    }

    private sealed record StockDeductOperationResult(
        StockDeductQueue Queue,
        bool CanDeduct,
        List<StockShortage> Shortages);

    private static string BuildShortageReason(IEnumerable<StockShortage> shortages)
    {
        var text = string.Join("; ", shortages.Select(s =>
            $"{s.SkuName}: cần {s.RequiredQuantity}, có {s.AvailableQuantity}, thiếu {s.ShortageQuantity}"));
        return text.Length <= 500 ? text : text[..500];
    }

    private static List<StockDeductPreviewItemResponse> MapShortageResponses(IEnumerable<StockShortage> shortages) =>
        shortages.Select(s => new StockDeductPreviewItemResponse(
            s.SkuId,
            s.SkuId,
            s.SkuName,
            s.RequiredQuantity,
            s.AvailableQuantity,
            s.ShortageQuantity,
            "insufficient")).ToList();

    public async Task<SkuStockResponse> UpdateLowStockThresholdAsync(
        Guid skuId,
        UpdateLowStockThresholdRequest request,
        CancellationToken ct = default)
    {
        if (request is null)
            throw new InventoryValidationException("Request body là bắt buộc.");

        var location = ParseInventoryLocation(request.Location);
        var threshold = request.Threshold;

        if (request.WarehouseLowStockThreshold.HasValue)
            ValidateThreshold(request.WarehouseLowStockThreshold.Value);
        if (request.ShelfLowStockThreshold.HasValue)
            ValidateThreshold(request.ShelfLowStockThreshold.Value);
        ValidateThreshold(threshold);

        static void ValidateThreshold(int value)
        {
            if (value < 0)
                throw new InventoryValidationException("Ngưỡng tồn thấp không được âm.");
        }

        var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct)
            ?? throw new InventoryNotFoundException($"Không tìm thấy tồn kho cho SKU '{skuId}'.");

        if (request.WarehouseLowStockThreshold.HasValue || request.ShelfLowStockThreshold.HasValue)
        {
            if (request.WarehouseLowStockThreshold.HasValue)
                stock.WarehouseLowStockThreshold = request.WarehouseLowStockThreshold.Value;
            if (request.ShelfLowStockThreshold.HasValue)
            {
                stock.ShelfLowStockThreshold = request.ShelfLowStockThreshold.Value;
                stock.LowStockThreshold = request.ShelfLowStockThreshold.Value;
            }
        }
        else if (location == InventoryLocation.Warehouse)
        {
            stock.WarehouseLowStockThreshold = threshold;
        }
        else
        {
            stock.ShelfLowStockThreshold = threshold;
            stock.LowStockThreshold = threshold;
        }

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
        CreatorSnapshot? creator,
        CancellationToken ct = default)
    {
        if (createdBy == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người nhập lô.");

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var batch = await CreateWarehouseBatchInternalAsync(
                request.LotCode,
                request.Supplier,
                request.ExpiresAt,
                request.Note,
                request.Items,
                createdBy,
                innerCt);

            await CreateManualMaterialImportSlipAsync(batch, request.Note, createdBy, creator, innerCt);
            return batch;
        }, ct);
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
            if (stock != null && stock.QuantityOnHand <= stock.ShelfLowStockThreshold)
                await _eventPublisher.PublishLowStockAsync(
                    stock.SkuId, stock.SkuCode, stock.QuantityOnHand, stock.ShelfLowStockThreshold, ct);
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

    private static List<PreparePosStockDeductionItemRequest> NormalizePosStockItems(
        List<PreparePosStockDeductionItemRequest>? items)
    {
        if (items == null || items.Count == 0)
            throw new InventoryValidationException("Đơn hàng phải có ít nhất một SKU để xử lý tồn POS.");

        var normalized = items
            .Where(i => i.SkuId != Guid.Empty && i.Quantity > 0)
            .GroupBy(i => i.SkuId)
            .Select(group =>
            {
                var first = group.First();
                return new PreparePosStockDeductionItemRequest(
                    group.Key,
                    first.SkuSnapshotName,
                    first.SkuSnapshotCode,
                    group.Sum(i => i.Quantity));
            })
            .OrderBy(i => i.SkuSnapshotCode ?? i.SkuSnapshotName ?? i.SkuId.ToString())
            .ToList();

        if (normalized.Count == 0)
            throw new InventoryValidationException("Đơn hàng không có SKU hợp lệ để xử lý tồn POS.");

        return normalized;
    }

    private async Task ResolvePendingBomMaterialSnapshotsAsync(
        List<PosStockDecision> decisions,
        ProductCatalogSnapshot catalog,
        CancellationToken ct)
    {
        var pendingDecisions = decisions.Where(d => d.PendingBomQuantity > 0).ToList();
        if (pendingDecisions.Count == 0)
            return;

        var reservations = await BuildMaterialReservationsAsync(null, ct);
        var availableBySku = new Dictionary<Guid, int>();
        var effectiveAvailableBySku = new Dictionary<Guid, int>();
        var shortages = new List<StockShortage>();

        async Task EnsureMaterialAvailabilityAsync(CatalogVariant variant)
        {
            if (availableBySku.ContainsKey(variant.Id))
                return;

            var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(variant.Id, ct);
            var available = _inventoryOptions.SimulateWarehouse
                ? Math.Max(0, stock?.WarehouseQuantityOnHand ?? 0)
                : Math.Max(0, await _batchRepo.SumQuantityOnHandAsync(variant.Id, ct));
            var reserved = reservations.GetValueOrDefault(variant.Id);

            availableBySku[variant.Id] = available;
            effectiveAvailableBySku[variant.Id] = Math.Max(0, available - reserved);
        }

        foreach (var decision in pendingDecisions)
        {
            var finishedProduct = catalog.FindProductByVariant(decision.SkuId);
            var finishedVariant = finishedProduct?.Variants.FirstOrDefault(v => v.Id == decision.SkuId);

            if (finishedVariant == null || finishedVariant.BomLineCount <= 0 || finishedVariant.BomLines.Count == 0)
            {
                throw new InventoryValidationException(
                    $"Sản phẩm {decision.SkuCode ?? decision.SkuName} thiếu tồn quầy nhưng chưa có BOM hợp lệ để xử lý bán trước/trừ sau.");
            }

            foreach (var bomLine in finishedVariant.BomLines)
            {
                var required = CeilRequiredQuantity(bomLine.Quantity * decision.PendingBomQuantity);
                var materialProduct = catalog.FindProduct(bomLine.MaterialId);
                if (materialProduct == null)
                {
                    throw new InventoryValidationException(
                        $"Không tìm thấy nguyên liệu BOM: {bomLine.MaterialName}.");
                }

                var candidateVariants = materialProduct.Variants
                    .Where(v => v.IsActive)
                    .OrderBy(v => v.SkuCode)
                    .ThenBy(v => v.VariantName)
                    .ToList();

                if (candidateVariants.Count == 0)
                {
                    throw new InventoryValidationException(
                        $"Không xác định được SKU nguyên liệu cho BOM: {bomLine.MaterialName}.");
                }

                foreach (var variant in candidateVariants)
                    await EnsureMaterialAvailabilityAsync(variant);

                var effectiveAvailable = candidateVariants.Sum(v => effectiveAvailableBySku.GetValueOrDefault(v.Id));
                if (effectiveAvailable < required)
                {
                    shortages.Add(new StockShortage(
                        bomLine.MaterialId,
                        string.IsNullOrWhiteSpace(bomLine.MaterialName) ? materialProduct.Name : bomLine.MaterialName,
                        required,
                        effectiveAvailable,
                        required - effectiveAvailable));
                    continue;
                }

                var remaining = required;
                foreach (var variant in candidateVariants)
                {
                    if (remaining <= 0) break;

                    var effective = effectiveAvailableBySku.GetValueOrDefault(variant.Id);
                    var take = Math.Min(effective, remaining);
                    if (take <= 0) continue;

                    decision.MaterialRequirements.Add(new MaterialRequirementSnapshot(
                        bomLine.MaterialId,
                        variant.Id,
                        variant.SkuCode,
                        string.IsNullOrWhiteSpace(bomLine.MaterialName) ? materialProduct.Name : bomLine.MaterialName,
                        bomLine.MaterialUnitName ?? materialProduct.BaseUnit,
                        take,
                        availableBySku.GetValueOrDefault(variant.Id),
                        reservations.GetValueOrDefault(variant.Id)));

                    effectiveAvailableBySku[variant.Id] = effective - take;
                    remaining -= take;
                }
            }
        }

        if (shortages.Count > 0)
            throw new InsufficientStockException(BuildMaterialShortageMessage(decisions, shortages), shortages);
    }

    private async Task<Dictionary<Guid, int>> BuildMaterialReservationsAsync(
        Guid? excludeQueueId,
        CancellationToken ct)
    {
        var queues = await _queueRepo.GetUnresolvedBomReconciliationQueuesAsync(excludeQueueId, ct);
        var result = new Dictionary<Guid, int>();

        foreach (var snapshot in queues
            .SelectMany(q => q.Items)
            .SelectMany(DeserializeMaterialSnapshots))
        {
            result[snapshot.MaterialSkuId] = result.GetValueOrDefault(snapshot.MaterialSkuId) + snapshot.RequiredQuantity;
        }

        return result;
    }

    private async Task DeductImmediateFinishedStockAsync(
        string orderCode,
        List<PosStockDecision> decisions,
        Guid createdBy,
        CreatorSnapshot? creator,
        DateTime now,
        CancellationToken ct)
    {
        var immediateDecisions = decisions
            .Where(d => d.FinishedDeductedQuantity > 0)
            .OrderBy(d => d.SkuCode ?? d.SkuName)
            .ToList();
        if (immediateDecisions.Count == 0)
            return;

        var slipId = Guid.NewGuid();
        var slipLines = new List<StockExportSlipLine>();

        foreach (var decision in immediateDecisions)
        {
            var stock = decision.Stock
                ?? throw new InventoryValidationException($"Không tìm thấy tồn quầy cho SKU {decision.SkuCode ?? decision.SkuId.ToString()}.");

            var warehouseBefore = stock.WarehouseQuantityOnHand;
            var storeBefore = stock.QuantityOnHand;
            if (storeBefore < decision.FinishedDeductedQuantity)
                throw new InventoryValidationException("Tồn quầy POS đã thay đổi, vui lòng thử checkout lại.");

            stock.QuantityOnHand = storeBefore - decision.FinishedDeductedQuantity;
            stock.UpdatedAt = now;

            slipLines.Add(new StockExportSlipLine
            {
                Id = Guid.NewGuid(),
                StockExportSlipId = slipId,
                SkuId = decision.SkuId,
                SkuCode = decision.SkuCode ?? decision.SkuId.ToString()[..8],
                ProductSnapshotName = decision.SkuName,
                Quantity = decision.FinishedDeductedQuantity,
                WarehouseQtyBefore = warehouseBefore,
                WarehouseQtyAfter = warehouseBefore,
                StoreQtyBefore = storeBefore,
                StoreQtyAfter = stock.QuantityOnHand,
                Note = $"Trừ tồn quầy ngay cho đơn hàng {orderCode}",
                CreatedAt = now,
            });
        }

        var firstLine = slipLines[0];
        var exportCountToday = await _exportSlipRepo.CountCreatedSinceAsync(now.Date, ct);
        var exportSlip = new StockExportSlip
        {
            Id = slipId,
            ExportCode = $"PX-{now:yyyyMMdd}-{(exportCountToday + 1):D4}",
            ExportType = "pos_finished_goods_sale",
            StockAdjustmentRequestId = null,
            ProductionOrderId = null,
            ProductionCode = null,
            SkuId = slipLines.Count == 1 ? firstLine.SkuId : Guid.Empty,
            SkuCode = slipLines.Count == 1 ? firstLine.SkuCode : "MULTI",
            SkuSnapshotName = slipLines.Count == 1 ? firstLine.ProductSnapshotName : $"{slipLines.Count} dòng hàng bán POS",
            Quantity = slipLines.Sum(l => l.Quantity),
            WarehouseQtyBefore = slipLines.Sum(l => l.WarehouseQtyBefore),
            WarehouseQtyAfter = slipLines.Sum(l => l.WarehouseQtyAfter),
            StoreQtyBefore = slipLines.Sum(l => l.StoreQtyBefore),
            StoreQtyAfter = slipLines.Sum(l => l.StoreQtyAfter),
            Note = $"Trừ tồn quầy ngay cho đơn hàng {orderCode}",
            CreatedBy = createdBy == Guid.Empty ? Guid.Empty : createdBy,
            CreatedById = createdBy == Guid.Empty ? null : createdBy,
            CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
            CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
            CreatedAt = now,
            Lines = slipLines,
        };

        await _exportSlipRepo.AddAsync(exportSlip, ct);
    }

    private async Task<List<StockDeductPreviewItemResponse>> BuildPreviewItemsAsync(
        StockDeductQueue queue, CancellationToken ct)
    {
        if (IsBomReconciliationQueue(queue))
            return await BuildBomPreviewItemsAsync(queue, ct);

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

    private async Task<List<StockDeductPreviewItemResponse>> BuildBomPreviewItemsAsync(
        StockDeductQueue queue,
        CancellationToken ct)
    {
        var groups = BuildMaterialRequirementGroups(queue);
        var result = new List<StockDeductPreviewItemResponse>();

        foreach (var group in groups.OrderBy(g => g.MaterialName).ThenBy(g => g.MaterialSkuCode))
        {
            var stock = await _skuStockRepo.GetBySkuIdAsync(group.MaterialSkuId, ct);
            var available = _inventoryOptions.SimulateWarehouse
                ? Math.Max(0, stock?.WarehouseQuantityOnHand ?? 0)
                : Math.Max(0, await _batchRepo.SumQuantityOnHandAsync(group.MaterialSkuId, ct));
            var shortage = Math.Max(0, group.RequiredQuantity - available);

            result.Add(new StockDeductPreviewItemResponse(
                group.MaterialSkuId,
                group.MaterialProductId,
                string.IsNullOrWhiteSpace(group.MaterialSkuCode)
                    ? group.MaterialName
                    : $"{group.MaterialName} ({group.MaterialSkuCode})",
                group.RequiredQuantity,
                available,
                shortage,
                shortage > 0 ? "insufficient" : "ok"));
        }

        return result;
    }

    private static StockDeductQueueResponse MapQueue(StockDeductQueue q) => new(
        q.Id, q.OrderId, q.OrderCode,
        q.QueueStatus.ToString().ToLowerInvariant(),
        q.OrderPaymentStatus,
        q.OrderStockStatus,
        q.TotalAmount,
        q.CreatedAt,
        q.ConfirmedAt,
        q.ConfirmedByName,
        q.ConfirmedByRoleName,
        q.CancelledAt,
        q.CancelledByName,
        q.CancelledByRoleName,
        q.CancelReason,
        q.LastAttemptAt,
        q.LastShortageReason,
        BuildQueueLineResponses(q));

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
            if (line.QuantityDelta <= 0)
                throw new InventoryValidationException("Số lượng yêu cầu bổ sung tồn quầy phải lớn hơn 0.");

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
        CreatorSnapshot? creator,
        CancellationToken ct = default)
    {
        if (reviewedBy == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người duyệt yêu cầu.");

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var entity = await _adjustmentRequestRepo.GetByIdAsync(id, innerCt)
                ?? throw new InventoryNotFoundException("Không tìm thấy yêu cầu bổ sung tồn quầy.");

            if (entity.Status != StockAdjustmentRequestStatus.Pending)
                throw new InventoryValidationException("Yêu cầu đã được xử lý, không thể duyệt lại.");

            if (entity.RequestedBy == reviewedBy)
                throw new InventoryValidationException("Người tạo yêu cầu không được tự duyệt yêu cầu của mình.");

            if (entity.Items.Count == 0)
                throw new InventoryValidationException("Yêu cầu không có dòng SKU.");

            var exportSlips = new List<StockAdjustmentExportSlipSummary>();

            foreach (var line in entity.Items)
            {
                if (line.QuantityDelta <= 0)
                    throw new InventoryValidationException("Yêu cầu bổ sung tồn quầy chỉ được dùng số lượng lớn hơn 0.");

                var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(line.SkuId, innerCt);
                if (stock == null)
                {
                    stock = await GetOrCreateSkuStockAsync(line.SkuId, line.SkuCode, innerCt);
                }

                var warehouseBefore = stock.WarehouseQuantityOnHand;
                var storeBefore = stock.QuantityOnHand;

                if (warehouseBefore < line.QuantityDelta)
                {
                    throw new InventoryValidationException("Kho tổng không đủ tồn để bổ sung tồn quầy.");
                }

                List<StockExportBatchAllocation>? allocations = null;

                if (_inventoryOptions.SimulateWarehouse)
                {
                    stock.WarehouseQuantityOnHand -= line.QuantityDelta;
                }
                else
                {
                    var batchTotal = await _batchRepo.SumQuantityOnHandAsync(line.SkuId, innerCt);
                    if (batchTotal < line.QuantityDelta)
                        throw new InventoryValidationException("Kho tổng không đủ tồn để bổ sung tồn quầy.");

                    allocations = await AllocateAndDeductBatchesFifoAsync(
                        line.SkuId, line.QuantityDelta, innerCt);

                    await SyncWarehouseQtyFromBatchesAsync(stock, innerCt);
                }

                stock.QuantityOnHand += line.QuantityDelta;
                stock.UpdatedAt = DateTime.UtcNow;

                var exportSlip = await CreateExportSlipAsync(
                    entity,
                    line,
                    line.QuantityDelta,
                    warehouseBefore,
                    stock.WarehouseQuantityOnHand,
                    storeBefore,
                    stock.QuantityOnHand,
                    reviewedBy,
                    creator,
                    entity.Reason,
                    allocations,
                    innerCt);

                line.ExportSlipId = exportSlip.Id;
                line.QuantityOnHandAfter = stock.QuantityOnHand;
                line.WarehouseQuantityOnHandAfter = stock.WarehouseQuantityOnHand;

                exportSlips.Add(new StockAdjustmentExportSlipSummary(
                    exportSlip.Id,
                    exportSlip.ExportCode,
                    line.SkuId,
                    line.SkuCode));
            }

            entity.Status = StockAdjustmentRequestStatus.Approved;
            entity.ReviewedBy = reviewedBy;
            entity.ReviewedAt = DateTime.UtcNow;
            entity.ReviewNote = null;
            await _skuStockRepo.SaveChangesAsync(innerCt);
            await _adjustmentRequestRepo.SaveChangesAsync(innerCt);

            return new StockAdjustmentReviewResponse(
                entity.Id,
                entity.RequestCode,
                entity.Status.ToString().ToLowerInvariant(),
                entity.ReviewedAt,
                exportSlips);
        }, ct);
    }

    public async Task<StockAdjustmentReviewResponse> RejectStockAdjustmentRequestAsync(
        Guid id,
        Guid reviewedBy,
        RejectStockAdjustmentRequest request,
        CancellationToken ct = default)
    {
        var entity = await _adjustmentRequestRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy yêu cầu bổ sung tồn quầy.");

        if (entity.Status != StockAdjustmentRequestStatus.Pending)
            throw new InventoryValidationException("Yêu cầu đã được xử lý, không thể từ chối.");

        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Vui lòng nhập lý do từ chối.");

        entity.Status = StockAdjustmentRequestStatus.Rejected;
        entity.ReviewedBy = reviewedBy == Guid.Empty ? null : reviewedBy;
        entity.ReviewedAt = DateTime.UtcNow;
        entity.ReviewNote = reason;
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
        bool isAdmin,
        CancelStockAdjustmentRequest? request,
        CancellationToken ct = default)
    {
        var entity = await _adjustmentRequestRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy yêu cầu bổ sung tồn quầy.");

        if (entity.Status != StockAdjustmentRequestStatus.Pending)
            throw new InventoryValidationException("Chỉ có thể hủy yêu cầu đang chờ duyệt.");

        if (!isAdmin && entity.RequestedBy != requestedBy)
            throw new InventoryValidationException("Bạn không thể hủy yêu cầu của người khác.");

        var reason = request?.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Vui lòng nhập lý do hủy.");

        entity.Status = StockAdjustmentRequestStatus.Cancelled;
        entity.ReviewedBy = requestedBy == Guid.Empty ? null : requestedBy;
        entity.ReviewedAt = DateTime.UtcNow;
        entity.ReviewNote = reason;
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

    private async Task CreateManualMaterialImportSlipAsync(
        WarehouseBatchResponse batch,
        string? note,
        Guid createdBy,
        CreatorSnapshot? creator,
        CancellationToken ct)
    {
        if (batch.Items.Count == 0)
            return;

        var now = DateTime.UtcNow;
        var importCountToday = await _importSlipRepo.CountCreatedSinceAsync(now.Date, ct);
        var slipId = Guid.NewGuid();
        var orderedItems = batch.Items.OrderBy(i => i.SkuCode).ToList();
        var lines = new List<StockImportSlipLine>();

        foreach (var item in orderedItems)
        {
            var stock = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, ct);
            var warehouseAfter = stock?.WarehouseQuantityOnHand ?? item.QuantityOnHand;
            var storeAfter = stock?.QuantityOnHand ?? 0;
            var quantity = item.InitialQuantity;

            lines.Add(new StockImportSlipLine
            {
                Id = Guid.NewGuid(),
                StockImportSlipId = slipId,
                SkuId = item.SkuId,
                SkuCode = item.SkuCode,
                ProductSnapshotName = item.ProductSnapshotName ?? item.SkuCode,
                Quantity = quantity,
                WarehouseQtyBefore = Math.Max(0, warehouseAfter - quantity),
                WarehouseQtyAfter = warehouseAfter,
                StoreQtyBefore = storeAfter,
                StoreQtyAfter = storeAfter,
                WarehouseBatchId = batch.Id,
                WarehouseBatchLotCode = batch.LotCode,
                ProductionOrderOutputLineId = null,
                Note = $"Nhập nguyên liệu vào kho - lô {batch.LotCode}",
                CreatedAt = now,
            });
        }

        var firstLine = lines[0];
        var slip = new StockImportSlip
        {
            Id = slipId,
            ImportCode = $"PN-{now:yyyyMMdd}-{(importCountToday + 1):D4}",
            ImportType = "manual_material_import",
            SkuId = firstLine.SkuId,
            SkuCode = lines.Count == 1 ? firstLine.SkuCode : "MULTI",
            ProductSnapshotName = lines.Count == 1 ? firstLine.ProductSnapshotName : $"{lines.Count} dòng nguyên liệu",
            Quantity = lines.Sum(l => l.Quantity),
            WarehouseQtyBefore = lines.Sum(l => l.WarehouseQtyBefore),
            WarehouseQtyAfter = lines.Sum(l => l.WarehouseQtyAfter),
            StoreQtyBefore = lines.Sum(l => l.StoreQtyBefore),
            StoreQtyAfter = lines.Sum(l => l.StoreQtyAfter),
            WarehouseBatchId = batch.Id,
            WarehouseBatchLotCode = batch.LotCode,
            ProductionOrderId = null,
            ProductionCode = null,
            Note = string.IsNullOrWhiteSpace(note)
                ? $"Nhập nguyên liệu vào kho - lô {batch.LotCode}"
                : note.Trim(),
            CreatedBy = createdBy,
            CreatedById = createdBy == Guid.Empty ? null : createdBy,
            CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
            CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
            CreatedAt = now,
            Lines = lines,
        };

        await _importSlipRepo.AddAsync(slip, ct);
        await _importSlipRepo.SaveChangesAsync(ct);
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
        CreatorSnapshot? creator,
        string? note,
        List<StockExportBatchAllocation>? batchAllocations,
        CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var countToday = await _exportSlipRepo.CountCreatedSinceAsync(today, ct);
        var effectiveCreatedBy = createdBy == Guid.Empty ? request.RequestedBy : createdBy;
        var slip = new StockExportSlip
        {
            Id = Guid.NewGuid(),
            ExportCode = $"PX-{today:yyyyMMdd}-{(countToday + 1):D4}",
            ExportType = "counter_replenishment_export",
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
            CreatedBy = effectiveCreatedBy,
            CreatedById = effectiveCreatedBy == Guid.Empty ? null : effectiveCreatedBy,
            CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
            CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
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

    private static string? NormalizeSnapshotText(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private static int CeilRequiredQuantity(decimal quantity)
    {
        if (quantity <= 0)
            throw new InventoryValidationException("Định mức BOM phải lớn hơn 0.");
        if (quantity > int.MaxValue)
            throw new InventoryValidationException("Số lượng BOM cần trừ vượt quá giới hạn hệ thống.");

        return (int)Math.Ceiling(quantity);
    }

    private static bool IsBomReconciliationQueue(StockDeductQueue queue) =>
        queue.Items.Any(i =>
            i.PendingBomQuantity.HasValue &&
            i.PendingBomQuantity.Value > 0 &&
            !string.IsNullOrWhiteSpace(i.MaterialRequirementSnapshotJson));

    private static List<MaterialRequirementSnapshot> DeserializeMaterialSnapshots(StockDeductQueueItem item)
    {
        if (string.IsNullOrWhiteSpace(item.MaterialRequirementSnapshotJson))
            return [];

        try
        {
            return JsonSerializer.Deserialize<List<MaterialRequirementSnapshot>>(
                item.MaterialRequirementSnapshotJson,
                MaterialSnapshotJsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static List<MaterialRequirementGroup> BuildMaterialRequirementGroups(StockDeductQueue queue)
    {
        var groups = new Dictionary<Guid, MaterialRequirementGroup>();

        foreach (var snapshot in queue.Items.SelectMany(DeserializeMaterialSnapshots))
        {
            if (!groups.TryGetValue(snapshot.MaterialSkuId, out var group))
            {
                group = new MaterialRequirementGroup
                {
                    MaterialProductId = snapshot.MaterialProductId,
                    MaterialSkuId = snapshot.MaterialSkuId,
                    MaterialSkuCode = snapshot.MaterialSkuCode,
                    MaterialName = snapshot.MaterialName,
                    UnitName = snapshot.UnitName
                };
                groups[snapshot.MaterialSkuId] = group;
            }

            group.RequiredQuantity += snapshot.RequiredQuantity;
            group.AvailableAtCheckout += snapshot.AvailableAtCheckout;
            group.ReservedByOtherPendingAtCheckout += snapshot.ReservedByOtherPendingAtCheckout;
        }

        return groups.Values.ToList();
    }

    private static List<StockDeductQueueLineResponse> BuildQueueLineResponses(StockDeductQueue queue) =>
        queue.Items
            .OrderBy(i => i.SkuSnapshotCode ?? i.SkuSnapshotName)
            .Select(i => new StockDeductQueueLineResponse(
                i.SkuId,
                i.SkuSnapshotCode,
                i.SkuSnapshotName,
                i.OrderedQuantity ?? i.Quantity,
                i.FinishedDeductedQuantity ?? 0,
                i.PendingBomQuantity ?? i.Quantity,
                i.StockHandlingMode ?? StockHandlingModeLegacy))
            .ToList();

    private static PosStockHandlingLineResponse MapQueueLineToPosLine(StockDeductQueueLineResponse line) => new(
        line.SkuId,
        line.SkuCode,
        line.SkuName,
        line.OrderedQuantity,
        line.FinishedDeductedQuantity,
        line.PendingBomQuantity);

    private static string BuildPosStockHandlingMessage(List<PosStockDecision> decisions)
    {
        var immediateQty = decisions.Sum(d => d.FinishedDeductedQuantity);
        var pendingQty = decisions.Sum(d => d.PendingBomQuantity);

        if (pendingQty <= 0)
            return "Đơn đã hoàn tất. Đã trừ tồn quầy POS mặc định ngay khi checkout.";

        if (immediateQty <= 0)
            return $"Đơn đã hoàn tất. {pendingQty} sản phẩm chờ đối soát/trừ nguyên liệu theo BOM.";

        return $"Đơn đã hoàn tất. {immediateQty} sản phẩm đã trừ tồn quầy, {pendingQty} sản phẩm chờ đối soát/trừ nguyên liệu theo BOM.";
    }

    private static string BuildMaterialShortageMessage(
        List<PosStockDecision> decisions,
        IEnumerable<StockShortage> shortages)
    {
        var lineText = string.Join("; ", decisions
            .Where(d => d.PendingBomQuantity > 0)
            .Select(d => $"{d.SkuCode ?? d.SkuName}: tồn quầy {d.FinishedDeductedQuantity}, khách mua {d.OrderedQuantity}, thiếu {d.PendingBomQuantity}"));
        var shortageText = string.Join("; ", shortages.Select(s =>
            $"{s.SkuName} thiếu {s.ShortageQuantity} (cần {s.RequiredQuantity}, khả dụng {s.AvailableQuantity})"));

        return $"Không đủ tồn để hoàn tất đơn. {lineText}. Nguyên liệu không đủ để đóng gói phần còn thiếu: {shortageText}. Vui lòng giảm số lượng hoặc bổ sung tồn/nguyên liệu.";
    }

    private sealed class PosStockDecision
    {
        public Guid SkuId { get; init; }
        public string? SkuCode { get; init; }
        public string SkuName { get; init; } = string.Empty;
        public int OrderedQuantity { get; init; }
        public int FinishedDeductedQuantity { get; init; }
        public int PendingBomQuantity { get; init; }
        public SkuStock? Stock { get; init; }
        public List<MaterialRequirementSnapshot> MaterialRequirements { get; } = [];
    }

    private sealed record MaterialRequirementSnapshot(
        Guid MaterialProductId,
        Guid MaterialSkuId,
        string? MaterialSkuCode,
        string MaterialName,
        string? UnitName,
        int RequiredQuantity,
        int AvailableAtCheckout,
        int ReservedByOtherPendingAtCheckout);

    private sealed class MaterialRequirementGroup
    {
        public Guid MaterialProductId { get; init; }
        public Guid MaterialSkuId { get; init; }
        public string? MaterialSkuCode { get; init; }
        public string MaterialName { get; init; } = string.Empty;
        public string? UnitName { get; init; }
        public int RequiredQuantity { get; set; }
        public int AvailableAtCheckout { get; set; }
        public int ReservedByOtherPendingAtCheckout { get; set; }
    }

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
        stock.WarehouseLowStockThreshold,
        stock.ShelfLowStockThreshold,
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
        slip.CreatedById,
        slip.CreatedByName,
        slip.CreatedByRoleName,
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
        slip.CreatedById,
        slip.CreatedByName,
        slip.CreatedByRoleName,
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
            .Where(s =>
                s.QuantityOnHand <= s.ShelfLowStockThreshold ||
                s.WarehouseQuantityOnHand <= s.WarehouseLowStockThreshold)
            .Select(MapSkuStock)
            .ToList();
    }

    private static InventoryLocation ParseInventoryLocation(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return InventoryLocation.Shelf;

        if (Enum.TryParse<InventoryLocation>(value, ignoreCase: true, out var parsed))
            return parsed;

        throw new InventoryValidationException("Location chỉ hỗ trợ Warehouse hoặc Shelf.");
    }

    // ── Production Orders ──────────────────────────────────────────────────────

    public async Task<ProductionOrderResponse> CreateProductionOrderAsync(
        CreateProductionOrderRequest request,
        Guid userId,
        CancellationToken ct = default)
    {
        var outputs = ResolveProductionOutputs(request.OutputLines);
        var materialLines = ResolveProductionMaterialLines(request.Lines);

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
            Note = request.Note?.Trim(),
            Status = ProductionOrderStatus.Draft,
            CreatedBy = userId,
            CreatedAt = now,
            UpdatedAt = now,
            OutputLines = outputs.Select(output => new ProductionOrderOutputLine
            {
                Id = Guid.NewGuid(),
                ProductionOrderId = orderId,
                FinishedSkuId = output.FinishedSkuId,
                FinishedSkuCode = output.FinishedSkuCode,
                FinishedSkuSnapshotName = output.FinishedSkuSnapshotName,
                PlannedQuantity = output.PlannedQuantity,
                ExpiresAt = output.ExpiresAt,
                CreatedAt = now,
            }).ToList(),
            Lines = materialLines.Select(l => new ProductionOrderLine
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

    private static List<ProductionOrderOutputLineInput> ResolveProductionOutputs(List<ProductionOrderOutputLineInput>? outputs)
    {
        if (outputs == null || outputs.Count == 0)
            throw new InventoryValidationException("Lệnh sản xuất phải có ít nhất một thành phẩm đầu ra.");

        var normalized = new List<ProductionOrderOutputLineInput>();
        var seenSkuIds = new HashSet<Guid>();

        foreach (var output in outputs)
        {
            if (output.FinishedSkuId == Guid.Empty)
                throw new InventoryValidationException("SKU thành phẩm là bắt buộc.");
            if (string.IsNullOrWhiteSpace(output.FinishedSkuCode))
                throw new InventoryValidationException("Mã SKU thành phẩm là bắt buộc.");
            if (string.IsNullOrWhiteSpace(output.FinishedSkuSnapshotName))
                throw new InventoryValidationException("Tên thành phẩm là bắt buộc.");
            if (output.PlannedQuantity <= 0)
                throw new InventoryValidationException($"Số lượng sản xuất của SKU {output.FinishedSkuCode} phải lớn hơn 0.");
            if (!seenSkuIds.Add(output.FinishedSkuId))
                throw new InventoryValidationException($"SKU thành phẩm {output.FinishedSkuCode} bị trùng trong cùng lệnh sản xuất.");

            normalized.Add(new ProductionOrderOutputLineInput(
                output.FinishedSkuId,
                output.FinishedSkuCode.Trim(),
                output.FinishedSkuSnapshotName.Trim(),
                output.PlannedQuantity,
                output.ExpiresAt));
        }

        return normalized;
    }

    private static List<ProductionOrderLineInput> ResolveProductionMaterialLines(List<ProductionOrderLineInput>? lines)
    {
        if (lines == null || lines.Count == 0)
            throw new InventoryValidationException("Lệnh sản xuất phải có ít nhất một dòng nguyên liệu.");

        var normalized = new Dictionary<Guid, ProductionOrderLineInput>();
        foreach (var line in lines)
        {
            if (line.MaterialSkuId == Guid.Empty)
                throw new InventoryValidationException("SKU nguyên liệu là bắt buộc.");
            if (string.IsNullOrWhiteSpace(line.MaterialSkuCode))
                throw new InventoryValidationException("Mã SKU nguyên liệu là bắt buộc.");
            if (string.IsNullOrWhiteSpace(line.MaterialSnapshotName))
                throw new InventoryValidationException("Tên nguyên liệu là bắt buộc.");
            if (line.PlannedQuantity <= 0)
                throw new InventoryValidationException($"Số lượng nguyên liệu {line.MaterialSkuCode} phải lớn hơn 0.");

            var normalizedLine = new ProductionOrderLineInput(
                line.MaterialSkuId,
                line.MaterialSkuCode.Trim(),
                line.MaterialSnapshotName.Trim(),
                line.PlannedQuantity);

            if (!normalized.TryGetValue(line.MaterialSkuId, out var existing))
            {
                normalized[line.MaterialSkuId] = normalizedLine;
                continue;
            }

            normalized[line.MaterialSkuId] = existing with
            {
                PlannedQuantity = existing.PlannedQuantity + normalizedLine.PlannedQuantity
            };
        }

        return normalized.Values
            .OrderBy(l => l.MaterialSkuCode)
            .ToList();
    }

    public async Task<ProductionOrderResponse> CompleteProductionOrderAsync(
        Guid id,
        Guid userId,
        CreatorSnapshot? creator,
        CancellationToken ct = default)
    {
        var order = await _productionOrderRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy lệnh sản xuất.");

        if (order.Status != ProductionOrderStatus.Draft)
            throw new InventoryValidationException("Chỉ có thể hoàn thành lệnh đang ở trạng thái Chờ xác nhận.");

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var now = DateTime.UtcNow;
            var materialSkuIds = new List<Guid>();
            var outputLines = ResolveCompletionOutputLines(order);
            var materialLines = order.Lines.OrderBy(l => l.MaterialSkuCode).ToList();
            if (materialLines.Count == 0)
                throw new InventoryValidationException("Lệnh sản xuất phải có ít nhất một dòng nguyên liệu.");
            foreach (var line in materialLines)
            {
                if (line.PlannedQuantity <= 0)
                    throw new InventoryValidationException($"Số lượng nguyên liệu {line.MaterialSkuCode} phải lớn hơn 0.");
            }

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
                CreatedById = userId == Guid.Empty ? null : userId,
                CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
                CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
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
                    Note = $"Lệnh sản xuất {order.ProductionCode}",
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

            var importSlipId = Guid.NewGuid();
            var importLines = new List<StockImportSlipLine>();
            for (var i = 0; i < outputLines.Count; i++)
            {
                var outputLine = outputLines[i];
                var finishedStockBefore = await _skuStockRepo.GetBySkuIdAsync(outputLine.FinishedSkuId, innerCt);
                var finishedWarehouseBefore = finishedStockBefore?.WarehouseQuantityOnHand ?? 0;
                var finishedStoreBefore = finishedStockBefore?.QuantityOnHand ?? 0;

                var finishedBatch = await CreateWarehouseBatchInternalAsync(
                    lotCode: BuildProductionFinishedLotCode(now, order, i),
                    supplier: null,
                    expiresAt: outputLine.ExpiresAt,
                    note: $"Lệnh sản xuất {order.ProductionCode} - {outputLine.FinishedSkuCode}",
                    items: [new CreateWarehouseBatchItemRequest(
                        outputLine.FinishedSkuId,
                        outputLine.FinishedSkuCode,
                        outputLine.FinishedSkuSnapshotName,
                        outputLine.PlannedQuantity,
                        null)],
                    createdBy: userId,
                    ct: innerCt,
                    sourceType: "production_finished_goods",
                    sourceReferenceId: order.Id,
                    sourceReferenceCode: order.ProductionCode);

                outputLine.WarehouseBatchId = finishedBatch.Id;
                outputLine.WarehouseBatchLotCode = finishedBatch.LotCode;

                var finishedStockAfter = await _skuStockRepo.GetBySkuIdAsync(outputLine.FinishedSkuId, innerCt);
                var finishedWarehouseAfter = finishedStockAfter?.WarehouseQuantityOnHand ?? finishedWarehouseBefore;
                var finishedStoreAfter = finishedStockAfter?.QuantityOnHand ?? finishedStoreBefore;

                importLines.Add(new StockImportSlipLine
                {
                    Id = Guid.NewGuid(),
                    StockImportSlipId = importSlipId,
                    SkuId = outputLine.FinishedSkuId,
                    SkuCode = outputLine.FinishedSkuCode,
                    ProductSnapshotName = outputLine.FinishedSkuSnapshotName,
                    Quantity = outputLine.PlannedQuantity,
                    WarehouseQtyBefore = finishedWarehouseBefore,
                    WarehouseQtyAfter = finishedWarehouseAfter,
                    StoreQtyBefore = finishedStoreBefore,
                    StoreQtyAfter = finishedStoreAfter,
                    WarehouseBatchId = finishedBatch.Id,
                    WarehouseBatchLotCode = finishedBatch.LotCode,
                    ProductionOrderOutputLineId = outputLine.Id,
                    Note = $"Nhập thành phẩm từ lệnh {order.ProductionCode}",
                    CreatedAt = now,
                });
            }

            await _productionOrderRepo.SaveChangesAsync(innerCt);

            var firstImportLine = importLines[0];
            var importCountToday = await _importSlipRepo.CountCreatedSinceAsync(now.Date, innerCt);
            var importSlip = new StockImportSlip
            {
                Id = importSlipId,
                ImportCode = $"PN-{now:yyyyMMdd}-{(importCountToday + 1):D4}",
                ImportType = "production_finished_goods_receipt",
                SkuId = firstImportLine.SkuId,
                SkuCode = firstImportLine.SkuCode,
                ProductSnapshotName = firstImportLine.ProductSnapshotName,
                Quantity = firstImportLine.Quantity,
                WarehouseQtyBefore = firstImportLine.WarehouseQtyBefore,
                WarehouseQtyAfter = firstImportLine.WarehouseQtyAfter,
                StoreQtyBefore = firstImportLine.StoreQtyBefore,
                StoreQtyAfter = firstImportLine.StoreQtyAfter,
                WarehouseBatchId = firstImportLine.WarehouseBatchId,
                WarehouseBatchLotCode = firstImportLine.WarehouseBatchLotCode,
                ProductionOrderId = order.Id,
                ProductionCode = order.ProductionCode,
                Note = outputLines.Count == 1
                    ? $"Nhập thành phẩm từ lệnh {order.ProductionCode}"
                    : $"Nhập thành phẩm từ lệnh {order.ProductionCode} ({outputLines.Count} dòng thành phẩm)",
                CreatedBy = userId,
                CreatedById = userId == Guid.Empty ? null : userId,
                CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
                CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
                CreatedAt = now,
                Lines = importLines,
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
                if (stock != null && stock.WarehouseQuantityOnHand <= stock.WarehouseLowStockThreshold)
                    await _eventPublisher.PublishLowStockAsync(
                        stock.SkuId, stock.SkuCode, stock.WarehouseQuantityOnHand, stock.WarehouseLowStockThreshold, innerCt);
            }

            return MapProductionOrder(order);
        }, ct);
    }

    private static List<ProductionOrderOutputLine> ResolveCompletionOutputLines(ProductionOrder order)
    {
        var outputLines = order.OutputLines
            .OrderBy(l => l.CreatedAt)
            .ThenBy(l => l.FinishedSkuCode)
            .ToList();

        if (outputLines.Count == 0)
            throw new InventoryValidationException("Lệnh sản xuất phải có ít nhất một thành phẩm đầu ra.");

        var seenSkuIds = new HashSet<Guid>();
        foreach (var output in outputLines)
        {
            if (output.FinishedSkuId == Guid.Empty)
                throw new InventoryValidationException("SKU thành phẩm là bắt buộc.");
            if (string.IsNullOrWhiteSpace(output.FinishedSkuCode))
                throw new InventoryValidationException("Mã SKU thành phẩm là bắt buộc.");
            if (string.IsNullOrWhiteSpace(output.FinishedSkuSnapshotName))
                throw new InventoryValidationException("Tên thành phẩm là bắt buộc.");
            if (output.PlannedQuantity <= 0)
                throw new InventoryValidationException($"Số lượng sản xuất của SKU {output.FinishedSkuCode} phải lớn hơn 0.");
            if (!seenSkuIds.Add(output.FinishedSkuId))
                throw new InventoryValidationException($"SKU thành phẩm {output.FinishedSkuCode} bị trùng trong cùng lệnh sản xuất.");

            output.FinishedSkuCode = output.FinishedSkuCode.Trim();
            output.FinishedSkuSnapshotName = output.FinishedSkuSnapshotName.Trim();
        }

        return outputLines;
    }

    private static string BuildProductionFinishedLotCode(DateTime now, ProductionOrder order, int outputIndex)
    {
        var orderSuffix = order.Id.ToString("N")[..6].ToUpperInvariant();
        return $"SX-{now:yyyyMMddHHmmss}-{outputIndex + 1:D2}-{orderSuffix}";
    }

    public async Task<ProductionOrderResponse> CancelProductionOrderAsync(
        Guid id,
        Guid userId,
        CancellationToken ct = default)
    {
        var order = await _productionOrderRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy lệnh sản xuất.");

        if (order.Status != ProductionOrderStatus.Draft)
            throw new InventoryValidationException("Chỉ có thể hủy lệnh đang ở trạng thái Chờ xác nhận.");

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
                l.PlannedQuantity,
                l.ExpiresAt,
                l.WarehouseBatchId,
                l.WarehouseBatchLotCode,
                l.CreatedAt))
            .ToList();

        return outputLines;
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
            if (stock != null && stock.WarehouseQuantityOnHand <= stock.WarehouseLowStockThreshold)
                await _eventPublisher.PublishLowStockAsync(
                    stock.SkuId, stock.SkuCode, stock.WarehouseQuantityOnHand, stock.WarehouseLowStockThreshold, ct);
        }
    }
}
