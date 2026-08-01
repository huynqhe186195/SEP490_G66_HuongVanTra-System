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
using System.Text.RegularExpressions;

namespace InventoryService.Application.UseCases;

public class InventoryLogic(
    ISkuStockRepository _skuStockRepo,
    IStockDeductQueueRepository _queueRepo,
    IStockAdjustmentRequestRepository _adjustmentRequestRepo,
    IStockExportSlipRepository _exportSlipRepo,
    IStockImportSlipRepository _importSlipRepo,
    IWarehouseBatchRepository _batchRepo,
    IStockExportBatchAllocationRepository _exportAllocationRepo,
    IInventoryLedgerRepository _ledgerRepo,
    ISupplierReceiptRepository _supplierReceiptRepo,
    IShelfReturnRequestRepository _shelfReturnRepo,
    ISupplierReturnRequestRepository _supplierReturnRepo,
    IStocktakeRequestRepository _stocktakeRepo,
    IShelfReplenishmentSuggestionRepository _suggestionRepo,
    IProcessedIntegrationEventRepository _processedEvents,
    IInventoryEventPublisher _eventPublisher,
    IInventoryUnitOfWork _unitOfWork,
    IProductionOrderRepository _productionOrderRepo,
    IProductCatalogClient _productCatalogClient,
    ISupplierRepository _supplierRepo,
    ISupplierProductRepository _supplierProductRepo,
    IReturnInspectionRepository _returnInspectionRepo,
    IOptions<InventoryOptions> inventoryOptions)
{
    private readonly InventoryOptions _inventoryOptions = inventoryOptions.Value;

    public bool IsSimulateWarehouse => _inventoryOptions.SimulateWarehouse;

    public const string SkuCreatedEventType = "SkuCreated";
    public const string OrderPlacedEventType = "OrderPlaced";
    public const string OrderCancelledEventType = "OrderCancelled";
    public const string OrderReturnedEventType = "OrderReturned";
    public const string OrderShippedEventType = "OrderShipped";
    /// <summary>POS-04 (H4): inbox key cho thao tác thay giữ chỗ khi sửa đơn COD (dedupe theo OperationId).</summary>
    public const string CodReservationReplacedEventType = "CodReservationReplaced";
    private const string StockHandlingModeImmediate = "ImmediateFinishedStockOnly";
    private const string StockHandlingModeFullBomPending = "FullBomPending";
    private const string StockHandlingModePartialBomPending = "PartialFinishedDeductedBomPending";
    private const string StockHandlingModeLegacy = "LegacyPendingFinishedStock";
    private const string LocationWarehouse = "Warehouse";
    private const string LocationShelf = "Shelf";
    private const string TransactionSupplierReceipt = "SUPPLIER_RECEIPT";
    private const string TransactionShelfReplenishmentOut = "SHELF_REPLENISHMENT_OUT";
    private const string TransactionShelfReplenishmentIn = "SHELF_REPLENISHMENT_IN";
    private const string TransactionShelfReturnOut = "SHELF_RETURN_OUT";
    private const string TransactionShelfReturnIn = "SHELF_RETURN_IN";
    private const string TransactionSupplierReturn = "SUPPLIER_RETURN";
    private const string TransactionInboundDataCorrection = "INBOUND_DATA_CORRECTION";
    private const string TransactionProductionMaterialExport = "PRODUCTION_MATERIAL_EXPORT";
    private const string TransactionProductionFinishedReceipt = "PRODUCTION_FINISHED_RECEIPT";
    private const string TransactionStocktakeAdjustment = "STOCKTAKE_ADJUSTMENT";
    private const string TransactionPosSale = "POS_SALE";
    private const string TransactionSalesDeductLater = "SALES_DEDUCT_LATER";
    private const string TransactionSalesBomReconciliation = "SALES_BOM_RECONCILIATION";
    private const string TransactionCustomBundleMaterialExport = "CUSTOM_BUNDLE_MATERIAL_EXPORT";
    private const string TransactionCustomerReturnReceipt = "CUSTOMER_RETURN_RECEIPT";
    private const string ReferenceSupplierReceipt = "SupplierReceipt";
    private const string ReferenceShelfReplenishment = "ShelfReplenishment";
    private const string ReferenceShelfReturn = "ShelfReturn";
    private const string ReferenceSupplierReturn = "SupplierReturn";
    private const string ReferenceProductionOrder = "ProductionOrder";
    private const string ReferenceStocktake = "Stocktake";
    private const string ReferenceOrder = "Order";
    private const string ReferenceCustomBundle = "CustomBundle";
    private const string ReferenceCustomerReturn = "CustomerReturn";
    private const int SupplierCodeMaxLength = 50;
    private const string SupplierCodeDuplicateMessage = "Mã Nhà Cung Cấp đã tồn tại.";
    private static readonly IReadOnlyDictionary<string, string> StocktakeReasonCodes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["NATURAL_SHRINKAGE"] = "Hao hut tu nhien",
        ["SPOILAGE_OR_DAMAGE"] = "Hu hong",
        ["LOSS_OR_THEFT"] = "Mat mat",
        ["DATA_ENTRY_ERROR"] = "Sai lech nhap lieu",
        ["PRODUCTION_WASTE"] = "Hao hut san xuat",
        ["FOUND_STOCK"] = "Tim thay ton",
        ["INBOUND_NOT_RECORDED"] = "Nhap kho chua ghi nhan",
        ["OTHER"] = "Khac",
    };
    private static readonly JsonSerializerOptions MaterialSnapshotJsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
    };
    private static readonly Regex DocumentNumberRegex = new(@"^[A-Za-z0-9\-\/\.]{1,100}$", RegexOptions.Compiled);
    private static readonly Regex HtmlTagRegex = new(@"<[^>]*>|&[a-zA-Z0-9#]+;", RegexOptions.Compiled);

    public async Task HandleSkuCreatedAsync(SkuCreatedEvent message, CancellationToken ct = default)
    {
        if (await _processedEvents.ExistsAsync(SkuCreatedEventType, message.SkuId, ct))
            return;

        if (await _skuStockRepo.GetBySkuIdAsync(message.SkuId, ct) != null)
        {
            await _processedEvents.AddAsync(SkuCreatedEventType, message.SkuId, eventId: null, ct);
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

        await _processedEvents.AddAsync(SkuCreatedEventType, message.SkuId, eventId: null, ct);
        await _skuStockRepo.SaveChangesAsync(ct);
    }

    public async Task HandleOrderPlacedAsync(OrderPlacedEvent message, CancellationToken ct = default)
    {
        // G6: EventId là khoá chống trùng có thẩm quyền — broker giao lại cùng event → bỏ qua.
        if (message.EventId != Guid.Empty
            && await _processedEvents.ExistsByEventIdAsync(message.EventId, ct))
            return;

        var paymentStatus = (message.OrderStatus ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(paymentStatus))
            paymentStatus = "pendingpayment";

        var existingQueue = await _queueRepo.GetByOrderIdAsync(message.OrderId, ct);
        if (existingQueue != null)
        {
            var customerName = NormalizeCustomerSnapshotName(message.CustomerSnapshotName);
            var queueChanged = false;

            if (!string.Equals(existingQueue.OrderPaymentStatus, paymentStatus, StringComparison.Ordinal))
            {
                existingQueue.OrderPaymentStatus = paymentStatus;
                queueChanged = true;
            }

            // POS-04 (truy vết giữ chỗ): chỉ điền snapshot khi còn trống để event giao lại
            // không ghi đè tên khách đã lưu bằng contract cũ (chuỗi rỗng).
            if (customerName != null && string.IsNullOrWhiteSpace(existingQueue.CustomerSnapshotName))
            {
                existingQueue.CustomerSnapshotName = customerName;
                queueChanged = true;
            }

            if (queueChanged)
                await _queueRepo.SaveChangesAsync(ct);

            if (!await _processedEvents.ExistsAsync(OrderPlacedEventType, message.OrderId, ct))
            {
                await _processedEvents.AddAsync(OrderPlacedEventType, message.OrderId, NullableEventId(message.EventId), ct);
                await _queueRepo.SaveChangesAsync(ct);
            }

            // Đơn đã thanh toán/hoàn tất → tự trừ tồn quầy (trước đây chỉ tạo queue, không confirm).
            if (IsPaidOrderPaymentStatus(paymentStatus)
                && existingQueue.QueueStatus == QueueStatus.Waiting
                && !existingQueue.IsDeducted)
            {
                await TryAutoConfirmQueueAsync(existingQueue.Id, ct);
            }
            else if (IsCodOrderChannel(message.OrderChannel)
                && existingQueue.QueueStatus == QueueStatus.Waiting
                && !existingQueue.IsDeducted)
            {
                // POS-04 (quyết định #5): chỉ đơn COD chờ xác nhận mới giữ chỗ tồn Kệ Hàng
                // (idempotent). Các kênh khác chưa thanh toán không tự giữ chỗ.
                await ReserveQueueStockAsync(existingQueue.Id, ct);
            }

            return;
        }

        if (await _processedEvents.ExistsAsync(OrderPlacedEventType, message.OrderId, ct))
            return;

        var queue = new StockDeductQueue
        {
            Id = Guid.NewGuid(),
            OrderId = message.OrderId,
            OrderCode = message.OrderCode,
            OrderPaymentStatus = paymentStatus,
            OrderStockStatus = "pending_deduct",
            CustomerSnapshotName = NormalizeCustomerSnapshotName(message.CustomerSnapshotName),
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
        await _processedEvents.AddAsync(OrderPlacedEventType, message.OrderId, NullableEventId(message.EventId), ct);
        await _queueRepo.SaveChangesAsync(ct);

        if (IsPaidOrderPaymentStatus(paymentStatus))
            await TryAutoConfirmQueueAsync(queue.Id, ct);
        else if (IsCodOrderChannel(message.OrderChannel))
            // POS-04 (quyết định #5): đơn COD chờ xác nhận → giữ chỗ tồn Kệ Hàng ngay khi
            // vào queue. Kênh khác chưa thanh toán (Website/Zalo/Phone) không tự giữ chỗ.
            await ReserveQueueStockAsync(queue.Id, ct);
    }

    private static bool IsPaidOrderPaymentStatus(string? status)
    {
        var key = (status ?? string.Empty).Trim().ToLowerInvariant();
        return key is "completed" or "success" or "paid";
    }

    /// <summary>
    /// POS-04 (truy vết giữ chỗ): rỗng = contract cũ hoặc khách lẻ → giữ null thay vì chuỗi rỗng.
    /// </summary>
    private static string? NormalizeCustomerSnapshotName(string? name)
    {
        var trimmed = (name ?? string.Empty).Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    /// <summary>
    /// POS-04 (quyết định #5): chỉ đơn kênh COD (tạo qua workflow có quyền COD) mới giữ chỗ.
    /// OrderChannel rỗng = contract cũ trước khi thêm field → không coi là COD.
    /// </summary>
    private static bool IsCodOrderChannel(string? channel) =>
        string.Equals((channel ?? string.Empty).Trim(), "COD", StringComparison.OrdinalIgnoreCase);

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

        var response = await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
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
                // POS-04: tồn khả bán tại quầy trừ đi phần đã giữ chỗ cho đơn COD chờ xác nhận.
                var counterQty = Math.Max(0, (stock?.QuantityOnHand ?? 0) - (stock?.ReservedQuantity ?? 0));
                if (!_inventoryOptions.SimulateWarehouse)
                {
                    var shelfBatchQty = await _batchRepo.SumQuantityOnHandAsync(item.SkuId, LocationShelf, innerCt);
                    counterQty = Math.Min(counterQty, Math.Max(0, shelfBatchQty));
                }
                var immediateQty = Math.Min(item.Quantity, counterQty);
                var pendingQty = Math.Max(0, item.Quantity - immediateQty);

                decisions.Add(new PosStockDecision
                {
                    SkuId = item.SkuId,
                    SkuCode = NormalizeSnapshotText(item.SkuSnapshotCode) ?? NormalizeSnapshotText(stock?.SkuCode),
                    SkuName = NormalizeSnapshotText(item.SkuSnapshotName)
                        ?? NormalizeSnapshotText(item.SkuSnapshotCode)
                        ?? NormalizeSnapshotText(stock?.SkuCode)
                        ?? item.SkuId.ToString(),
                    OrderedQuantity = item.Quantity,
                    FinishedDeductedQuantity = immediateQty,
                    PendingBomQuantity = pendingQty,
                    Stock = stock
                });
            }

            var pendingDecisions = decisions.Where(d => d.PendingBomQuantity > 0).ToList();
            if (pendingDecisions.Count > 0)
            {
                ProductCatalogSnapshot catalog;
                try
                {
                    catalog = await _productCatalogClient.GetCatalogForVariantIdsAsync(
                        pendingDecisions.Select(d => d.SkuId),
                        innerCt);
                }
                catch (InventoryValidationException)
                {
                    throw new InventoryValidationException(
                        "Không tải được dữ liệu BOM để kiểm tra bán trước, trừ sau. Vui lòng thử lại hoặc kiểm tra kết nối dịch vụ Product.");
                }

                ValidatePendingPosCatalog(decisions, catalog);
                await ResolvePendingBomMaterialSnapshotsAsync(decisions, catalog, innerCt);
            }

            var now = DateTime.UtcNow;
            await DeductImmediateFinishedStockAsync(
                request.OrderId,
                request.OrderCode.Trim(),
                decisions,
                createdBy,
                creator,
                now,
                innerCt);

            var queueIds = new List<Guid>();
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

        await CheckAndNotifyShelfLowStockAsync(
            response.Lines.Where(l => l.FinishedDeductedQuantity > 0).Select(l => l.SkuId),
            ct);
        return response;
    }

    public async Task HandleOrderCancelledAsync(OrderCancelledEvent message, CancellationToken ct = default)
    {
        // G6: EventId là khoá chống trùng có thẩm quyền; (EventType, OrderId) là khoá nghiệp vụ.
        if (message.EventId != Guid.Empty
            && await _processedEvents.ExistsByEventIdAsync(message.EventId, ct))
            return;

        if (await _processedEvents.ExistsAsync(OrderCancelledEventType, message.OrderId, ct))
            return;

        var queue = await _queueRepo.GetByOrderIdAsync(message.OrderId, ct);
        if (queue == null)
        {
            await _processedEvents.AddAsync(OrderCancelledEventType, message.OrderId, NullableEventId(message.EventId), ct);
            await _queueRepo.SaveChangesAsync(ct);
            return;
        }

        if (queue.IsDeducted)
        {
            if (IsAfterShippingStatus(message.PreviousOrderStatus))
            {
                // POS-04 (quyết định #10): hủy/giao thất bại SAU khi đã bàn giao giao hàng
                // không được cộng trực tiếp lại tồn Kệ — hàng phải qua Return Inspection
                // (Phase J) mới quyết định restock/quarantine/dispose.
                queue.QueueStatus = QueueStatus.Cancelled;
                queue.OrderStockStatus = "cancelled_after_shipping";
                queue.ConfirmedAt ??= DateTime.UtcNow;

                await _processedEvents.AddAsync(OrderCancelledEventType, message.OrderId, NullableEventId(message.EventId), ct);
                await _queueRepo.SaveChangesAsync(ct);
                return;
            }

            await RestoreStockAsync(queue, ct);
            queue.IsDeducted = false;
        }
        else
        {
            // POS-04: hủy trước khi trừ tồn → nhả giữ chỗ Kệ Hàng (idempotent).
            await ReleaseQueueReservationAsync(queue, ct);
        }

        queue.QueueStatus = QueueStatus.Cancelled;
        queue.OrderStockStatus = queue.IsDeducted ? "restored" : "cancelled";
        queue.ConfirmedAt ??= DateTime.UtcNow;

        await _processedEvents.AddAsync(OrderCancelledEventType, message.OrderId, NullableEventId(message.EventId), ct);
        await _queueRepo.SaveChangesAsync(ct);
    }

    /// <summary>
    /// POS-04 (H5, quyết định #7/#8): đơn COD bàn giao giao hàng → trừ tồn vật lý Kệ Hàng
    /// đúng một lần (tiêu thụ reservation qua ConfirmQueueAsync). Idempotent hai tầng:
    /// EventId (broker giao lại) + business key (EventType, OrderId) + guard IsDeducted/QueueStatus
    /// (VerifyCod hoặc duplicate Shipping sau đó không trừ lần hai).
    /// Queue đã Cancelled/released → ghi nhận event, không trừ, không ném lỗi (an toàn).
    /// </summary>
    public async Task HandleOrderShippedAsync(OrderShippedEvent message, CancellationToken ct = default)
    {
        // G6: EventId là khoá chống trùng có thẩm quyền; (EventType, OrderId) là khoá nghiệp vụ.
        if (message.EventId != Guid.Empty
            && await _processedEvents.ExistsByEventIdAsync(message.EventId, ct))
            return;

        if (await _processedEvents.ExistsAsync(OrderShippedEventType, message.OrderId, ct))
            return;

        var queue = await _queueRepo.GetByOrderIdAsync(message.OrderId, ct);
        if (queue == null)
        {
            // Chưa có queue (event Placed chưa tới hoặc đơn không đi qua Inventory) —
            // ghi nhận business key để duplicate không xử lý lại; không tự trừ tồn thiếu căn cứ.
            await _processedEvents.AddAsync(OrderShippedEventType, message.OrderId, NullableEventId(message.EventId), ct);
            await _queueRepo.SaveChangesAsync(ct);
            return;
        }

        if (queue.IsDeducted || queue.QueueStatus == QueueStatus.Confirmed)
        {
            // Đã trừ tồn trước đó (duplicate Shipping / VerifyCod đã chạy) → no-op.
            await _processedEvents.AddAsync(OrderShippedEventType, message.OrderId, NullableEventId(message.EventId), ct);
            await _queueRepo.SaveChangesAsync(ct);
            return;
        }

        if (queue.QueueStatus == QueueStatus.Cancelled)
        {
            // Queue đã hủy/nhả giữ chỗ — không commit tồn cho đơn không còn hiệu lực.
            queue.LastShortageReason =
                "OrderShipped nhận sau khi queue đã hủy — không trừ tồn; cần đối soát thủ công.";
            await _processedEvents.AddAsync(OrderShippedEventType, message.OrderId, NullableEventId(message.EventId), ct);
            await _queueRepo.SaveChangesAsync(ct);
            return;
        }

        // Waiting/Insufficient → commit vật lý: ConfirmQueueAsync chạy trong transaction,
        // tiêu thụ đúng phần giữ chỗ của queue này (otherReserved) và tạo phiếu xuất/ledger.
        // Thiếu tồn → queue chuyển Insufficient, chờ xử lý thủ công (không ném lỗi ra consumer).
        // Ghi business key SAU khi confirm để lỗi transient không bị đánh dấu đã xử lý
        // (redelivery an toàn nhờ guard IsDeducted ở trên).
        await TryAutoConfirmQueueAsync(queue.Id, ct);
        await _processedEvents.AddAsync(OrderShippedEventType, message.OrderId, NullableEventId(message.EventId), ct);
        await _queueRepo.SaveChangesAsync(ct);
    }

    public async Task HandleOrderReturnedAsync(OrderReturnedEvent message, CancellationToken ct = default)    {
        // G6: EventId là khoá chống trùng có thẩm quyền; (EventType, ReturnId) là khoá nghiệp vụ.
        if (message.EventId != Guid.Empty
            && await _processedEvents.ExistsByEventIdAsync(message.EventId, ct))
            return;

        if (await _processedEvents.ExistsAsync(OrderReturnedEventType, message.ReturnId, ct))
            return;

        await ReceiveCustomerReturnToShelfAsync(message, ct);
    }

    /// <summary>Chuẩn hoá EventId: Guid.Empty (contract cũ/chưa gắn) → null.</summary>
    private static Guid? NullableEventId(Guid eventId) =>
        eventId == Guid.Empty ? null : eventId;

    /// <summary>
    /// POS-04 (quyết định #10): trạng thái trước hủy thuộc nhóm "đã bàn giao giao hàng".
    /// Rỗng = contract cũ → giữ hành vi restore hiện tại.
    /// </summary>
    private static bool IsAfterShippingStatus(string? previousStatus) =>
        string.Equals((previousStatus ?? string.Empty).Trim(), "Shipping", StringComparison.OrdinalIgnoreCase);

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
                // POS-04: phần giữ chỗ của chính queue này được tính là khả dụng khi trừ tồn;
                // chỉ phần giữ chỗ của các đơn khác mới chặn. Legacy (Reserved=0) không đổi hành vi.
                var otherReserved = stock == null
                    ? 0
                    : queue.IsReserved
                        ? Math.Max(0, stock.ReservedQuantity - item.Quantity)
                        : stock.ReservedQuantity;
                var availableForQueue = Math.Max(0, (stock?.QuantityOnHand ?? 0) - otherReserved);
                if (stock == null || availableForQueue < item.Quantity)
                {
                    shortages.Add(new StockShortage(
                        item.SkuId,
                        item.SkuSnapshotName,
                        item.Quantity,
                        availableForQueue,
                        item.Quantity - availableForQueue));
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
            var allAllocations = new List<StockExportBatchAllocation>();
            var ledgerEntries = new List<InventoryLedgerEntry>();
            var transactionGroupId = Guid.NewGuid();

            foreach (var item in orderedItems)
            {
                var stock = stockBySkuId[item.SkuId];
                var warehouseBefore = stock.WarehouseQuantityOnHand;
                var storeBefore = stock.QuantityOnHand;

                // POS-04: trừ tồn Kệ Hàng theo FEFO ở chế độ lô (SimulateWarehouse=false) để
                // aggregate luôn khớp tổng lô; chế độ mô phỏng thì trừ trực tiếp aggregate.
                List<StockExportBatchAllocation> allocations = [];
                int storeAfter;
                if (_inventoryOptions.SimulateWarehouse)
                {
                    storeAfter = storeBefore - item.Quantity;
                    stock.QuantityOnHand = storeAfter;
                }
                else
                {
                    allocations = await AllocateAndDeductBatchesFifoAsync(
                        item.SkuId,
                        item.Quantity,
                        innerCt,
                        LocationShelf);
                    storeAfter = await _batchRepo.SumQuantityOnHandAsync(item.SkuId, LocationShelf, innerCt);
                    stock.QuantityOnHand = storeAfter;
                }

                var slipLine = new StockExportSlipLine
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
                };

                foreach (var allocation in allocations)
                {
                    allocation.StockExportSlipId = slipId;
                    allocation.StockExportSlipLineId = slipLine.Id;
                }

                slipLines.Add(slipLine);
                allAllocations.AddRange(allocations);
                ledgerEntries.Add(CreateLedgerEntry(
                    transactionGroupId,
                    item.SkuId,
                    item.SkuSnapshotCode ?? item.SkuId.ToString()[..8],
                    item.SkuSnapshotName,
                    LocationShelf,
                    storeBefore,
                    -item.Quantity,
                    storeAfter,
                    TransactionSalesDeductLater,
                    LocationShelf,
                    null,
                    ReferenceOrder,
                    queue.OrderId,
                    queue.OrderCode,
                    allocations.Count == 1 ? allocations[0].WarehouseBatchId : null,
                    allocations.Count == 1 ? allocations[0].LotCode : null,
                    confirmedBy,
                    confirmer,
                    $"Trừ tồn quầy cho đơn hàng {queue.OrderCode}",
                    slipLine.Note));

                // POS-04: tồn vật lý đã rời quầy → nhả phần giữ chỗ tương ứng của queue này.
                if (queue.IsReserved)
                    stock.ReservedQuantity = Math.Max(0, stock.ReservedQuantity - item.Quantity);
                stock.UpdatedAt = now;
            }

            // POS-04: đã tiêu thụ toàn bộ giữ chỗ của queue trong vòng lặp trên.
            queue.IsReserved = false;

            // POS-04 (truy vết giữ chỗ): giữ chỗ chuyển thành xuất kho, rời khỏi tổng đang giữ
            // nhưng vẫn truy vết được từ màn hình đơn và màn hình SKU.
            StampItemsDeducted(queue, now);

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
                ReferenceType = ReferenceOrder,
                ReferenceId = queue.OrderId,
                ReferenceCode = queue.OrderCode,
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
            if (allAllocations.Count > 0)
                await _exportAllocationRepo.AddRangeAsync(allAllocations, innerCt);
            if (ledgerEntries.Count > 0)
                await _ledgerRepo.AddRangeAsync(ledgerEntries, innerCt);
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
            var ledgerEntries = new List<InventoryLedgerEntry>();
            var transactionGroupId = Guid.NewGuid();
            var effectiveConfirmedBy = confirmedBy == Guid.Empty ? Guid.Empty : confirmedBy;

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
                ledgerEntries.Add(CreateLedgerEntry(
                    transactionGroupId,
                    group.MaterialSkuId,
                    group.MaterialSkuCode ?? group.MaterialSkuId.ToString()[..8],
                    group.MaterialName,
                    LocationWarehouse,
                    warehouseBefore,
                    -group.RequiredQuantity,
                    warehouseAfter,
                    TransactionSalesBomReconciliation,
                    LocationWarehouse,
                    null,
                    ReferenceOrder,
                    currentQueue.OrderId,
                    currentQueue.OrderCode,
                    allocations.Count == 1 ? allocations[0].WarehouseBatchId : null,
                    allocations.Count == 1 ? allocations[0].LotCode : null,
                    effectiveConfirmedBy,
                    confirmer,
                    $"Ban truoc tru sau {currentQueue.OrderCode}",
                    slipLine.Note));
            }

            var firstLine = slipLines[0];
            var exportCountToday = await _exportSlipRepo.CountCreatedSinceAsync(now.Date, innerCt);
            var exportSlip = new StockExportSlip
            {
                Id = slipId,
                ExportCode = $"PX-{now:yyyyMMdd}-{(exportCountToday + 1):D4}",
                ExportType = "sales_bom_reconciliation",
                StockAdjustmentRequestId = null,
                ProductionOrderId = null,
                ProductionCode = null,
                ReferenceType = ReferenceOrder,
                ReferenceId = currentQueue.OrderId,
                ReferenceCode = currentQueue.OrderCode,
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
            if (ledgerEntries.Count > 0)
            {
                await _ledgerRepo.AddRangeAsync(ledgerEntries, innerCt);
                await _ledgerRepo.SaveChangesAsync(innerCt);
            }

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

        // POS-04: hủy queue chờ → nhả giữ chỗ Kệ Hàng trước khi lưu (idempotent).
        await ReleaseQueueReservationAsync(queue, ct);

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

    /// <summary>Ngưỡng Kho do Thủ kho quản lý — không đụng tới ngưỡng Kệ.</summary>
    public async Task<SkuStockResponse> UpdateWarehouseLowStockThresholdAsync(
        Guid skuId,
        UpdateWarehouseLowStockThresholdRequest request,
        CancellationToken ct = default)
    {
        var stock = await LoadStockForThresholdAsync(skuId, request?.Threshold, ct);
        stock.WarehouseLowStockThreshold = request!.Threshold;
        stock.UpdatedAt = DateTime.UtcNow;
        await _skuStockRepo.SaveChangesAsync(ct);
        return MapSkuStock(stock);
    }

    /// <summary>Ngưỡng Kệ Hàng do Quản lý quản lý — không đụng tới ngưỡng Kho.</summary>
    public async Task<SkuStockResponse> UpdateShelfLowStockThresholdAsync(
        Guid skuId,
        UpdateShelfLowStockThresholdRequest request,
        CancellationToken ct = default)
    {
        var stock = await LoadStockForThresholdAsync(skuId, request?.Threshold, ct);
        stock.ShelfLowStockThreshold = request!.Threshold;
        stock.LowStockThreshold = request.Threshold;
        stock.UpdatedAt = DateTime.UtcNow;
        await _skuStockRepo.SaveChangesAsync(ct);
        return MapSkuStock(stock);
    }

    private async Task<SkuStock> LoadStockForThresholdAsync(Guid skuId, int? threshold, CancellationToken ct)
    {
        if (threshold is null)
            throw new InventoryValidationException("Request body là bắt buộc.");
        if (threshold < 0)
            throw new InventoryValidationException("Ngưỡng tồn thấp không được âm.");

        return await _skuStockRepo.GetBySkuIdAsync(skuId, ct)
            ?? throw new InventoryNotFoundException($"Không tìm thấy tồn kho cho SKU '{skuId}'.");
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

    /// <summary>Chỉ trả thông tin tồn quầy — dành cho Admin/Manager, không expose số liệu kho tổng.</summary>
    public async Task<List<StoreSkuStockResponse>> GetStoreSkuStocksAsync(CancellationToken ct = default)
    {
        var stocks = await _skuStockRepo.GetAllAsync(ct);
        return stocks.Select(s => new StoreSkuStockResponse(
            s.SkuId,
            s.SkuCode,
            s.WeightInGrams,
            s.QuantityOnHand,
            s.WarehouseQuantityOnHand,
            s.LowStockThreshold,
            s.ShelfLowStockThreshold,
            s.UpdatedAt,
            // POS-04: tồn khả bán = OnHand - Reserved, không âm.
            s.ReservedQuantity,
            Math.Max(0, s.QuantityOnHand - s.ReservedQuantity))).ToList();
    }

    public async Task<SkuStockResponse> AdjustStoreStockAsync(
        Guid skuId, int quantityDelta, string? skuCode = null, CancellationToken ct = default)
    {
        if (!_inventoryOptions.SimulateWarehouse)
        {
            throw new InventoryValidationException(
                "Direct store stock adjustment is disabled. Use stocktake adjustment instead.");
        }

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
        if (!_inventoryOptions.SimulateWarehouse)
        {
            throw new InventoryValidationException(
                "Direct warehouse stock adjustment is disabled. Use stocktake adjustment instead.");
        }

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

    // Phase J1: hàng trả về KHÔNG tự tăng tồn bán — tạo ReturnInspection (Pending) để chờ kiểm tra.
    private async Task ReceiveCustomerReturnToShelfAsync(OrderReturnedEvent message, CancellationToken ct)
    {
        var items = message.Items
            .Where(i => i.SkuId != Guid.Empty && i.Quantity > 0)
            .GroupBy(i => i.SkuId)
            .Select(g =>
            {
                var first = g.First();
                return new
                {
                    SkuId = g.Key,
                    SkuCode = NormalizeSnapshotText(first.SkuCode),
                    SkuName = NormalizeSnapshotText(first.SkuName),
                    Quantity = g.Sum(i => i.Quantity),
                };
            })
            .OrderBy(i => i.SkuCode ?? i.SkuName ?? i.SkuId.ToString())
            .ToList();

        await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var now = DateTime.UtcNow;
            foreach (var item in items)
            {
                // Idempotent per SKU: không tạo lại nếu đã có record cho (ReturnId, SkuId).
                if (await _returnInspectionRepo.ExistsByReturnAndSkuAsync(message.ReturnId, item.SkuId, innerCt))
                    continue;

                var stock = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, innerCt);
                var skuCode = item.SkuCode ?? stock?.SkuCode ?? item.SkuId.ToString()[..8];
                var skuName = item.SkuName ?? skuCode;

                await _returnInspectionRepo.AddAsync(new ReturnInspection
                {
                    Id = Guid.NewGuid(),
                    ReturnId = message.ReturnId,
                    ReturnCode = message.ReturnCode,
                    OrderId = message.OrderId,
                    OrderCode = message.OrderCode,
                    SkuId = item.SkuId,
                    SkuCode = skuCode,
                    SkuSnapshotName = skuName,
                    Quantity = item.Quantity,
                    Disposition = ReturnInspectionDisposition.Pending,
                    CreatedAt = now,
                    UpdatedAt = now,
                }, innerCt);
            }

            await _processedEvents.AddAsync(OrderReturnedEventType, message.ReturnId, NullableEventId(message.EventId), innerCt);
            await _returnInspectionRepo.SaveChangesAsync(innerCt);
            return true;
        }, ct);
    }

    public async Task<ReturnInspectionResponse> InspectReturnAsync(
        Guid inspectionId,
        InspectReturnRequest request,
        Guid inspectorId,
        CancellationToken ct = default)
    {
        if (!Enum.TryParse<ReturnInspectionDisposition>(request.Disposition, ignoreCase: true, out var disposition)
            || disposition == ReturnInspectionDisposition.Pending)
            throw new InventoryValidationException($"Disposition không hợp lệ: '{request.Disposition}'. Dùng RestockApproved, Quarantined, hoặc Disposed.");

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var inspection = await _returnInspectionRepo.GetByIdAsync(inspectionId, innerCt)
                ?? throw new InventoryNotFoundException($"Không tìm thấy ReturnInspection '{inspectionId}'.");

            if (inspection.Disposition != ReturnInspectionDisposition.Pending)
                return MapReturnInspection(inspection); // Idempotent: đã kiểm tra rồi.

            var now = DateTime.UtcNow;
            var stock = await _skuStockRepo.GetBySkuIdAsync(inspection.SkuId, innerCt);
            var skuCode = stock?.SkuCode ?? inspection.SkuCode;
            var skuName = inspection.SkuSnapshotName;

            if (disposition == ReturnInspectionDisposition.RestockApproved)
            {
                // Tăng tồn Kệ Hàng — hàng đã qua kiểm tra, đủ điều kiện bán lại.
                var batchResp = await CreateWarehouseBatchInternalAsync(
                    BuildCustomerReturnLotCode(now, inspection.ReturnCode, inspection.SkuId),
                    supplier: null,
                    expiresAt: null,
                    note: $"Kiem tra hang tra {inspection.ReturnCode} - phuc hoi ban",
                    items: [new CreateWarehouseBatchItemRequest(inspection.SkuId, skuCode, skuName, inspection.Quantity, null)],
                    createdBy: inspectorId,
                    ct: innerCt,
                    sourceType: "return_restock",
                    sourceReferenceId: inspection.ReturnId,
                    sourceReferenceCode: inspection.ReturnCode,
                    location: LocationShelf);
                inspection.RestockBatchId = batchResp.Id;
            }
            else if (disposition == ReturnInspectionDisposition.Quarantined)
            {
                // Tạo lô kiểm dịch (Location="Quarantine") — không tính vào tồn bán.
                var qLot = $"QUA-{now:yyyyMMddHHmmss}-{inspection.SkuId.ToString("N")[..8].ToUpperInvariant()}";
                var quarantineBatch = new WarehouseBatch
                {
                    Id = Guid.NewGuid(),
                    LotCode = qLot,
                    Location = "Quarantine",
                    Status = "active",
                    SourceType = "return_quarantine",
                    SourceReferenceId = inspection.ReturnId,
                    SourceReferenceCode = inspection.ReturnCode,
                    Note = $"Kiem tra hang tra {inspection.ReturnCode} - kiem dich",
                    CreatedBy = inspectorId,
                    CreatedAt = now,
                    UpdatedAt = now,
                    Items =
                    [
                        new WarehouseBatchItem
                        {
                            Id = Guid.NewGuid(),
                            SkuId = inspection.SkuId,
                            SkuCode = skuCode,
                            ProductSnapshotName = skuName,
                            QuantityOnHand = inspection.Quantity,
                            InitialQuantity = inspection.Quantity,
                            CreatedAt = now,
                            UpdatedAt = now,
                        }
                    ],
                };
                await _batchRepo.AddAsync(quarantineBatch, innerCt);
                await _batchRepo.SaveChangesAsync(innerCt);
                inspection.QuarantineBatchId = quarantineBatch.Id;
                // Tồn SkuStock không thay đổi — "Quarantine" không phải Warehouse/Shelf.
            }
            // Disposed: không tạo batch, không thay đổi tồn.

            inspection.Disposition = disposition;
            inspection.InspectedBy = inspectorId;
            inspection.InspectedAt = now;
            inspection.InspectionNote = NormalizeSnapshotText(request.Note);
            inspection.UpdatedAt = now;

            await _returnInspectionRepo.SaveChangesAsync(innerCt);
            return MapReturnInspection(inspection);
        }, ct);
    }

    public async Task<PagedResponse<ReturnInspectionResponse>> GetReturnInspectionsPagedAsync(
        string? disposition, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        var (safePage, safeSize) = NormalizePagination(page, pageSize);
        var (items, total) = await _returnInspectionRepo.GetPagedAsync(disposition, search, safePage, safeSize, ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)safeSize));
        return new PagedResponse<ReturnInspectionResponse>(items.Select(MapReturnInspection).ToList(), safePage, safeSize, total, totalPages);
    }

    public async Task<List<ReturnInspectionResponse>> GetReturnInspectionsByReturnIdAsync(
        Guid returnId, CancellationToken ct = default)
    {
        var items = await _returnInspectionRepo.GetByReturnIdAsync(returnId, ct);
        return items.Select(MapReturnInspection).ToList();
    }

    private static ReturnInspectionResponse MapReturnInspection(ReturnInspection i) => new(
        i.Id, i.ReturnId, i.ReturnCode, i.OrderId, i.OrderCode,
        i.SkuId, i.SkuCode, i.SkuSnapshotName, i.Quantity,
        i.Disposition.ToString(), i.QuarantineBatchId, i.RestockBatchId,
        i.InspectedBy, i.InspectedAt, i.InspectionNote, i.CreatedAt, i.UpdatedAt);

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

    private async Task CheckAndNotifyShelfLowStockAsync(IEnumerable<Guid> skuIds, CancellationToken ct)
    {
        foreach (var skuId in skuIds.Distinct())
        {
            var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct);
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

    /// <summary>
    /// POS-04: giữ chỗ tồn Kệ Hàng cho đơn COD chờ xác nhận — all-or-nothing.
    /// Idempotent: chỉ giữ khi queue chưa giữ và chưa trừ tồn. Trong một transaction:
    /// gộp dòng trùng SKU, khoá các SkuStock theo thứ tự SkuId ổn định (tránh deadlock),
    /// kiểm tra Available = OnHand - Reserved cho TOÀN BỘ dòng trước, chỉ khi tất cả đủ
    /// mới tăng ReservedQuantity và đánh dấu IsReserved. Thiếu bất kỳ SKU nào (không có
    /// SkuStock, số lượng không hợp lệ, hoặc không đủ Available) → không giữ dòng nào,
    /// queue chuyển Insufficient kèm lý do. Bảo đảm Reserved không vượt OnHand.
    /// Trả về true nếu đã giữ chỗ (hoặc trước đó đã giữ), false nếu từ chối toàn bộ.
    /// </summary>
    private async Task<bool> ReserveQueueStockAsync(Guid queueId, CancellationToken ct)
    {
        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var queue = await _queueRepo.GetByIdAsync(queueId, innerCt);
            if (queue == null || queue.IsDeducted)
                return false;
            if (queue.IsReserved)
                return true; // đã giữ chỗ từ lần giao event trước — không giữ lần hai.

            var now = DateTime.UtcNow;

            // Gộp các dòng trùng SKU; số lượng <= 0 là dữ liệu không hợp lệ → fail toàn bộ.
            var requiredBySku = new Dictionary<Guid, (string Name, int Quantity)>();
            foreach (var item in queue.Items)
            {
                if (item.SkuId == Guid.Empty || item.Quantity <= 0)
                {
                    queue.QueueStatus = QueueStatus.Insufficient;
                    queue.LastShortageReason =
                        $"Không thể giữ chỗ tồn: dòng SKU '{item.SkuSnapshotName}' có số lượng không hợp lệ ({item.Quantity}).";
                    queue.LastAttemptAt = now;
                    await _queueRepo.SaveChangesAsync(innerCt);
                    return false;
                }

                requiredBySku[item.SkuId] = requiredBySku.TryGetValue(item.SkuId, out var existing)
                    ? (existing.Name, existing.Quantity + item.Quantity)
                    : (item.SkuSnapshotName, item.Quantity);
            }

            // Khoá theo thứ tự SkuId ổn định rồi kiểm tra đủ Available cho toàn bộ dòng.
            var shortages = new List<StockShortage>();
            var stockBySkuId = new Dictionary<Guid, SkuStock>();
            foreach (var (skuId, required) in requiredBySku.OrderBy(kv => kv.Key))
            {
                var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(skuId, innerCt);
                var available = Math.Max(0, (stock?.QuantityOnHand ?? 0) - (stock?.ReservedQuantity ?? 0));
                if (stock == null || available < required.Quantity)
                {
                    shortages.Add(new StockShortage(
                        skuId, required.Name, required.Quantity, available,
                        required.Quantity - available));
                }
                else
                {
                    stockBySkuId[skuId] = stock;
                }
            }

            if (shortages.Count > 0)
            {
                // Không partial reserve: từ chối toàn bộ, ghi lý do để xử lý thủ công.
                queue.QueueStatus = QueueStatus.Insufficient;
                queue.LastShortageReason = "Không đủ tồn khả bán để giữ chỗ COD: " + BuildShortageReason(shortages);
                queue.LastAttemptAt = now;
                await _queueRepo.SaveChangesAsync(innerCt);
                return false;
            }

            // Tất cả dòng hợp lệ → tăng Reserved; Available >= qty nên Reserved không vượt OnHand.
            foreach (var (skuId, required) in requiredBySku.OrderBy(kv => kv.Key))
            {
                var stock = stockBySkuId[skuId];
                stock.ReservedQuantity += required.Quantity;
                stock.UpdatedAt = now;
            }

            queue.IsReserved = true;
            queue.LastShortageReason = null;

            // POS-04 (truy vết giữ chỗ): đóng dấu trạng thái ở cấp dòng SKU. Tổng ReservedQuantity
            // của các dòng Active theo SKU khớp đúng phần vừa cộng vào SkuStock.ReservedQuantity.
            StampItemsReserved(queue, now);

            await _queueRepo.SaveChangesAsync(innerCt);
            return true;
        }, ct);
    }

    /// <summary>
    /// POS-04: nhả giữ chỗ tồn Kệ Hàng khi đơn bị hủy trước khi trừ tồn. Idempotent — chỉ nhả khi
    /// queue đang giữ. ReservedQuantity không bao giờ âm. Không tự SaveChanges: caller lưu chung
    /// với các thay đổi trạng thái queue khác.
    /// </summary>
    private async Task ReleaseQueueReservationAsync(StockDeductQueue queue, CancellationToken ct)
    {
        if (!queue.IsReserved) return;

        var now = DateTime.UtcNow;
        // Gộp dòng trùng SKU rồi khoá theo thứ tự ổn định — nhả đúng một lần cho mỗi SKU.
        var releaseBySku = new Dictionary<Guid, int>();
        foreach (var item in queue.Items)
        {
            if (item.SkuId == Guid.Empty || item.Quantity <= 0) continue;
            releaseBySku[item.SkuId] = releaseBySku.GetValueOrDefault(item.SkuId) + item.Quantity;
        }

        foreach (var (skuId, quantity) in releaseBySku.OrderBy(kv => kv.Key))
        {
            var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(skuId, ct);
            if (stock == null) continue;
            stock.ReservedQuantity = Math.Max(0, stock.ReservedQuantity - quantity);
            stock.UpdatedAt = now;
        }

        // Clear IsReserved trong cùng đơn vị lưu của caller → gọi lặp lại an toàn (no-op).
        queue.IsReserved = false;

        // POS-04 (truy vết giữ chỗ): dòng rời khỏi tổng đang giữ nhưng vẫn còn để truy vết lịch sử.
        StampItemsReleased(queue, now);
    }

    /// <summary>
    /// POS-04 (truy vết giữ chỗ): đánh dấu các dòng SKU của queue là đang giữ chỗ.
    /// </summary>
    private static void StampItemsReserved(StockDeductQueue queue, DateTime now)
    {
        foreach (var item in queue.Items)
        {
            if (item.SkuId == Guid.Empty || item.Quantity <= 0) continue;
            item.ReservationStatus = StockReservationStatus.Active;
            item.ReservedQuantity = item.Quantity;
            item.ReservedAt = now;
            item.ReleasedAt = null;
            item.DeductedAt = null;
        }
    }

    /// <summary>
    /// POS-04 (truy vết giữ chỗ): chuyển các dòng đang giữ sang Released (hủy trước khi giao).
    /// Chỉ dòng Active bị đổi → gọi lặp lại là no-op, không ghi đè mốc thời gian cũ.
    /// </summary>
    private static void StampItemsReleased(StockDeductQueue queue, DateTime now)
    {
        foreach (var item in queue.Items)
        {
            if (item.ReservationStatus != StockReservationStatus.Active) continue;
            item.ReservationStatus = StockReservationStatus.Released;
            item.ReleasedAt = now;
        }
    }

    /// <summary>
    /// POS-04 (truy vết giữ chỗ): chuyển các dòng đang giữ sang Deducted (đã chuyển thành xuất kho).
    /// Chỉ dòng Active bị đổi → redelivery không tạo mốc thời gian mới.
    /// </summary>
    private static void StampItemsDeducted(StockDeductQueue queue, DateTime now)
    {
        foreach (var item in queue.Items)
        {
            if (item.ReservationStatus != StockReservationStatus.Active) continue;
            item.ReservationStatus = StockReservationStatus.Deducted;
            item.DeductedAt = now;
        }
    }

    /// <summary>
    /// POS-04 (H4): thay giữ chỗ tồn Kệ Hàng khi sửa đơn COD chờ xác nhận — release + re-reserve
    /// nguyên tử trong MỘT transaction, all-or-nothing:
    /// - reconcile TUYỆT ĐỐI queue items + ReservedQuantity theo danh sách mới (không cộng dồn)
    ///   → gọi lặp với cùng danh sách là no-op về số lượng;
    /// - tăng giữ chỗ chỉ khi đủ Available (giữ chỗ hiện tại của chính queue được tính là khả dụng);
    /// - thiếu bất kỳ SKU nào → ném InsufficientStockException, KHÔNG thay đổi gì
    ///   (giữ nguyên items + giữ chỗ cũ);
    /// - OperationId là idempotency key một lần sửa đơn: đã xử lý → trả AlreadyProcessed, không đổi tồn.
    /// Queue đã trừ tồn (IsDeducted/Confirmed) hoặc đã hủy → từ chối (đơn không còn sửa giữ chỗ được).
    /// </summary>
    public async Task<ReplaceCodReservationResponse> ReplaceCodReservationAsync(
        ReplaceCodReservationRequest request,
        CancellationToken ct = default)
    {
        if (request.OrderId == Guid.Empty)
            throw new InventoryValidationException("OrderId là bắt buộc khi thay giữ chỗ COD.");
        if (request.OperationId == Guid.Empty)
            throw new InventoryValidationException("OperationId là bắt buộc khi thay giữ chỗ COD.");
        if (request.Items == null || request.Items.Count == 0)
            throw new InventoryValidationException("Danh sách SKU mới phải có ít nhất một dòng.");

        // Gộp dòng trùng SKU; số lượng <= 0 hoặc SkuId rỗng là dữ liệu không hợp lệ.
        var requiredBySku = new Dictionary<Guid, (string Name, string? Code, int Quantity)>();
        foreach (var item in request.Items)
        {
            if (item.SkuId == Guid.Empty || item.Quantity <= 0)
                throw new InventoryValidationException(
                    $"Dòng SKU '{item.SkuSnapshotName ?? item.SkuId.ToString()}' có số lượng không hợp lệ ({item.Quantity}).");

            requiredBySku[item.SkuId] = requiredBySku.TryGetValue(item.SkuId, out var existing)
                ? (existing.Name, existing.Code, existing.Quantity + item.Quantity)
                : (item.SkuSnapshotName ?? item.SkuSnapshotCode ?? item.SkuId.ToString(),
                   item.SkuSnapshotCode,
                   item.Quantity);
        }

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            // Idempotency theo OperationId: cùng một lần sửa đơn gọi lại (retry/redelivery) → no-op.
            if (await _processedEvents.ExistsAsync(CodReservationReplacedEventType, request.OperationId, innerCt))
            {
                var processedQueue = await _queueRepo.GetByOrderIdAsync(request.OrderId, innerCt);
                return new ReplaceCodReservationResponse(
                    processedQueue?.Id ?? Guid.Empty, request.OrderId,
                    processedQueue?.OrderCode ?? string.Empty,
                    Replaced: false, AlreadyProcessed: true,
                    "OperationId đã được xử lý trước đó — không thay đổi giữ chỗ.");
            }

            var queue = await _queueRepo.GetByOrderIdAsync(request.OrderId, innerCt)
                ?? throw new InventoryNotFoundException(
                    $"Không tìm thấy queue tồn kho cho đơn '{request.OrderId}'. Event tạo đơn có thể chưa được xử lý — thử lại sau.");

            if (queue.IsDeducted || queue.QueueStatus == QueueStatus.Confirmed)
                throw new InventoryValidationException(
                    "Đơn đã trừ tồn vật lý — không thể thay giữ chỗ. Dùng luồng trả hàng nếu cần điều chỉnh.");
            if (queue.QueueStatus == QueueStatus.Cancelled)
                throw new InventoryValidationException("Queue tồn kho của đơn đã hủy — không thể thay giữ chỗ.");

            var now = DateTime.UtcNow;

            // Giữ chỗ hiện tại của chính queue (0 nếu chưa từng giữ / giữ thất bại trước đó).
            var currentBySku = new Dictionary<Guid, int>();
            if (queue.IsReserved)
            {
                foreach (var item in queue.Items)
                {
                    if (item.SkuId == Guid.Empty || item.Quantity <= 0) continue;
                    currentBySku[item.SkuId] = currentBySku.GetValueOrDefault(item.SkuId) + item.Quantity;
                }
            }

            // Khoá toàn bộ SKU liên quan (cũ + mới) theo thứ tự ổn định, kiểm tra đủ Available
            // cho MỌI phần tăng trước khi thay đổi bất kỳ dòng nào (all-or-nothing).
            var involvedSkuIds = requiredBySku.Keys.Union(currentBySku.Keys).OrderBy(id => id).ToList();
            var stockBySkuId = new Dictionary<Guid, SkuStock>();
            var shortages = new List<StockShortage>();
            foreach (var skuId in involvedSkuIds)
            {
                var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(skuId, innerCt);
                var newQty = requiredBySku.TryGetValue(skuId, out var required) ? required.Quantity : 0;
                var currentQty = currentBySku.GetValueOrDefault(skuId);
                var delta = newQty - currentQty;

                if (delta > 0)
                {
                    // Phần giữ chỗ hiện tại của chính queue tính là khả dụng → chỉ cần đủ cho delta.
                    var available = Math.Max(0, (stock?.QuantityOnHand ?? 0) - (stock?.ReservedQuantity ?? 0));
                    if (stock == null || available < delta)
                    {
                        var name = requiredBySku.TryGetValue(skuId, out var r) ? r.Name : skuId.ToString();
                        shortages.Add(new StockShortage(skuId, name, delta, available, delta - available));
                        continue;
                    }
                }

                if (stock != null)
                    stockBySkuId[skuId] = stock;
            }

            if (shortages.Count > 0)
            {
                // Không thay đổi gì: giữ nguyên items + giữ chỗ cũ để đơn cũ vẫn hợp lệ.
                throw new InsufficientStockException(
                    "Không đủ tồn khả bán để thay giữ chỗ COD: " + BuildShortageReason(shortages),
                    shortages);
            }

            // Tất cả đủ → reconcile ReservedQuantity theo delta từng SKU (âm thì nhả, không bao giờ < 0).
            foreach (var skuId in involvedSkuIds)
            {
                if (!stockBySkuId.TryGetValue(skuId, out var stock)) continue;
                var newQty = requiredBySku.TryGetValue(skuId, out var required) ? required.Quantity : 0;
                var delta = newQty - currentBySku.GetValueOrDefault(skuId);
                if (delta == 0) continue;
                stock.ReservedQuantity = Math.Max(0, stock.ReservedQuantity + delta);
                stock.UpdatedAt = now;
            }

            // Reconcile items tại chỗ theo VỊ TRÍ (không theo SkuId): tái dùng từng dòng đã tracked,
            // ghi đè toàn bộ field (kể cả SkuId). Chỉ thêm dòng khi cần nhiều hơn, chỉ xóa dòng dư.
            // KHÔNG dùng Items.Clear() + re-add: dòng mới với Id (Guid) đã set khiến EF coi là
            // UPDATE một hàng không tồn tại (affected 0) → DbUpdateConcurrencyException dưới MySQL;
            // tối thiểu hóa DELETE/INSERT cũng tránh vấn đề orphan-cascade giữa các provider.
            var reusablePool = new Queue<StockDeductQueueItem>(queue.Items);
            var keptItems = new HashSet<StockDeductQueueItem>();

            foreach (var (skuId, required) in requiredBySku.OrderBy(kv => kv.Key))
            {
                StockDeductQueueItem target;
                if (reusablePool.Count > 0)
                {
                    target = reusablePool.Dequeue(); // tái dùng dòng đã tracked → EF phát UPDATE hợp lệ
                    target.SkuId = skuId;
                    target.SkuSnapshotName = required.Name;
                    target.SkuSnapshotCode = required.Code;
                    target.Quantity = required.Quantity;
                }
                else
                {
                    target = new StockDeductQueueItem
                    {
                        Id = Guid.NewGuid(),
                        QueueId = queue.Id,
                        SkuId = skuId,
                        SkuSnapshotName = required.Name,
                        SkuSnapshotCode = required.Code,
                        Quantity = required.Quantity
                    };
                    queue.Items.Add(target);
                }
                keptItems.Add(target);
            }

            // Xóa các dòng dư không được tái dùng → EF cascade DELETE.
            foreach (var item in queue.Items.ToList())
            {
                if (!keptItems.Contains(item))
                    queue.Items.Remove(item);
            }

            queue.TotalAmount = request.TotalAmount;
            queue.IsReserved = true;
            // Giữ chỗ trước đó thất bại (Insufficient) nhưng lần thay này đủ → quay lại Waiting.
            queue.QueueStatus = QueueStatus.Waiting;
            queue.LastShortageReason = null;
            queue.LastAttemptAt = now;

            // POS-04 (truy vết giữ chỗ): dòng tái dùng đã bị ghi đè SkuId/Quantity → đóng dấu lại
            // toàn bộ theo danh sách mới để tổng Active theo SKU khớp ReservedQuantity vừa reconcile.
            StampItemsReserved(queue, now);

            // Inbox + mutation nguyên tử: ghi OperationId trong cùng transaction với thay đổi tồn.
            await _processedEvents.AddAsync(
                CodReservationReplacedEventType, request.OperationId, request.OperationId, innerCt);
            await _queueRepo.SaveChangesAsync(innerCt);

            return new ReplaceCodReservationResponse(
                queue.Id, queue.OrderId, queue.OrderCode,
                Replaced: true, AlreadyProcessed: false,
                "Đã thay giữ chỗ tồn Kệ Hàng theo danh sách SKU mới.");
        }, ct);
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
            var displaySku = decision.SkuCode ?? decision.SkuName ?? decision.SkuId.ToString()[..8];

            if (finishedVariant == null)
            {
                throw new InventoryValidationException(
                    $"Không tìm thấy SKU {displaySku} trong dữ liệu sản phẩm để kiểm tra bán trước, trừ sau.");
            }

            if (finishedVariant.BomLineCount <= 0 || finishedVariant.BomLines.Count == 0)
            {
                throw new InventoryValidationException(
                    $"Sản phẩm {displaySku} không có BOM nên không thể bán trước, trừ sau.");
            }

            foreach (var bomLine in finishedVariant.BomLines)
            {
                if (bomLine.IsRequiredBaseComponent || bomLine.Quantity <= 0)
                    throw new InventoryValidationException($"Operational BOM của SKU {displaySku} không hợp lệ.");
                var required = CeilRequiredQuantity(bomLine.Quantity * decision.PendingBomQuantity);
                CatalogProduct? materialProduct;
                List<CatalogVariant> candidateVariants;
                if (bomLine.ComponentVariantId.HasValue)
                {
                    materialProduct = catalog.FindProductByVariant(bomLine.ComponentVariantId.Value);
                    var componentVariant = materialProduct?.Variants
                        .FirstOrDefault(v => v.Id == bomLine.ComponentVariantId.Value && v.IsActive);
                    if (materialProduct == null || componentVariant == null)
                    {
                        throw new InventoryValidationException(
                            $"Không tìm thấy component SKU {bomLine.ComponentSkuCode ?? bomLine.ComponentVariantId.Value.ToString()} của BOM sản phẩm {displaySku}.");
                    }

                    if (!componentVariant.CanBeBomComponent
                        || !string.Equals(materialProduct.ProductType, "NGUYEN_LIEU", StringComparison.OrdinalIgnoreCase)
                           && !string.Equals(materialProduct.ProductType, "BAO_BI", StringComparison.OrdinalIgnoreCase)
                           && !string.Equals(materialProduct.ProductType, "THANH_PHAM", StringComparison.OrdinalIgnoreCase))
                        throw new InventoryValidationException($"Operational BOM của SKU {displaySku} có component không hợp lệ.");

                    candidateVariants = [componentVariant];
                }
                else
                {
                    materialProduct = catalog.FindProduct(bomLine.MaterialId);
                    if (materialProduct == null)
                    {
                        var componentDisplay = bomLine.ComponentSkuCode
                            ?? bomLine.MaterialName
                            ?? bomLine.MaterialId.ToString();
                        throw new InventoryValidationException(
                            $"Không tìm thấy component SKU {componentDisplay} của BOM sản phẩm {displaySku}.");
                    }

                    candidateVariants = materialProduct.Variants
                        .Where(v => v.IsActive && v.CanBeBomComponent)
                        .OrderBy(v => v.SkuCode)
                        .ThenBy(v => v.VariantName)
                        .ToList();
                }

                if (candidateVariants.Count == 0)
                {
                    var componentDisplay = bomLine.ComponentSkuCode
                        ?? bomLine.MaterialName
                        ?? bomLine.MaterialId.ToString();
                    throw new InventoryValidationException(
                        $"Không tìm thấy component SKU {componentDisplay} của BOM sản phẩm {displaySku}.");
                }

                foreach (var variant in candidateVariants)
                    await EnsureMaterialAvailabilityAsync(variant);

                var effectiveAvailable = candidateVariants.Sum(v => effectiveAvailableBySku.GetValueOrDefault(v.Id));
                if (effectiveAvailable < required)
                {
                    var componentSkuCode = candidateVariants.Count == 1
                        ? candidateVariants[0].SkuCode
                        : bomLine.ComponentSkuCode ?? bomLine.MaterialName;
                    shortages.Add(new StockShortage(
                        materialProduct.Id,
                        ResolveBomMaterialDisplayName(bomLine, materialProduct),
                        required,
                        effectiveAvailable,
                        required - effectiveAvailable,
                        displaySku,
                        componentSkuCode));
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
                        materialProduct.Id,
                        variant.Id,
                        variant.SkuCode,
                        ResolveBomMaterialDisplayName(bomLine, materialProduct),
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

    private static void ValidatePendingPosCatalog(
        List<PosStockDecision> decisions,
        ProductCatalogSnapshot catalog)
    {
        foreach (var decision in decisions.Where(d => d.PendingBomQuantity > 0))
        {
            var displaySku = decision.SkuCode ?? decision.SkuName ?? decision.SkuId.ToString()[..8];
            var product = catalog.FindProductByVariant(decision.SkuId);
            var variant = product?.Variants.FirstOrDefault(v => v.Id == decision.SkuId);

            if (product == null || variant == null)
                throw new InventoryValidationException($"Không tìm thấy SKU {displaySku} trong dữ liệu sản phẩm để kiểm tra bán trước, trừ sau.");
            if (!product.IsActive || !variant.IsActive)
                throw new InventoryValidationException($"SKU {displaySku} không còn hoạt động.");
            if (!variant.IsSellable)
                throw new InventoryValidationException($"SKU {displaySku} chưa được cấu hình cho phép bán tại POS.");
            if (!string.Equals(product.ProductType, "THANH_PHAM", StringComparison.OrdinalIgnoreCase))
                throw new InventoryValidationException($"SKU {displaySku} không được phép bán tại POS.");
            if (!variant.CanHaveBom)
                throw new InventoryValidationException($"SKU {displaySku} không có operational BOM hợp lệ để xử lý phần tồn thiếu.");
        }
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
        Guid orderId,
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
        var allAllocations = new List<StockExportBatchAllocation>();
        var ledgerEntries = new List<InventoryLedgerEntry>();
        var transactionGroupId = Guid.NewGuid();

        foreach (var decision in immediateDecisions)
        {
            var stock = decision.Stock
                ?? throw new InventoryValidationException($"Không tìm thấy tồn quầy cho SKU {decision.SkuCode ?? decision.SkuId.ToString()}.");

            var warehouseBefore = stock.WarehouseQuantityOnHand;
            var storeBefore = _inventoryOptions.SimulateWarehouse
                ? stock.QuantityOnHand
                : await _batchRepo.SumQuantityOnHandAsync(decision.SkuId, LocationShelf, ct);
            if (storeBefore < decision.FinishedDeductedQuantity)
                throw new InventoryValidationException("Tồn quầy POS đã thay đổi, vui lòng thử checkout lại.");

            List<StockExportBatchAllocation> allocations = [];
            if (_inventoryOptions.SimulateWarehouse)
            {
                stock.QuantityOnHand = storeBefore - decision.FinishedDeductedQuantity;
            }
            else
            {
                allocations = await AllocateAndDeductBatchesFifoAsync(
                    decision.SkuId,
                    decision.FinishedDeductedQuantity,
                    ct,
                    LocationShelf);
                stock.QuantityOnHand = await _batchRepo.SumQuantityOnHandAsync(decision.SkuId, LocationShelf, ct);
            }
            stock.UpdatedAt = now;

            var slipLine = new StockExportSlipLine
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
            };

            foreach (var allocation in allocations)
            {
                allocation.StockExportSlipId = slipId;
                allocation.StockExportSlipLineId = slipLine.Id;
            }

            slipLines.Add(slipLine);
            allAllocations.AddRange(allocations);
            ledgerEntries.Add(CreateLedgerEntry(
                transactionGroupId,
                decision.SkuId,
                decision.SkuCode ?? decision.SkuId.ToString()[..8],
                decision.SkuName,
                LocationShelf,
                storeBefore,
                -decision.FinishedDeductedQuantity,
                stock.QuantityOnHand,
                TransactionPosSale,
                LocationShelf,
                null,
                ReferenceOrder,
                orderId,
                orderCode,
                allocations.Count == 1 ? allocations[0].WarehouseBatchId : null,
                allocations.Count == 1 ? allocations[0].LotCode : null,
                createdBy,
                creator,
                $"Ban POS {orderCode}",
                slipLine.Note));
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
            ReferenceType = ReferenceOrder,
            ReferenceId = orderId,
            ReferenceCode = orderCode,
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
        if (allAllocations.Count > 0)
            await _exportAllocationRepo.AddRangeAsync(allAllocations, ct);
        if (ledgerEntries.Count > 0)
            await _ledgerRepo.AddRangeAsync(ledgerEntries, ct);
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
            // POS-04: preview phải khớp ConfirmQueueAsync — phần giữ chỗ của chính queue này
            // được tính là khả dụng; chỉ phần giữ chỗ của đơn khác mới chặn.
            var otherReserved = stock == null
                ? 0
                : queue.IsReserved
                    ? Math.Max(0, stock.ReservedQuantity - item.Quantity)
                    : stock.ReservedQuantity;
            var available = Math.Max(0, (stock?.QuantityOnHand ?? 0) - otherReserved);
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
        BuildQueueLineResponses(q),
        q.IsReserved);

    /// <summary>
    /// POS-04 (truy vết giữ chỗ, chiều đơn → SKU): toàn bộ dòng giữ chỗ của một đơn, kể cả dòng
    /// đã Released/Deducted để giữ được lịch sử. Đơn chưa có queue → trả danh sách rỗng.
    /// </summary>
    public async Task<OrderCodReservationResponse> GetOrderCodReservationsAsync(
        Guid orderId,
        CancellationToken ct = default)
    {
        if (orderId == Guid.Empty)
            throw new InventoryValidationException("OrderId là bắt buộc.");

        var queue = await _queueRepo.GetByOrderIdAsync(orderId, ct);
        if (queue == null)
        {
            return new OrderCodReservationResponse(
                orderId, null, string.Empty, string.Empty, string.Empty,
                HasActiveReservation: false, TotalActiveReservedQuantity: 0,
                Lines: []);
        }

        var lines = queue.Items
            .Where(i => i.ReservationStatus != StockReservationStatus.None)
            .OrderBy(i => i.SkuSnapshotCode ?? i.SkuSnapshotName)
            .Select(i => new CodStockReservationLineResponse(
                i.SkuId,
                i.SkuSnapshotCode,
                i.SkuSnapshotName,
                i.Quantity,
                i.ReservedQuantity,
                i.ReservationStatus.ToString(),
                i.ReservedAt,
                i.ReleasedAt,
                i.DeductedAt))
            .ToList();

        var activeQuantity = lines
            .Where(l => l.ReservationStatus == nameof(StockReservationStatus.Active))
            .Sum(l => l.ReservedQuantity);

        return new OrderCodReservationResponse(
            queue.OrderId,
            queue.Id,
            queue.OrderCode,
            queue.QueueStatus.ToString().ToLowerInvariant(),
            queue.OrderStockStatus,
            activeQuantity > 0,
            activeQuantity,
            lines);
    }

    /// <summary>
    /// POS-04 (truy vết giữ chỗ, chiều SKU → đơn): các đơn đang giữ chỗ SKU này. Tổng số lượng
    /// giữ chỗ Active phải khớp <c>SkuStock.ReservedQuantity</c> — trả kèm cả hai để đối chiếu.
    /// </summary>
    public async Task<SkuCodReservationSummaryResponse> GetSkuCodReservationsAsync(
        Guid skuId,
        CancellationToken ct = default)
    {
        if (skuId == Guid.Empty)
            throw new InventoryValidationException("SkuId là bắt buộc.");

        var queues = await _queueRepo.GetQueuesWithActiveReservationBySkuAsync(skuId, ct);

        var orders = new List<SkuCodReservationOrderResponse>();
        var totalActive = 0;
        foreach (var queue in queues)
        {
            var activeLines = queue.Items
                .Where(i => i.SkuId == skuId && i.ReservationStatus == StockReservationStatus.Active)
                .ToList();
            if (activeLines.Count == 0) continue;

            var quantity = activeLines.Sum(i => i.ReservedQuantity);
            totalActive += quantity;

            orders.Add(new SkuCodReservationOrderResponse(
                queue.OrderId,
                queue.OrderCode,
                queue.CustomerSnapshotName,
                quantity,
                activeLines.Min(i => i.ReservedAt),
                queue.OrderPaymentStatus,
                queue.QueueStatus.ToString().ToLowerInvariant(),
                nameof(StockReservationStatus.Active)));
        }

        var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct);

        return new SkuCodReservationSummaryResponse(
            skuId,
            totalActive,
            stock?.ReservedQuantity ?? 0,
            orders);
    }

    /// <summary>
    /// POS-04 (truy vết giữ chỗ): danh sách đơn đang giữ chỗ tồn Kệ Hàng — nguồn cho badge
    /// "Đang giữ hàng" và filter "Có hàng đang giữ" trên danh sách đơn.
    /// </summary>
    public async Task<PagedResponse<ActiveCodReservationOrderResponse>> GetOrdersWithActiveReservationAsync(
        string? search,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var safePage = page < 1 ? 1 : page;
        var safePageSize = pageSize is < 1 or > 200 ? 20 : pageSize;

        var (queues, totalCount) = await _queueRepo.GetQueuesWithActiveReservationPagedAsync(
            search, safePage, safePageSize, ct);

        var items = queues.Select(queue =>
        {
            var activeLines = queue.Items
                .Where(i => i.ReservationStatus == StockReservationStatus.Active)
                .ToList();

            return new ActiveCodReservationOrderResponse(
                queue.OrderId,
                queue.OrderCode,
                queue.CustomerSnapshotName,
                queue.QueueStatus.ToString().ToLowerInvariant(),
                queue.OrderPaymentStatus,
                activeLines.Sum(i => i.ReservedQuantity),
                activeLines.Count,
                activeLines.Count == 0 ? null : activeLines.Min(i => i.ReservedAt));
        }).ToList();

        var totalPages = safePageSize == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)safePageSize);
        return new PagedResponse<ActiveCodReservationOrderResponse>(
            items, safePage, safePageSize, totalCount, totalPages);
    }

    /// <summary>
    /// POS-04 (truy vết giữ chỗ): OrderId của các đơn đang giữ chỗ, giới hạn theo tập truyền vào.
    /// Dùng để OrderService gắn badge cho một trang danh sách đơn mà không truy vấn chéo database.
    /// </summary>
    public async Task<List<Guid>> GetOrderIdsWithActiveReservationAsync(
        IReadOnlyCollection<Guid>? orderIds,
        CancellationToken ct = default) =>
        await _queueRepo.GetOrderIdsWithActiveReservationAsync(orderIds, ct);

    public async Task<StockAdjustmentRequestResponse> CreateStockAdjustmentRequestAsync(
        CreateStockAdjustmentRequest request,
        Guid requestedBy,
        CancellationToken ct = default,
        CreatorSnapshot? creator = null)
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
            RequestedByName = creator?.CreatedByName,
            RequestedByRoleName = creator?.CreatedByRoleName,
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
                ApprovedQuantity = 0,
                FulfilledQuantity = 0,
                RejectedQuantity = 0,
                Status = StockAdjustmentRequestItemStatus.Pending,
            });
        }

        await ValidateShelfReplenishmentCatalogAsync(entity.Items, ct);

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
        var draftReserved = await _adjustmentRequestRepo.GetDraftReservedQuantitiesAsync(
            items.Select(r => r.Id),
            ct);
        return items.Select(item => MapAdjustmentRequest(item, draftReserved)).ToList();
    }

    public async Task<PagedResponse<StockAdjustmentRequestResponse>> GetStockAdjustmentRequestsPagedAsync(
        string? status,
        Guid? requestedBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default,
        string? creatorRole = null,
        DateTime? fromDateUtc = null,
        DateTime? toDateUtc = null,
        bool onlyRemaining = false,
        string? sort = null)
    {
        var (parsedStatus, excludePending) = ParseAdjustmentStatus(status);
        var (safePage, safePageSize) = NormalizePagination(page, pageSize);
        if (fromDateUtc.HasValue && toDateUtc.HasValue && toDateUtc.Value <= fromDateUtc.Value)
            throw new InventoryValidationException("Khoảng thời gian không hợp lệ: ngày kết thúc phải sau ngày bắt đầu.");

        var (items, totalCount) = await _adjustmentRequestRepo.GetPagedAsync(
            parsedStatus,
            excludePending,
            requestedBy,
            search,
            safePage,
            safePageSize,
            ct,
            creatorRole,
            fromDateUtc,
            toDateUtc,
            onlyRemaining,
            sort);
        var draftReserved = await _adjustmentRequestRepo.GetDraftReservedQuantitiesAsync(
            items.Select(r => r.Id),
            ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)safePageSize));
        return new PagedResponse<StockAdjustmentRequestResponse>(
            items.Select(item => MapAdjustmentRequest(item, draftReserved)).ToList(),
            safePage,
            safePageSize,
            totalCount,
            totalPages);
    }

    /// <summary>Tùy chọn bộ lọc cho màn hình audit: danh sách người tạo và vai trò người tạo đã có dữ liệu.</summary>
    public async Task<StockAdjustmentRequestFilterOptionsResponse> GetStockAdjustmentRequestFilterOptionsAsync(
        CancellationToken ct = default)
    {
        var creators = await _adjustmentRequestRepo.GetCreatorsAsync(ct);
        var roles = await _adjustmentRequestRepo.GetCreatorRolesAsync(ct);
        return new StockAdjustmentRequestFilterOptionsResponse(
            creators
                .Select(c => new StockAdjustmentRequestCreatorOption(c.Id, c.Name, c.RoleName))
                .ToList(),
            roles);
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
        if (entity == null) return null;
        var draftReserved = await _adjustmentRequestRepo.GetDraftReservedQuantitiesAsync([entity.Id], ct);
        return MapAdjustmentRequest(entity, draftReserved);
    }

    /// <summary>
    /// Warehouse duyệt Yêu cầu bổ sung Kệ Hàng theo từng dòng. Duyệt KHÔNG làm thay đổi tồn kho;
    /// tồn chỉ thay đổi khi Phiếu điều chuyển Kho → Kệ được hoàn tất.
    /// </summary>
    public async Task<StockAdjustmentRequestResponse> ReviewStockAdjustmentRequestAsync(
        Guid id,
        Guid reviewedBy,
        ReviewStockAdjustmentRequestLines? request,
        CancellationToken ct = default,
        CreatorSnapshot? reviewer = null)
    {
        if (reviewedBy == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người duyệt yêu cầu.");

        var entity = await _adjustmentRequestRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Yêu cầu bổ sung Kệ Hàng.");

        if (entity.Status is StockAdjustmentRequestStatus.Cancelled
            or StockAdjustmentRequestStatus.Rejected
            or StockAdjustmentRequestStatus.Fulfilled
            or StockAdjustmentRequestStatus.ClosedPartial)
        {
            throw new InventoryValidationException("Yêu cầu đã kết thúc, không thể duyệt lại.");
        }

        if (entity.Items.Count == 0)
            throw new InventoryValidationException("Yêu cầu không có dòng SKU.");

        await ValidateShelfReplenishmentCatalogAsync(entity.Items, ct);

        var decisions = (request?.Lines ?? [])
            .GroupBy(l => l.ItemId)
            .ToDictionary(g => g.Key, g => g.Last());

        foreach (var unknownId in decisions.Keys.Where(k => entity.Items.All(i => i.Id != k)))
            throw new InventoryValidationException($"Dòng yêu cầu {unknownId} không thuộc yêu cầu này.");

        foreach (var line in entity.Items)
        {
            if (StockAdjustmentFulfillment.IsLineClosed(line.Status))
                continue;

            if (!decisions.TryGetValue(line.Id, out var decision))
            {
                line.ApprovedQuantity = line.RemainingQuantity;
                StockAdjustmentFulfillment.RecalculateLineStatus(line);
                continue;
            }

            line.ReviewNote = decision.Note?.Trim();

            if (!decision.Approved)
            {
                if (string.IsNullOrWhiteSpace(decision.Note))
                    throw new InventoryValidationException($"Vui lòng nhập lý do từ chối cho SKU {line.SkuCode}.");

                line.RejectedQuantity += line.RemainingQuantity;
                line.RejectionReason = decision.Note!.Trim();
                line.Status = StockAdjustmentRequestItemStatus.Rejected;
                continue;
            }

            var approved = decision.ApprovedQuantity ?? line.RemainingQuantity;
            if (approved <= 0)
                throw new InventoryValidationException($"Số lượng duyệt của SKU {line.SkuCode} phải lớn hơn 0.");
            if (approved > line.RemainingQuantity)
            {
                throw new InventoryValidationException(
                    $"Số lượng duyệt của SKU {line.SkuCode} không được vượt quá số lượng còn lại ({line.RemainingQuantity}).");
            }

            line.ApprovedQuantity = approved;
            StockAdjustmentFulfillment.RecalculateLineStatus(line);
        }

        StockAdjustmentFulfillment.RecalculateRequestStatus(entity);
        entity.ReviewedBy = reviewedBy;
        entity.ReviewedByName = reviewer?.CreatedByName ?? entity.ReviewedByName;
        entity.ReviewedByRoleName = reviewer?.CreatedByRoleName ?? entity.ReviewedByRoleName;
        entity.ReviewedAt = DateTime.UtcNow;
        entity.ReviewNote = request?.ReviewNote?.Trim() ?? entity.ReviewNote;
        await _adjustmentRequestRepo.SaveChangesAsync(ct);
        return MapAdjustmentRequest(entity);
    }

    /// <summary>Đóng phần còn lại của yêu cầu khi không thể cấp thêm; không tác động tồn kho.</summary>
    public async Task<StockAdjustmentRequestResponse> CloseStockAdjustmentRemainingAsync(
        Guid id,
        Guid actorId,
        CloseStockAdjustmentRemainingRequest? request,
        CancellationToken ct = default,
        CreatorSnapshot? actor = null)
    {
        var reason = request?.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Vui lòng nhập lý do đóng phần còn lại.");

        var entity = await _adjustmentRequestRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Yêu cầu bổ sung Kệ Hàng.");

        if (StockAdjustmentFulfillment.IsClosed(entity.Status))
            throw new InventoryValidationException("Yêu cầu đã kết thúc, không thể đóng phần còn lại.");

        var closable = entity.Items
            .Where(i => !StockAdjustmentFulfillment.IsLineClosed(i.Status) && i.RemainingQuantity > 0)
            .ToList();

        if (closable.Count == 0)
            throw new InventoryValidationException("Yêu cầu không còn số lượng nào để đóng.");

        foreach (var line in closable)
        {
            line.ClosedReason = reason;
            line.Status = StockAdjustmentRequestItemStatus.ClosedPartial;
        }

        StockAdjustmentFulfillment.RecalculateRequestStatus(entity);
        entity.ReviewedBy = actorId == Guid.Empty ? entity.ReviewedBy : actorId;
        entity.ReviewedByName = actor?.CreatedByName ?? entity.ReviewedByName;
        entity.ReviewedByRoleName = actor?.CreatedByRoleName ?? entity.ReviewedByRoleName;
        entity.ReviewedAt = DateTime.UtcNow;
        entity.ReviewNote = reason;
        await _adjustmentRequestRepo.SaveChangesAsync(ct);
        return MapAdjustmentRequest(entity);
    }

    /// <summary>Danh sách Phiếu điều chuyển đã sinh ra từ một Yêu cầu bổ sung Kệ Hàng.</summary>
    public async Task<List<StockAdjustmentRelatedTransferResponse>> GetStockAdjustmentRequestTransfersAsync(
        Guid id,
        CancellationToken ct = default)
    {
        var transfers = await _adjustmentRequestRepo.GetTransfersBySourceRequestAsync(id, ct);
        return transfers
            .Select(t => new StockAdjustmentRelatedTransferResponse(
                t.Id,
                t.TransferCode,
                t.Status.ToString().ToLowerInvariant(),
                t.CreatedAt,
                t.CompletedAt,
                t.CreatedByName,
                t.Lines.Sum(l => l.Quantity),
                t.Lines
                    .OrderBy(l => l.SkuCode)
                    .Select(l => new StockAdjustmentRelatedTransferLineResponse(
                        l.Id,
                        l.SourceRequestLineId,
                        l.SkuId,
                        l.SkuCode,
                        l.SkuNameSnapshot,
                        l.Quantity))
                    .ToList()))
            .ToList();
    }

    public async Task<StockAdjustmentReviewResponse> RejectStockAdjustmentRequestAsync(
        Guid id,
        Guid reviewedBy,
        RejectStockAdjustmentRequest request,
        CancellationToken ct = default,
        CreatorSnapshot? reviewer = null)
    {
        var entity = await _adjustmentRequestRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Yêu cầu bổ sung Kệ Hàng.");

        if (StockAdjustmentFulfillment.IsClosed(entity.Status))
            throw new InventoryValidationException("Yêu cầu đã kết thúc, không thể từ chối.");

        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Vui lòng nhập lý do từ chối.");

        foreach (var line in entity.Items.Where(i => !StockAdjustmentFulfillment.IsLineClosed(i.Status)))
        {
            line.RejectedQuantity += line.RemainingQuantity;
            line.RejectionReason = reason;
            line.Status = StockAdjustmentRequestItemStatus.Rejected;
        }

        StockAdjustmentFulfillment.RecalculateRequestStatus(entity);
        entity.ReviewedBy = reviewedBy == Guid.Empty ? null : reviewedBy;
        entity.ReviewedByName = reviewer?.CreatedByName ?? entity.ReviewedByName;
        entity.ReviewedByRoleName = reviewer?.CreatedByRoleName ?? entity.ReviewedByRoleName;
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
        CancellationToken ct = default,
        CreatorSnapshot? actor = null)
    {
        var entity = await _adjustmentRequestRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Yêu cầu bổ sung Kệ Hàng.");

        if (entity.Status is not (StockAdjustmentRequestStatus.Pending or StockAdjustmentRequestStatus.Draft))
            throw new InventoryValidationException("Chỉ có thể hủy yêu cầu đang chờ duyệt.");

        if (!isAdmin && entity.RequestedBy != requestedBy)
            throw new InventoryValidationException("Bạn không thể hủy yêu cầu của người khác.");

        var reason = request?.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Vui lòng nhập lý do hủy.");

        foreach (var line in entity.Items.Where(i => !StockAdjustmentFulfillment.IsLineClosed(i.Status)))
        {
            line.ClosedReason = reason;
            line.Status = StockAdjustmentRequestItemStatus.Cancelled;
        }

        entity.Status = StockAdjustmentRequestStatus.Cancelled;
        entity.ReviewedBy = requestedBy == Guid.Empty ? null : requestedBy;
        entity.ReviewedByName = actor?.CreatedByName ?? entity.ReviewedByName;
        entity.ReviewedByRoleName = actor?.CreatedByRoleName ?? entity.ReviewedByRoleName;
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

    public async Task<PagedResponse<InventoryLedgerEntryResponse>> GetInventoryLedgerAsync(
        string? search,
        Guid? skuId,
        string? location,
        string? transactionType,
        string? referenceCode,
        Guid? actorId,
        DateTime? fromUtc,
        DateTime? toUtc,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (safePage, safePageSize) = NormalizePagination(page, pageSize);
        var (items, totalCount) = await _ledgerRepo.GetPagedAsync(
            search,
            skuId,
            NormalizeSnapshotText(location),
            NormalizeSnapshotText(transactionType),
            NormalizeSnapshotText(referenceCode),
            actorId,
            fromUtc,
            toUtc,
            safePage,
            safePageSize,
            ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)safePageSize));
        return new PagedResponse<InventoryLedgerEntryResponse>(
            items.Select(MapLedgerEntry).ToList(),
            safePage,
            safePageSize,
            totalCount,
            totalPages);
    }

    public async Task<PagedResponse<SupplierReceiptResponse>> GetSupplierReceiptsAsync(
        string? status,
        Guid? createdBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        SupplierReceiptStatus? parsedStatus = null;
        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<SupplierReceiptStatus>(status, true, out var statusValue))
        {
            parsedStatus = statusValue;
        }

        var (safePage, safePageSize) = NormalizePagination(page, pageSize);
        var (items, totalCount) = await _supplierReceiptRepo.GetPagedAsync(
            parsedStatus,
            createdBy,
            search,
            safePage,
            safePageSize,
            ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)safePageSize));
        return new PagedResponse<SupplierReceiptResponse>(
            items.Select(MapSupplierReceipt).ToList(),
            safePage,
            safePageSize,
            totalCount,
            totalPages);
    }

    public async Task<SupplierReceiptResponse?> GetSupplierReceiptAsync(Guid id, CancellationToken ct = default)
    {
        var receipt = await _supplierReceiptRepo.GetByIdAsync(id, ct);
        return receipt == null ? null : MapSupplierReceipt(receipt);
    }

    public async Task<SupplierReceiptResponse> CreateSupplierReceiptAsync(
        UpsertSupplierReceiptRequest request,
        Guid createdBy,
        CreatorSnapshot? creator,
        CancellationToken ct = default)
    {
        if (createdBy == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người tạo phiếu nhập nhà cung cấp.");

        ValidateSupplierReceiptHeaderMetadata(request);
        await ValidateSupplierReceiptDocumentAsync(BuildSupplierReceiptCheck(request), excludeReceiptId: null, ct);

        var normalized = await NormalizeSupplierReceiptItemsAsync(request, ct);
        var now = DateTime.UtcNow;
        var countToday = await _supplierReceiptRepo.CountCreatedSinceAsync(now.Date, ct);
        var snapshot = await ResolveSupplierSnapshotAsync(request.SupplierId, request.SupplierName, ct);
        var receipt = new SupplierReceipt
        {
            Id = Guid.NewGuid(),
            ReceiptCode = $"NCC-{now:yyyyMMdd}-{(countToday + 1):D4}",
            SupplierId = request.SupplierId,
            SupplierName = snapshot.Name,
            SupplierNameSnapshot = snapshot.Name,
            SupplierCodeSnapshot = snapshot.Code,
            SupplierReference = NormalizeSnapshotText(request.SupplierReference),
            SupplierDocumentNumber = NormalizeSnapshotText(request.SupplierDocumentNumber),
            SupplierDocumentDate = request.SupplierDocumentDate,
            DeliveredByName = NormalizeSnapshotText(request.DeliveredByName),
            OriginalDocumentReference = NormalizeSnapshotText(request.OriginalDocumentReference),
            ReceivedDate = request.ReceivedDate?.Date ?? now.Date,
            Note = NormalizeSnapshotText(request.Note),
            Status = SupplierReceiptStatus.Draft,
            CreatedBy = createdBy,
            CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
            CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
            CreatedAt = now,
            UpdatedAt = now,
        };

        foreach (var item in normalized)
        {
            receipt.Items.Add(new SupplierReceiptItem
            {
                Id = Guid.NewGuid(),
                SupplierReceiptId = receipt.Id,
                SkuId = item.SkuId,
                SkuCode = item.SkuCode,
                SkuNameSnapshot = item.SkuNameSnapshot,
                ProductTypeSnapshot = item.ProductTypeSnapshot,
                InventoryUnitSnapshot = item.InventoryUnitSnapshot,
                SubmittedUnit = item.SubmittedUnit,
                SubmittedQuantity = item.SubmittedQuantity,
                DocumentQuantity = item.DocumentQuantity,
                Quantity = item.Quantity,
                UnitCost = item.UnitCost,
                LineAmount = item.LineAmount,
                LotCode = item.LotCode,
                ManufacturedAt = item.ManufacturedAt,
                ExpiresAt = item.ExpiresAt,
                ActualReceivedQuantity = item.Quantity,
                QualityNote = item.QualityNote,
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        receipt.TotalAmount = CalculateSupplierReceiptTotal(receipt.Items);
        await _supplierReceiptRepo.AddAsync(receipt, ct);
        await _supplierReceiptRepo.SaveChangesAsync(ct);
        return MapSupplierReceipt(receipt);
    }

    public async Task<SupplierReceiptResponse> UpdateSupplierReceiptAsync(
        Guid id,
        UpsertSupplierReceiptRequest request,
        Guid actorId,
        CancellationToken ct = default)
    {
        var receipt = await _supplierReceiptRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy phiếu nhập nhà cung cấp.");

        if (receipt.CreatedBy != actorId)
            throw new InventoryValidationException("Chỉ người tạo mới được sửa phiếu nhập này.");

        if (receipt.Status is not (SupplierReceiptStatus.Draft or SupplierReceiptStatus.Rejected))
            throw new InventoryValidationException("Chỉ được sửa phiếu nhập ở trạng thái Draft hoặc Rejected.");

        ValidateSupplierReceiptHeaderMetadata(request);
        await ValidateSupplierReceiptDocumentAsync(BuildSupplierReceiptCheck(request), excludeReceiptId: receipt.Id, ct);

        var normalized = await NormalizeSupplierReceiptItemsAsync(request, ct);
        var now = DateTime.UtcNow;
        var snapshot = await ResolveSupplierSnapshotAsync(request.SupplierId, request.SupplierName, ct);
        receipt.SupplierId = request.SupplierId;
        receipt.SupplierName = snapshot.Name;
        receipt.SupplierNameSnapshot = snapshot.Name;
        receipt.SupplierCodeSnapshot = snapshot.Code;
        receipt.SupplierReference = NormalizeSnapshotText(request.SupplierReference);
        receipt.SupplierDocumentNumber = NormalizeSnapshotText(request.SupplierDocumentNumber);
        receipt.SupplierDocumentDate = request.SupplierDocumentDate;
        receipt.DeliveredByName = NormalizeSnapshotText(request.DeliveredByName);
        receipt.OriginalDocumentReference = NormalizeSnapshotText(request.OriginalDocumentReference);
        receipt.ReceivedDate = request.ReceivedDate?.Date ?? now.Date;
        receipt.Note = NormalizeSnapshotText(request.Note);
        receipt.Status = SupplierReceiptStatus.Draft;
        receipt.SubmittedBy = null;
        receipt.SubmittedAt = null;
        receipt.ReviewedBy = null;
        receipt.ReviewedByName = null;
        receipt.ReviewedByRoleName = null;
        receipt.ReviewedAt = null;
        receipt.ReviewNote = null;
        receipt.UpdatedAt = now;

        // Reconcile items tại chỗ theo VỊ TRÍ: tái dùng từng dòng đã tracked, ghi đè toàn bộ field.
        // Chỉ thêm dòng khi cần nhiều hơn, chỉ xóa dòng dư.
        // KHÔNG dùng Items.Clear() + re-add: dòng mới với Id (Guid) đã set khiến EF coi là
        // UPDATE một hàng không tồn tại (affected 0) → DbUpdateConcurrencyException dưới MySQL.
        var reusablePool = new Queue<SupplierReceiptItem>(receipt.Items);
        var keptItems = new HashSet<SupplierReceiptItem>();

        foreach (var item in normalized)
        {
            SupplierReceiptItem target;
            if (reusablePool.Count > 0)
            {
                target = reusablePool.Dequeue();
            }
            else
            {
                target = new SupplierReceiptItem
                {
                    Id = Guid.NewGuid(),
                    SupplierReceiptId = receipt.Id,
                    CreatedAt = now,
                };
                receipt.Items.Add(target);
            }

            target.SkuId = item.SkuId;
            target.SkuCode = item.SkuCode;
            target.SkuNameSnapshot = item.SkuNameSnapshot;
            target.ProductTypeSnapshot = item.ProductTypeSnapshot;
            target.InventoryUnitSnapshot = item.InventoryUnitSnapshot;
            target.SubmittedUnit = item.SubmittedUnit;
            target.SubmittedQuantity = item.SubmittedQuantity;
            target.DocumentQuantity = item.DocumentQuantity;
            target.Quantity = item.Quantity;
            target.UnitCost = item.UnitCost;
            target.LineAmount = item.LineAmount;
            target.LotCode = item.LotCode;
            target.ManufacturedAt = item.ManufacturedAt;
            target.ExpiresAt = item.ExpiresAt;
            target.ActualReceivedQuantity = item.Quantity;
            target.QualityNote = item.QualityNote;
            target.WarehouseBatchId = null;
            target.WarehouseBatchLotCode = null;
            target.WarehouseQtyBefore = null;
            target.WarehouseQtyAfter = null;
            target.ShelfQtyBefore = null;
            target.ShelfQtyAfter = null;
            target.UpdatedAt = now;
            keptItems.Add(target);
        }

        foreach (var surplus in receipt.Items.Where(i => !keptItems.Contains(i)).ToList())
            receipt.Items.Remove(surplus);

        receipt.TotalAmount = CalculateSupplierReceiptTotal(keptItems);
        await _supplierReceiptRepo.SaveChangesAsync(ct);
        return MapSupplierReceipt(receipt);
    }

    public async Task<SupplierReceiptResponse> SubmitSupplierReceiptAsync(
        Guid id,
        Guid actorId,
        CancellationToken ct = default)
    {
        var receipt = await _supplierReceiptRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy phiếu nhập nhà cung cấp.");

        if (receipt.CreatedBy != actorId)
            throw new InventoryValidationException("Chỉ người tạo mới được gửi phiếu nhập này.");

        if (receipt.Status is not (SupplierReceiptStatus.Draft or SupplierReceiptStatus.Rejected))
            throw new InventoryValidationException("Chỉ được gửi phiếu nhập ở trạng thái Draft hoặc Rejected.");

        if (receipt.Items.Count == 0)
            throw new InventoryValidationException("Phiếu nhập phải có ít nhất một dòng SKU.");

        await ValidateSupplierReceiptDocumentAsync(BuildSupplierReceiptCheck(receipt), excludeReceiptId: receipt.Id, ct);
        await ValidateSupplierReceiptItemsForApprovalAsync(receipt, ct);
        receipt.Status = SupplierReceiptStatus.PendingApproval;
        receipt.SubmittedBy = actorId;
        receipt.SubmittedAt = DateTime.UtcNow;
        receipt.UpdatedAt = DateTime.UtcNow;
        await _supplierReceiptRepo.SaveChangesAsync(ct);
        return MapSupplierReceipt(receipt);
    }

    public async Task<SupplierReceiptResponse> ApproveSupplierReceiptAsync(
        Guid id,
        Guid reviewerId,
        CreatorSnapshot? reviewer,
        CancellationToken ct = default)
    {
        if (reviewerId == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người duyệt phiếu nhập.");

        var approvalContext = await _supplierReceiptRepo.GetApprovalContextAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy phiếu nhập nhà cung cấp.");
        if (approvalContext.Status == SupplierReceiptStatus.Completed)
        {
            var completed = await _supplierReceiptRepo.GetByIdAsync(id, ct)
                ?? throw new InventoryNotFoundException("Không tìm thấy phiếu nhập nhà cung cấp.");
            return MapSupplierReceipt(completed);
        }
        if (approvalContext.Status != SupplierReceiptStatus.PendingApproval)
            throw new InventoryValidationException("Chỉ được duyệt phiếu nhập đang chờ xác nhận.");
        if (approvalContext.CreatedBy == reviewerId)
            throw new InventoryValidationException("Người tạo phiếu không được tự duyệt phiếu nhập của mình.");

        // ProductService HTTP is deliberately completed before the Inventory
        // transaction. The snapshot is rechecked against every receipt line
        // inside the transaction together with lifecycle/stock/outbox changes.
        var approvalCatalog = await _productCatalogClient.GetSupplierReceiptCatalogForVariantIdsAsync(
            approvalContext.SkuIds,
            ct);

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var receipt = await _supplierReceiptRepo.GetByIdAsync(id, innerCt)
                ?? throw new InventoryNotFoundException("Không tìm thấy phiếu nhập nhà cung cấp.");

            if (receipt.Status == SupplierReceiptStatus.Completed)
                return MapSupplierReceipt(receipt);

            if (receipt.Status != SupplierReceiptStatus.PendingApproval)
                throw new InventoryValidationException("Chỉ được duyệt phiếu nhập đang chờ xác nhận.");

            if (receipt.CreatedBy == reviewerId)
                throw new InventoryValidationException("Người tạo phiếu không được tự duyệt phiếu nhập của mình.");

            await ValidateSupplierReceiptDocumentAsync(BuildSupplierReceiptCheck(receipt), excludeReceiptId: receipt.Id, innerCt);
            await ApplySupplierReceiptToWarehouseAsync(
                receipt,
                reviewerId,
                reviewer,
                approvalCatalog,
                innerCt);
            return MapSupplierReceipt(receipt);
        }, ct);
    }

    private async Task ApplySupplierReceiptToWarehouseAsync(
        SupplierReceipt receipt,
        Guid reviewerId,
        CreatorSnapshot? reviewer,
        ProductCatalogSnapshot approvalCatalog,
        CancellationToken innerCt)
    {
            await ValidateSupplierReceiptItemsForApprovalAsync(receipt, innerCt, approvalCatalog);
            foreach (var item in receipt.Items)
            {
                var internalBatchCode = BuildSupplierReceiptInternalBatchCode(item);
                if (await _batchRepo.ExistsBatchCodeAsync(internalBatchCode, ct: innerCt))
                {
                    throw new InventoryValidationException(
                        $"Mã lô nội bộ '{internalBatchCode}' đã tồn tại.");
                }
            }
            foreach (var item in receipt.Items)
                item.LineAmount = CalculateSupplierReceiptLineAmount(item.SubmittedQuantity, item.UnitCost);
            receipt.TotalAmount = CalculateSupplierReceiptTotal(receipt.Items);

            var now = DateTime.UtcNow;
            var importSlipId = Guid.NewGuid();
            var importLines = new List<StockImportSlipLine>();
            var ledgerEntries = new List<InventoryLedgerEntry>();
            var transactionGroupId = Guid.NewGuid();

            foreach (var item in receipt.Items.OrderBy(i => i.SkuCode).ThenBy(i => i.LotCode))
            {
                var stockBefore = await GetOrCreateSkuStockAsync(item.SkuId, item.SkuCode, innerCt);
                var warehouseBefore = stockBefore.WarehouseQuantityOnHand;
                var shelfBefore = stockBefore.QuantityOnHand;

                var batch = await ResolveSupplierReceiptBatchAsync(receipt, item, innerCt);

                var stockAfter = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, innerCt)
                    ?? throw new InventoryValidationException("Không đồng bộ được tồn kho sau khi nhập nhà cung cấp.");

                item.WarehouseBatchId = batch.Id;
                item.WarehouseBatchLotCode = batch.BatchCode;
                item.WarehouseQtyBefore = warehouseBefore;
                item.WarehouseQtyAfter = stockAfter.WarehouseQuantityOnHand;
                item.ShelfQtyBefore = shelfBefore;
                item.ShelfQtyAfter = stockAfter.QuantityOnHand;
                item.ActualReceivedQuantity = item.Quantity;
                item.UpdatedAt = now;

                importLines.Add(new StockImportSlipLine
                {
                    Id = Guid.NewGuid(),
                    StockImportSlipId = importSlipId,
                    SkuId = item.SkuId,
                    SkuCode = item.SkuCode,
                    ProductSnapshotName = item.SkuNameSnapshot,
                    Quantity = item.Quantity,
                    WarehouseQtyBefore = warehouseBefore,
                    WarehouseQtyAfter = stockAfter.WarehouseQuantityOnHand,
                    StoreQtyBefore = shelfBefore,
                    StoreQtyAfter = stockAfter.QuantityOnHand,
                    DestinationLocation = LocationWarehouse,
                    WarehouseBatchId = batch.Id,
                    WarehouseBatchLotCode = batch.BatchCode,
                    ProductionOrderOutputLineId = null,
                    Note = item.QualityNote,
                    CreatedAt = now,
                });

                ledgerEntries.Add(new InventoryLedgerEntry
                {
                    Id = Guid.NewGuid(),
                    TransactionGroupId = transactionGroupId,
                    OccurredAtUtc = now,
                    SkuId = item.SkuId,
                    SkuCode = item.SkuCode,
                    SkuNameSnapshot = item.SkuNameSnapshot,
                    ProductTypeSnapshot = item.ProductTypeSnapshot,
                    InventoryUnitSnapshot = item.InventoryUnitSnapshot,
                    Location = LocationWarehouse,
                    QuantityBefore = warehouseBefore,
                    QuantityDelta = item.Quantity,
                    QuantityAfter = stockAfter.WarehouseQuantityOnHand,
                    TransactionType = TransactionSupplierReceipt,
                    SourceLocation = "Supplier",
                    DestinationLocation = LocationWarehouse,
                    ReferenceType = ReferenceSupplierReceipt,
                    ReferenceId = receipt.Id,
                    ReferenceCode = receipt.ReceiptCode,
                    BatchId = batch.Id,
                    LotCode = batch.LotCode,
                    ActorId = reviewerId,
                    ActorName = NormalizeSnapshotText(reviewer?.CreatedByName),
                    ActorRole = NormalizeSnapshotText(reviewer?.CreatedByRoleName),
                    Reason = receipt.Note,
                    Note = item.QualityNote,
                    CorrelationId = receipt.Id.ToString(),
                });
            }

            var firstLine = importLines[0];
            var importCountToday = await _importSlipRepo.CountCreatedSinceAsync(now.Date, innerCt);
            var isSingleLine = importLines.Count == 1;
            var importSlip = new StockImportSlip
            {
                Id = importSlipId,
                ImportCode = $"PN-{now:yyyyMMdd}-{(importCountToday + 1):D4}",
                ImportType = "supplier_receipt",
                SkuId = isSingleLine ? firstLine.SkuId : Guid.Empty,
                SkuCode = isSingleLine ? firstLine.SkuCode : "MULTI",
                ProductSnapshotName = isSingleLine ? firstLine.ProductSnapshotName : $"{importLines.Count} dòng nhập từ nhà cung cấp",
                Quantity = importLines.Sum(l => l.Quantity),
                WarehouseQtyBefore = importLines.Sum(l => l.WarehouseQtyBefore),
                WarehouseQtyAfter = importLines.Sum(l => l.WarehouseQtyAfter),
                StoreQtyBefore = importLines.Sum(l => l.StoreQtyBefore),
                StoreQtyAfter = importLines.Sum(l => l.StoreQtyAfter),
                WarehouseBatchId = isSingleLine ? firstLine.WarehouseBatchId : null,
                WarehouseBatchLotCode = isSingleLine ? firstLine.WarehouseBatchLotCode : null,
                ProductionOrderId = null,
                ProductionCode = null,
                SupplierReceiptId = receipt.Id,
                SupplierReceiptCode = receipt.ReceiptCode,
                Note = receipt.Note,
                CreatedBy = receipt.CreatedBy,
                CreatedById = receipt.CreatedBy == Guid.Empty ? null : receipt.CreatedBy,
                CreatedByName = NormalizeSnapshotText(receipt.CreatedByName),
                CreatedByRoleName = NormalizeSnapshotText(receipt.CreatedByRoleName),
                CreatedAt = now,
                Lines = importLines,
            };

            await _importSlipRepo.AddAsync(importSlip, innerCt);
            await _importSlipRepo.SaveChangesAsync(innerCt);

            await _ledgerRepo.AddRangeAsync(ledgerEntries, innerCt);
            await _ledgerRepo.SaveChangesAsync(innerCt);

            receipt.Status = SupplierReceiptStatus.Completed;
            receipt.ReviewedBy = reviewerId;
            receipt.ReviewedByName = NormalizeSnapshotText(reviewer?.CreatedByName);
            receipt.ReviewedByRoleName = NormalizeSnapshotText(reviewer?.CreatedByRoleName);
            receipt.ReviewedAt = now;
            receipt.ReviewNote = null;
            receipt.StockImportSlipId = importSlip.Id;
            receipt.StockImportSlipCode = importSlip.ImportCode;
            receipt.TotalAmount = CalculateSupplierReceiptTotal(receipt.Items);
            receipt.UpdatedAt = now;

            var costEventLines = receipt.Items
                .GroupBy(item => item.SkuId)
                .SelectMany(group =>
                {
                    var ordered = group
                        .OrderBy(item => item.LotCode, StringComparer.OrdinalIgnoreCase)
                        .ThenBy(item => item.ManufacturedAt)
                        .ThenBy(item => item.ExpiresAt)
                        .ThenBy(item => item.Id)
                        .ToList();
                    return ordered.Select((item, index) => new
                    {
                        Item = item,
                        ReceiptLineOrder = index + 1,
                        ReceiptSkuLineCount = ordered.Count
                    });
                })
                .ToList();

            foreach (var line in costEventLines)
            {
                var item = line.Item;
                await _eventPublisher.EnqueueSupplierReceiptCostRecordedAsync(
                    new SupplierReceiptApprovedCostRecordedEvent
                    {
                        EventId = Guid.NewGuid(),
                        SupplierReceiptId = receipt.Id,
                        SupplierReceiptLineId = item.Id,
                        ReceiptCode = receipt.ReceiptCode,
                        ApprovedAt = now,
                        SkuId = item.SkuId,
                        SkuCode = item.SkuCode,
                        ActualQuantity = item.SubmittedQuantity,
                        UnitCost = item.UnitCost!.Value,
                        ReceiptLineOrder = line.ReceiptLineOrder,
                        ReceiptSkuLineCount = line.ReceiptSkuLineCount
                    },
                    innerCt);
            }

            await _supplierReceiptRepo.SaveChangesAsync(innerCt);
    }

    public async Task<SupplierReceiptResponse> RejectSupplierReceiptAsync(
        Guid id,
        Guid reviewerId,
        CreatorSnapshot? reviewer,
        ReviewSupplierReceiptRequest request,
        CancellationToken ct = default)
    {
        var receipt = await _supplierReceiptRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy phiếu nhập nhà cung cấp.");

        if (receipt.Status != SupplierReceiptStatus.PendingApproval)
            throw new InventoryValidationException("Chỉ được từ chối phiếu nhập đang chờ xác nhận.");

        if (receipt.CreatedBy == reviewerId)
            throw new InventoryValidationException("Người tạo phiếu không được tự từ chối phiếu nhập của mình.");

        var reason = NormalizeSnapshotText(request.Reason);
        if (string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Vui lòng nhập lý do từ chối.");

        receipt.Status = SupplierReceiptStatus.Rejected;
        receipt.ReviewedBy = reviewerId;
        receipt.ReviewedByName = NormalizeSnapshotText(reviewer?.CreatedByName);
        receipt.ReviewedByRoleName = NormalizeSnapshotText(reviewer?.CreatedByRoleName);
        receipt.ReviewedAt = DateTime.UtcNow;
        receipt.ReviewNote = reason;
        receipt.UpdatedAt = DateTime.UtcNow;
        await _supplierReceiptRepo.SaveChangesAsync(ct);
        return MapSupplierReceipt(receipt);
    }

    public async Task<SupplierReceiptResponse> CancelSupplierReceiptAsync(
        Guid id,
        Guid actorId,
        bool isAdmin,
        CreatorSnapshot? actor,
        ReviewSupplierReceiptRequest request,
        CancellationToken ct = default)
    {
        var receipt = await _supplierReceiptRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy phiếu nhập nhà cung cấp.");

        if (receipt.Status != SupplierReceiptStatus.Draft)
            throw new InventoryValidationException("Chỉ được hủy phiếu nhập ở trạng thái Draft.");

        if (!isAdmin && receipt.CreatedBy != actorId)
            throw new InventoryValidationException("Chỉ người tạo hoặc Admin mới được hủy phiếu nhập.");

        var reason = NormalizeSnapshotText(request.Reason);
        if (string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Vui lòng nhập lý do hủy.");

        receipt.Status = SupplierReceiptStatus.Cancelled;
        receipt.ReviewedBy = actorId == Guid.Empty ? null : actorId;
        receipt.ReviewedByName = NormalizeSnapshotText(actor?.CreatedByName);
        receipt.ReviewedByRoleName = NormalizeSnapshotText(actor?.CreatedByRoleName);
        receipt.ReviewedAt = DateTime.UtcNow;
        receipt.ReviewNote = reason;
        receipt.UpdatedAt = DateTime.UtcNow;
        await _supplierReceiptRepo.SaveChangesAsync(ct);
        return MapSupplierReceipt(receipt);
    }

    public async Task<PagedResponse<ShelfReturnRequestResponse>> GetShelfReturnRequestsAsync(
        string? status,
        Guid? createdBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var parsedStatus = ParseInventoryReturnStatus(status);
        var (safePage, safePageSize) = NormalizePagination(page, pageSize);
        var (items, totalCount) = await _shelfReturnRepo.GetPagedAsync(parsedStatus, createdBy, search, safePage, safePageSize, ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)safePageSize));
        return new PagedResponse<ShelfReturnRequestResponse>(
            items.Select(MapShelfReturnRequest).ToList(),
            safePage,
            safePageSize,
            totalCount,
            totalPages);
    }

    public async Task<ShelfReturnRequestResponse?> GetShelfReturnRequestAsync(Guid id, CancellationToken ct = default)
    {
        var request = await _shelfReturnRepo.GetByIdAsync(id, ct);
        return request == null ? null : MapShelfReturnRequest(request);
    }

    public async Task<ShelfReturnRequestResponse> CreateShelfReturnRequestAsync(
        CreateShelfReturnRequest request,
        Guid createdBy,
        CreatorSnapshot? creator,
        CancellationToken ct = default)
    {
        if (createdBy == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người tạo yêu cầu.");

        var mode = NormalizeReturnMode(request.ReturnMode);
        var reason = NormalizeSnapshotText(request.Reason);
        if (mode == "DATA_CORRECTION" && string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Điều chỉnh dữ liệu phải có lý do chi tiết.");
        if (request.Items == null || request.Items.Count == 0)
            throw new InventoryValidationException("Yêu cầu trả hàng nhập phải có ít nhất một dòng SKU.");

        var today = DateTime.UtcNow.Date;
        var countToday = await _shelfReturnRepo.CountCreatedSinceAsync(today, ct);
        var entity = new ShelfReturnRequest
        {
            Id = Guid.NewGuid(),
            ReturnCode = $"THK-{today:yyyyMMdd}-{(countToday + 1):D4}",
            ReturnMode = mode,
            OriginalStockAdjustmentRequestId = request.OriginalStockAdjustmentRequestId,
            OriginalStockAdjustmentRequestCode = NormalizeSnapshotText(request.OriginalStockAdjustmentRequestCode),
            Reason = reason,
            Note = NormalizeSnapshotText(request.Note),
            Status = InventoryReturnRequestStatus.Pending,
            CreatedBy = createdBy,
            CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
            CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        AddReturnItems(entity, request.Items, LocationShelf, ct);
        await _shelfReturnRepo.AddAsync(entity, ct);
        await _shelfReturnRepo.SaveChangesAsync(ct);
        return MapShelfReturnRequest(entity);
    }

    public async Task<ShelfReturnRequestResponse> ApproveShelfReturnRequestAsync(
        Guid id,
        Guid reviewerId,
        CreatorSnapshot? reviewer,
        CancellationToken ct = default)
    {
        if (reviewerId == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người duyệt yêu cầu.");

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var request = await _shelfReturnRepo.GetByIdAsync(id, innerCt)
                ?? throw new InventoryNotFoundException("Không tìm thấy yêu cầu trả Kệ Hàng về Kho.");
            if (request.Status == InventoryReturnRequestStatus.Completed)
                return MapShelfReturnRequest(request);
            if (request.Status != InventoryReturnRequestStatus.Pending)
                throw new InventoryValidationException("Yêu cầu đã được xử lý, không thể duyệt lại.");
            if (request.CreatedBy == reviewerId)
                throw new InventoryValidationException("Người tạo yêu cầu không được tự duyệt yêu cầu của mình.");
            if (request.Items.Count == 0)
                throw new InventoryValidationException("Yêu cầu không có dòng SKU.");

            var isCorrection = IsDataCorrectionMode(request.ReturnMode);
            await ValidateReturnAvailabilityAsync(request.Items.Select(i => (i.SkuId, i.Quantity, i.ShelfBatchId)), LocationShelf, useShelfAggregate: true, innerCt);

            var transactionGroupId = Guid.NewGuid();
            var ledgerEntries = new List<InventoryLedgerEntry>();

            foreach (var item in request.Items)
            {
                var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(item.SkuId, innerCt)
                    ?? throw new InventoryValidationException($"SKU {item.SkuCode} chưa có tồn kho.");
                var shelfBefore = stock.QuantityOnHand;
                var warehouseBefore = stock.WarehouseQuantityOnHand;

                var allocations = _inventoryOptions.SimulateWarehouse
                    ? new List<StockExportBatchAllocation>()
                    : await AllocateAndDeductBatchesAsync(item.SkuId, item.Quantity, LocationShelf, item.ShelfBatchId, innerCt);

                stock.QuantityOnHand -= item.Quantity;
                if (stock.QuantityOnHand < 0)
                    throw new InventoryValidationException($"Kệ Hàng không đủ tồn SKU {item.SkuCode}.");

                List<WarehouseBatch> warehouseBatches = [];
                if (!isCorrection)
                {
                    if (_inventoryOptions.SimulateWarehouse)
                    {
                        stock.WarehouseQuantityOnHand += item.Quantity;
                    }
                    else
                    {
                        warehouseBatches = await CreateWarehouseBatchesFromShelfAllocationsAsync(
                            request.ReturnCode,
                            request.Id,
                            "shelf_return",
                            reviewerId,
                            allocations,
                            innerCt);
                        await SyncWarehouseQtyFromBatchesAsync(stock, innerCt);
                    }
                }

                stock.UpdatedAt = DateTime.UtcNow;
                var exportSlip = await CreateReturnExportSlipAsync(
                    isCorrection ? "inbound_data_correction" : "shelf_return_export",
                    ReferenceShelfReturn,
                    request.Id,
                    request.ReturnCode,
                    item.SkuId,
                    item.SkuCode,
                    item.SkuSnapshotName,
                    item.Quantity,
                    stock.WarehouseQuantityOnHand,
                    stock.WarehouseQuantityOnHand,
                    shelfBefore,
                    stock.QuantityOnHand,
                    reviewerId,
                    reviewer,
                    request.Reason,
                    allocations,
                    innerCt);

                StockImportSlip? importSlip = null;
                var firstWarehouseBatch = warehouseBatches.FirstOrDefault();
                if (!isCorrection)
                {
                    importSlip = await CreateReturnImportSlipAsync(
                        "shelf_return_receipt",
                        ReferenceShelfReturn,
                        request.Id,
                        request.ReturnCode,
                        item.SkuId,
                        item.SkuCode,
                        item.SkuSnapshotName,
                        item.Quantity,
                        warehouseBefore,
                        stock.WarehouseQuantityOnHand,
                        stock.QuantityOnHand,
                        stock.QuantityOnHand,
                        firstWarehouseBatch,
                        reviewerId,
                        reviewer,
                        request.Reason,
                        innerCt);
                }

                item.ShelfQtyBefore = shelfBefore;
                item.ShelfQtyAfter = stock.QuantityOnHand;
                item.WarehouseQtyBefore = warehouseBefore;
                item.WarehouseQtyAfter = stock.WarehouseQuantityOnHand;
                item.StockExportSlipId = exportSlip.Id;
                item.StockExportSlipCode = exportSlip.ExportCode;
                item.StockImportSlipId = importSlip?.Id;
                item.StockImportSlipCode = importSlip?.ImportCode;
                item.WarehouseBatchId = firstWarehouseBatch?.Id;
                item.WarehouseBatchLotCode = firstWarehouseBatch?.LotCode;

                ledgerEntries.Add(CreateLedgerEntry(
                    transactionGroupId,
                    item.SkuId,
                    item.SkuCode,
                    item.SkuSnapshotName,
                    LocationShelf,
                    shelfBefore,
                    -item.Quantity,
                    stock.QuantityOnHand,
                    isCorrection ? TransactionInboundDataCorrection : TransactionShelfReturnOut,
                    LocationShelf,
                    isCorrection ? null : LocationWarehouse,
                    ReferenceShelfReturn,
                    request.Id,
                    request.ReturnCode,
                    null,
                    item.ShelfLotCode,
                    reviewerId,
                    reviewer,
                    request.Reason,
                    exportSlip.ExportCode));

                if (!isCorrection)
                {
                    ledgerEntries.Add(CreateLedgerEntry(
                        transactionGroupId,
                        item.SkuId,
                        item.SkuCode,
                        item.SkuSnapshotName,
                        LocationWarehouse,
                        warehouseBefore,
                        item.Quantity,
                        stock.WarehouseQuantityOnHand,
                        TransactionShelfReturnIn,
                        LocationShelf,
                        LocationWarehouse,
                        ReferenceShelfReturn,
                        request.Id,
                        request.ReturnCode,
                        firstWarehouseBatch?.Id,
                        firstWarehouseBatch?.LotCode,
                        reviewerId,
                        reviewer,
                        request.Reason,
                        importSlip?.ImportCode));
                }
            }

            request.Status = InventoryReturnRequestStatus.Completed;
            request.ReviewedBy = reviewerId;
            request.ReviewedByName = NormalizeSnapshotText(reviewer?.CreatedByName);
            request.ReviewedByRoleName = NormalizeSnapshotText(reviewer?.CreatedByRoleName);
            request.ReviewedAt = DateTime.UtcNow;
            request.UpdatedAt = DateTime.UtcNow;
            await _skuStockRepo.SaveChangesAsync(innerCt);
            await _shelfReturnRepo.SaveChangesAsync(innerCt);
            await _ledgerRepo.AddRangeAsync(ledgerEntries, innerCt);
            await _ledgerRepo.SaveChangesAsync(innerCt);
            return MapShelfReturnRequest(request);
        }, ct);
    }

    public async Task<ShelfReturnRequestResponse> RejectShelfReturnRequestAsync(Guid id, Guid reviewerId, CreatorSnapshot? reviewer, ReviewInventoryReturnRequest request, CancellationToken ct = default)
    {
        var entity = await _shelfReturnRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy yêu cầu trả Kệ Hàng về Kho.");
        ApplyReturnReviewDecision(entity, InventoryReturnRequestStatus.Rejected, reviewerId, reviewer, request.Reason, "Vui lòng nhập lý do từ chối.");
        await _shelfReturnRepo.SaveChangesAsync(ct);
        return MapShelfReturnRequest(entity);
    }

    public async Task<ShelfReturnRequestResponse> CancelShelfReturnRequestAsync(Guid id, Guid actorId, bool isAdmin, CreatorSnapshot? actor, ReviewInventoryReturnRequest request, CancellationToken ct = default)
    {
        var entity = await _shelfReturnRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy yêu cầu trả Kệ Hàng về Kho.");
        if (!isAdmin && entity.CreatedBy != actorId)
            throw new InventoryValidationException("Chỉ người tạo hoặc Admin mới được hủy yêu cầu.");
        ApplyReturnReviewDecision(entity, InventoryReturnRequestStatus.Cancelled, actorId, actor, request.Reason, "Vui lòng nhập lý do hủy.");
        await _shelfReturnRepo.SaveChangesAsync(ct);
        return MapShelfReturnRequest(entity);
    }

    public async Task<PagedResponse<SupplierReturnRequestResponse>> GetSupplierReturnRequestsAsync(
        string? status,
        Guid? createdBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var parsedStatus = ParseInventoryReturnStatus(status);
        var (safePage, safePageSize) = NormalizePagination(page, pageSize);
        var (items, totalCount) = await _supplierReturnRepo.GetPagedAsync(parsedStatus, createdBy, search, safePage, safePageSize, ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)safePageSize));
        return new PagedResponse<SupplierReturnRequestResponse>(
            items.Select(MapSupplierReturnRequest).ToList(),
            safePage,
            safePageSize,
            totalCount,
            totalPages);
    }

    public async Task<SupplierReturnRequestResponse?> GetSupplierReturnRequestAsync(Guid id, CancellationToken ct = default)
    {
        var request = await _supplierReturnRepo.GetByIdAsync(id, ct);
        return request == null ? null : MapSupplierReturnRequest(request);
    }

    public async Task<SupplierReturnRequestResponse> CreateSupplierReturnRequestAsync(
        CreateSupplierReturnRequest request,
        Guid createdBy,
        CreatorSnapshot? creator,
        CancellationToken ct = default)
    {
        if (createdBy == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người tạo yêu cầu.");

        var mode = NormalizeReturnMode(request.ReturnMode);
        var reason = NormalizeSnapshotText(request.Reason);
        if (mode == "DATA_CORRECTION" && string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Điều chỉnh dữ liệu phải có lý do chi tiết.");
        if (request.Items == null || request.Items.Count == 0)
            throw new InventoryValidationException("Yêu cầu trả nhà cung cấp phải có ít nhất một dòng SKU.");

        var today = DateTime.UtcNow.Date;
        var countToday = await _supplierReturnRepo.CountCreatedSinceAsync(today, ct);
        var entity = new SupplierReturnRequest
        {
            Id = Guid.NewGuid(),
            ReturnCode = $"THN-{today:yyyyMMdd}-{(countToday + 1):D4}",
            ReturnMode = mode,
            SupplierReceiptId = request.SupplierReceiptId,
            SupplierReceiptCode = NormalizeSnapshotText(request.SupplierReceiptCode),
            SupplierName = NormalizeSnapshotText(request.SupplierName),
            SupplierReference = NormalizeSnapshotText(request.SupplierReference),
            Reason = reason,
            Note = NormalizeSnapshotText(request.Note),
            Status = InventoryReturnRequestStatus.Pending,
            CreatedBy = createdBy,
            CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
            CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        AddReturnItems(entity, request.Items, LocationWarehouse, ct);
        await _supplierReturnRepo.AddAsync(entity, ct);
        await _supplierReturnRepo.SaveChangesAsync(ct);
        return MapSupplierReturnRequest(entity);
    }

    public async Task<SupplierReturnRequestResponse> ApproveSupplierReturnRequestAsync(
        Guid id,
        Guid reviewerId,
        CreatorSnapshot? reviewer,
        CancellationToken ct = default)
    {
        if (reviewerId == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người duyệt yêu cầu.");

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var request = await _supplierReturnRepo.GetByIdAsync(id, innerCt)
                ?? throw new InventoryNotFoundException("Không tìm thấy yêu cầu trả nhà cung cấp.");
            if (request.Status == InventoryReturnRequestStatus.Completed)
                return MapSupplierReturnRequest(request);
            if (request.Status != InventoryReturnRequestStatus.Pending)
                throw new InventoryValidationException("Yêu cầu đã được xử lý, không thể duyệt lại.");
            if (request.CreatedBy == reviewerId)
                throw new InventoryValidationException("Người tạo yêu cầu không được tự duyệt yêu cầu của mình.");
            if (request.Items.Count == 0)
                throw new InventoryValidationException("Yêu cầu không có dòng SKU.");

            await ValidateReturnAvailabilityAsync(request.Items.Select(i => (i.SkuId, i.Quantity, i.WarehouseBatchId)), LocationWarehouse, useShelfAggregate: false, innerCt);
            var isCorrection = IsDataCorrectionMode(request.ReturnMode);
            var transactionGroupId = Guid.NewGuid();
            var ledgerEntries = new List<InventoryLedgerEntry>();

            foreach (var item in request.Items)
            {
                var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(item.SkuId, innerCt)
                    ?? throw new InventoryValidationException($"SKU {item.SkuCode} chưa có tồn kho.");
                var warehouseBefore = stock.WarehouseQuantityOnHand;
                var shelfBefore = stock.QuantityOnHand;

                var allocations = _inventoryOptions.SimulateWarehouse
                    ? new List<StockExportBatchAllocation>()
                    : await AllocateAndDeductBatchesAsync(item.SkuId, item.Quantity, LocationWarehouse, item.WarehouseBatchId, innerCt);

                if (_inventoryOptions.SimulateWarehouse)
                    stock.WarehouseQuantityOnHand -= item.Quantity;
                else
                    await SyncWarehouseQtyFromBatchesAsync(stock, innerCt);

                if (stock.WarehouseQuantityOnHand < 0)
                    throw new InventoryValidationException($"Kho không đủ tồn SKU {item.SkuCode}.");
                stock.UpdatedAt = DateTime.UtcNow;

                var exportSlip = await CreateReturnExportSlipAsync(
                    isCorrection ? "inbound_data_correction" : "supplier_return",
                    ReferenceSupplierReturn,
                    request.Id,
                    request.ReturnCode,
                    item.SkuId,
                    item.SkuCode,
                    item.SkuSnapshotName,
                    item.Quantity,
                    warehouseBefore,
                    stock.WarehouseQuantityOnHand,
                    shelfBefore,
                    shelfBefore,
                    reviewerId,
                    reviewer,
                    request.Reason,
                    allocations,
                    innerCt);

                item.WarehouseQtyBefore = warehouseBefore;
                item.WarehouseQtyAfter = stock.WarehouseQuantityOnHand;
                item.ShelfQtyBefore = shelfBefore;
                item.ShelfQtyAfter = shelfBefore;
                item.StockExportSlipId = exportSlip.Id;
                item.StockExportSlipCode = exportSlip.ExportCode;
                if (item.WarehouseBatchId == null && allocations.Count > 0)
                {
                    item.WarehouseBatchId = allocations[0].WarehouseBatchId;
                    item.WarehouseBatchLotCode = allocations[0].LotCode;
                }

                ledgerEntries.Add(CreateLedgerEntry(
                    transactionGroupId,
                    item.SkuId,
                    item.SkuCode,
                    item.SkuSnapshotName,
                    LocationWarehouse,
                    warehouseBefore,
                    -item.Quantity,
                    stock.WarehouseQuantityOnHand,
                    isCorrection ? TransactionInboundDataCorrection : TransactionSupplierReturn,
                    LocationWarehouse,
                    null,
                    ReferenceSupplierReturn,
                    request.Id,
                    request.ReturnCode,
                    item.WarehouseBatchId,
                    item.WarehouseBatchLotCode,
                    reviewerId,
                    reviewer,
                    request.Reason,
                    exportSlip.ExportCode));
            }

            request.Status = InventoryReturnRequestStatus.Completed;
            request.ReviewedBy = reviewerId;
            request.ReviewedByName = NormalizeSnapshotText(reviewer?.CreatedByName);
            request.ReviewedByRoleName = NormalizeSnapshotText(reviewer?.CreatedByRoleName);
            request.ReviewedAt = DateTime.UtcNow;
            request.UpdatedAt = DateTime.UtcNow;
            await _skuStockRepo.SaveChangesAsync(innerCt);
            await _supplierReturnRepo.SaveChangesAsync(innerCt);
            await _ledgerRepo.AddRangeAsync(ledgerEntries, innerCt);
            await _ledgerRepo.SaveChangesAsync(innerCt);
            return MapSupplierReturnRequest(request);
        }, ct);
    }

    public async Task<SupplierReturnRequestResponse> RejectSupplierReturnRequestAsync(Guid id, Guid reviewerId, CreatorSnapshot? reviewer, ReviewInventoryReturnRequest request, CancellationToken ct = default)
    {
        var entity = await _supplierReturnRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy yêu cầu trả nhà cung cấp.");
        ApplyReturnReviewDecision(entity, InventoryReturnRequestStatus.Rejected, reviewerId, reviewer, request.Reason, "Vui lòng nhập lý do từ chối.");
        await _supplierReturnRepo.SaveChangesAsync(ct);
        return MapSupplierReturnRequest(entity);
    }

    public async Task<SupplierReturnRequestResponse> CancelSupplierReturnRequestAsync(Guid id, Guid actorId, bool isAdmin, CreatorSnapshot? actor, ReviewInventoryReturnRequest request, CancellationToken ct = default)
    {
        var entity = await _supplierReturnRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy yêu cầu trả nhà cung cấp.");
        if (!isAdmin && entity.CreatedBy != actorId)
            throw new InventoryValidationException("Chỉ người tạo hoặc Admin mới được hủy yêu cầu.");
        ApplyReturnReviewDecision(entity, InventoryReturnRequestStatus.Cancelled, actorId, actor, request.Reason, "Vui lòng nhập lý do hủy.");
        await _supplierReturnRepo.SaveChangesAsync(ct);
        return MapSupplierReturnRequest(entity);
    }

    public static List<StocktakeReasonCodeResponse> GetStocktakeReasonCodes() =>
        StocktakeReasonCodes
            .OrderBy(kvp => kvp.Key)
            .Select(kvp => new StocktakeReasonCodeResponse(kvp.Key, kvp.Value))
            .ToList();

    public async Task<PagedResponse<StocktakeRequestResponse>> GetStocktakeRequestsAsync(
        string? status,
        string? location,
        Guid? createdBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var parsedStatus = ParseStocktakeStatus(status);
        var normalizedLocation = string.IsNullOrWhiteSpace(location)
            ? null
            : NormalizeInventoryLocationName(location);
        var (safePage, safePageSize) = NormalizePagination(page, pageSize);
        var (items, totalCount) = await _stocktakeRepo.GetPagedAsync(
            parsedStatus,
            normalizedLocation,
            createdBy,
            search,
            safePage,
            safePageSize,
            ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)safePageSize));
        return new PagedResponse<StocktakeRequestResponse>(
            items.Select(MapStocktakeRequest).ToList(),
            safePage,
            safePageSize,
            totalCount,
            totalPages);
    }

    public async Task<StocktakeRequestResponse?> GetStocktakeRequestAsync(Guid id, CancellationToken ct = default)
    {
        var request = await _stocktakeRepo.GetByIdAsync(id, ct);
        return request == null ? null : MapStocktakeRequest(request);
    }

    public static readonly string ShelfDayStartReason = "Kiểm kệ đầu ngày";
    public static readonly string ShelfDayEndReason = "Kiểm kệ cuối ngày";
    public static readonly string ShelfDayStartReasonLegacy = "Kiểm kệ đầu ca POS";

    public async Task<ShelfDayStocktakeStatusResponse> GetShelfDayStocktakeStatusAsync(
        DateTime? date,
        CancellationToken ct = default)
    {
        // Ngày nghiệp vụ theo giờ VN (UTC+7), tránh khóa nhầm sang ngày mới vì UtcNow.Date.
        var day = date?.Date ?? DateTime.UtcNow.AddHours(7).Date;
        var markers = await _stocktakeRepo.GetShelfDayMarkersAsync(day, ct);

        static bool IsDayStart(string? reason) =>
            string.Equals(reason?.Trim(), ShelfDayStartReason, StringComparison.OrdinalIgnoreCase)
            || string.Equals(reason?.Trim(), ShelfDayStartReasonLegacy, StringComparison.OrdinalIgnoreCase);

        static bool IsDayEnd(string? reason) =>
            string.Equals(reason?.Trim(), ShelfDayEndReason, StringComparison.OrdinalIgnoreCase);

        var dayStart = markers.FirstOrDefault(r => IsDayStart(r.Reason));
        var dayEnd = markers.FirstOrDefault(r => IsDayEnd(r.Reason));

        return new ShelfDayStocktakeStatusResponse(
            DateOnly.FromDateTime(day),
            dayStart != null,
            dayEnd != null,
            dayStart?.Id,
            dayStart?.RequestCode,
            dayEnd?.Id,
            dayEnd?.RequestCode);
    }

    public async Task<StocktakeRequestResponse> CreateStocktakeRequestAsync(
        CreateStocktakeRequest request,
        Guid createdBy,
        CreatorSnapshot? creator,
        CancellationToken ct = default)
    {
        if (createdBy == Guid.Empty)
            throw new InventoryValidationException("Cannot identify stocktake creator.");

        var location = NormalizeInventoryLocationName(request.Location);
        var normalizedItems = await NormalizeStocktakeItemsAsync(request.Items, location, ct);
        var now = DateTime.UtcNow;
        var businessDate = now.AddHours(7).Date;
        var countToday = await _stocktakeRepo.CountCreatedSinceAsync(now.Date, ct);
        var entity = new StocktakeRequest
        {
            Id = Guid.NewGuid(),
            RequestCode = $"KK-{now:yyyyMMdd}-{(countToday + 1):D4}",
            Location = location,
            CountDate = request.CountDate?.Date ?? businessDate,
            Reason = NormalizeSnapshotText(request.Reason),
            Note = NormalizeSnapshotText(request.Note),
            Status = StocktakeStatus.Draft,
            CreatedBy = createdBy,
            CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
            CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
            CreatedAt = now,
            UpdatedAt = now,
        };

        foreach (var item in normalizedItems)
        {
            entity.Items.Add(new StocktakeRequestItem
            {
                Id = Guid.NewGuid(),
                StocktakeRequestId = entity.Id,
                SkuId = item.SkuId,
                SkuCode = item.SkuCode,
                SkuSnapshotName = item.SkuSnapshotName,
                ProductTypeSnapshot = item.ProductTypeSnapshot,
                InventoryUnitSnapshot = item.InventoryUnitSnapshot,
                SystemQuantitySnapshot = item.SystemQuantitySnapshot,
                ActualQuantity = item.ActualQuantity,
                Variance = item.ActualQuantity - item.SystemQuantitySnapshot,
                ReasonCode = item.ReasonCode,
                Note = item.Note,
            });
        }

        await _stocktakeRepo.AddAsync(entity, ct);
        await _stocktakeRepo.SaveChangesAsync(ct);
        return MapStocktakeRequest(entity);
    }

    public async Task<StocktakeRequestResponse> SubmitStocktakeRequestAsync(
        Guid id,
        Guid submittedBy,
        CreatorSnapshot? _,
        CancellationToken ct = default)
    {
        if (submittedBy == Guid.Empty)
            throw new InventoryValidationException("Cannot identify stocktake submitter.");

        var request = await _stocktakeRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Stocktake request was not found.");
        if (request.Status == StocktakeStatus.PendingApproval)
            return MapStocktakeRequest(request);
        if (request.Status != StocktakeStatus.Draft && request.Status != StocktakeStatus.Rejected)
            throw new InventoryValidationException("Only draft or rejected stocktake requests can be submitted.");
        if (request.Items.Count == 0)
            throw new InventoryValidationException("Stocktake request must contain at least one SKU line.");

        request.Status = StocktakeStatus.PendingApproval;
        request.SubmittedBy = submittedBy;
        request.SubmittedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;
        request.ReviewedBy = null;
        request.ReviewedByName = null;
        request.ReviewedByRoleName = null;
        request.ReviewedAt = null;
        request.ReviewNote = null;
        await _stocktakeRepo.SaveChangesAsync(ct);
        return MapStocktakeRequest(request);
    }

    public async Task<StocktakeRequestResponse> ApproveStocktakeRequestAsync(
        Guid id,
        Guid reviewerId,
        CreatorSnapshot? reviewer,
        ReviewStocktakeRequest? review,
        CancellationToken ct = default)
    {
        if (reviewerId == Guid.Empty)
            throw new InventoryValidationException("Cannot identify stocktake reviewer.");

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var request = await _stocktakeRepo.GetByIdAsync(id, innerCt)
                ?? throw new InventoryNotFoundException("Stocktake request was not found.");
            if (request.Status == StocktakeStatus.Completed)
                throw new InventoryValidationException("Stocktake request was already completed.");
            if (request.Status != StocktakeStatus.PendingApproval)
                throw new InventoryValidationException("Only pending stocktake requests can be approved.");
            if (request.CreatedBy == reviewerId)
                throw new InventoryValidationException("Stocktake creator cannot approve their own request.");
            if (request.Items.Count == 0)
                throw new InventoryValidationException("Stocktake request must contain at least one SKU line.");

            var location = NormalizeInventoryLocationName(request.Location);
            var decreases = new List<AppliedStocktakeLine>();
            var increases = new List<AppliedStocktakeLine>();
            var transactionGroupId = Guid.NewGuid();
            var touchedSkuIds = new HashSet<Guid>();

            foreach (var item in request.Items.OrderBy(i => i.SkuCode))
            {
                EnsureValidStocktakeReason(item.ReasonCode);
                // Áp chênh lệch đã đếm (Actual − Snapshot) lên tồn hiện tại — không bắt buộc
                // tồn vẫn bằng snapshot lúc kiểm kê (cho phép bán hàng sau khi gửi duyệt).
                var currentSystemQuantity = await GetSystemQuantityForLocationAsync(item.SkuId, location, innerCt);
                var variance = item.Variance;

                if (variance == 0)
                {
                    ApplyStocktakeBeforeAfter(item, location, currentSystemQuantity, currentSystemQuantity);
                    continue;
                }

                var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(item.SkuId, innerCt)
                    ?? await GetOrCreateSkuStockAsync(item.SkuId, item.SkuCode, innerCt);
                var warehouseBefore = location == LocationWarehouse ? currentSystemQuantity : stock.WarehouseQuantityOnHand;
                var shelfBefore = location == LocationShelf ? currentSystemQuantity : stock.QuantityOnHand;

                if (variance < 0)
                {
                    var quantity = Math.Abs(variance);
                    var allocations = _inventoryOptions.SimulateWarehouse
                        ? new List<StockExportBatchAllocation>()
                        : await AllocateAndDeductBatchesFifoAsync(item.SkuId, quantity, innerCt, location);

                    if (location == LocationWarehouse)
                    {
                        if (_inventoryOptions.SimulateWarehouse)
                            stock.WarehouseQuantityOnHand = Math.Max(0, stock.WarehouseQuantityOnHand - quantity);
                        else
                            await SyncWarehouseQtyFromBatchesAsync(stock, innerCt);
                    }
                    else
                    {
                        stock.QuantityOnHand = _inventoryOptions.SimulateWarehouse
                            ? Math.Max(0, stock.QuantityOnHand - quantity)
                            : await _batchRepo.SumQuantityOnHandAsync(item.SkuId, LocationShelf, innerCt);
                        stock.UpdatedAt = DateTime.UtcNow;
                        await _skuStockRepo.SaveChangesAsync(innerCt);
                    }

                    var warehouseAfter = location == LocationWarehouse ? stock.WarehouseQuantityOnHand : warehouseBefore;
                    var shelfAfter = location == LocationShelf ? stock.QuantityOnHand : shelfBefore;
                    ApplyStocktakeBeforeAfter(item, location, currentSystemQuantity, currentSystemQuantity - quantity);
                    decreases.Add(new AppliedStocktakeLine(item, quantity, warehouseBefore, warehouseAfter, shelfBefore, shelfAfter, allocations, null));
                }
                else
                {
                    var quantity = variance;
                    var lotCode = BuildStocktakeLotCode(request.RequestCode, item);
                    var batch = await CreateWarehouseBatchInternalAsync(
                        lotCode,
                        null,
                        null,
                        $"Stocktake adjustment {request.RequestCode}",
                        [
                            new CreateWarehouseBatchItemRequest(
                                item.SkuId,
                                item.SkuCode,
                                item.SkuSnapshotName,
                                quantity,
                                null)
                        ],
                        reviewerId,
                        innerCt,
                        "stocktake_adjustment",
                        request.Id,
                        request.RequestCode,
                        location);

                    stock = await _skuStockRepo.GetBySkuIdWithLockAsync(item.SkuId, innerCt)
                        ?? throw new InventoryValidationException($"SKU {item.SkuCode} was not found after stocktake adjustment.");
                    var warehouseAfter = location == LocationWarehouse ? stock.WarehouseQuantityOnHand : warehouseBefore;
                    var shelfAfter = location == LocationShelf ? stock.QuantityOnHand : shelfBefore;
                    ApplyStocktakeBeforeAfter(item, location, currentSystemQuantity, currentSystemQuantity + quantity);
                    item.WarehouseBatchId = batch.Id;
                    item.WarehouseBatchLotCode = batch.LotCode;
                    increases.Add(new AppliedStocktakeLine(item, quantity, warehouseBefore, warehouseAfter, shelfBefore, shelfAfter, [], batch));
                }

                touchedSkuIds.Add(item.SkuId);
            }

            await CreateStocktakeExportSlipAsync(request, decreases, reviewerId, reviewer, review?.Reason, innerCt);
            await CreateStocktakeImportSlipAsync(request, increases, reviewerId, reviewer, review?.Reason, innerCt);
            var ledgerEntries = BuildStocktakeLedgerEntries(
                request,
                decreases.Concat(increases),
                transactionGroupId,
                reviewerId,
                reviewer,
                review?.Reason);

            request.Status = StocktakeStatus.Completed;
            request.ReviewedBy = reviewerId;
            request.ReviewedByName = NormalizeSnapshotText(reviewer?.CreatedByName);
            request.ReviewedByRoleName = NormalizeSnapshotText(reviewer?.CreatedByRoleName);
            request.ReviewedAt = DateTime.UtcNow;
            request.ReviewNote = NormalizeSnapshotText(review?.Reason);
            request.UpdatedAt = DateTime.UtcNow;
            await _stocktakeRepo.SaveChangesAsync(innerCt);

            if (ledgerEntries.Count > 0)
            {
                await _ledgerRepo.AddRangeAsync(ledgerEntries, innerCt);
                await _ledgerRepo.SaveChangesAsync(innerCt);
            }

            await GenerateShelfReplenishmentSuggestionAsync(request, location, innerCt);

            foreach (var skuId in touchedSkuIds)
                await PublishLowStockForSkuLocationAsync(skuId, location, innerCt);

            return MapStocktakeRequest(request);
        }, ct);
    }

    /// <summary>
    /// Sinh gợi ý bổ sung Kệ Hàng sau khi duyệt phiếu kiểm kệ (Location = Shelf).
    /// Gợi ý KHÔNG chứa số lượng cần bổ sung — chỉ chụp lại hiện trạng tồn Kệ / ngưỡng / tồn Kho;
    /// Warehouse tự quyết số lượng khi tạo phiếu điều chuyển.
    /// </summary>
    private async Task GenerateShelfReplenishmentSuggestionAsync(
        StocktakeRequest request,
        string location,
        CancellationToken ct)
    {
        if (location != LocationShelf)
            return;
        if (await _suggestionRepo.ExistsForStocktakeAsync(request.Id, ct))
            return;

        var items = new List<ShelfReplenishmentSuggestionItem>();
        var suggestionId = Guid.NewGuid();

        // ProductTypeSnapshot trên dòng kiểm kê có thể null, nên đối chiếu trực tiếp với Product catalog.
        var catalog = await _productCatalogClient.GetCatalogForVariantIdsAsync(
            request.Items.Select(i => i.SkuId), ct);

        foreach (var line in request.Items.OrderBy(i => i.SkuCode))
        {
            // Chỉ thành phẩm còn hoạt động và cho phép bán mới điều chuyển được lên Kệ.
            var product = catalog.FindProductByVariant(line.SkuId);
            var variant = catalog.FindVariant(line.SkuId);
            if (product is null || variant is null
                || !product.IsActive || !variant.IsActive || !variant.IsSellable
                || !string.Equals(product.ProductType, "THANH_PHAM", StringComparison.OrdinalIgnoreCase))
                continue;

            var stock = await _skuStockRepo.GetBySkuIdAsync(line.SkuId, ct);
            if (stock is null || stock.ShelfLowStockThreshold <= 0)
                continue;

            var available = stock.QuantityOnHand - stock.ReservedQuantity;
            if (available > stock.ShelfLowStockThreshold)
                continue;

            items.Add(new ShelfReplenishmentSuggestionItem
            {
                Id = Guid.NewGuid(),
                SuggestionId = suggestionId,
                SkuId = line.SkuId,
                SkuCode = line.SkuCode,
                SkuSnapshotName = line.SkuSnapshotName,
                InventoryUnitSnapshot = line.InventoryUnitSnapshot,
                ShelfQuantityAtStocktake = stock.QuantityOnHand,
                ShelfReservedAtStocktake = stock.ReservedQuantity,
                ShelfLowStockThreshold = stock.ShelfLowStockThreshold,
                WarehouseQuantityAtStocktake = stock.WarehouseQuantityOnHand,
            });
        }

        if (items.Count == 0)
            return;

        var now = DateTime.UtcNow;
        var countToday = await _suggestionRepo.CountCreatedSinceAsync(now.Date, ct);
        var suggestion = new ShelfReplenishmentSuggestion
        {
            Id = suggestionId,
            SuggestionCode = $"GY-{now:yyyyMMdd}-{(countToday + 1):D4}",
            SourceStocktakeRequestId = request.Id,
            SourceStocktakeCode = request.RequestCode,
            Status = ShelfReplenishmentSuggestionStatus.Open,
            CreatedAt = now,
            Items = items,
        };

        await _suggestionRepo.AddAsync(suggestion, ct);
        await _suggestionRepo.SaveChangesAsync(ct);
    }

    public async Task<PagedResponse<ShelfReplenishmentSuggestionResponse>> GetShelfReplenishmentSuggestionsAsync(
        string? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var parsedStatus = ParseShelfReplenishmentSuggestionStatus(status);
        var (safePage, safePageSize) = NormalizePagination(page, pageSize);
        var (items, totalCount) = await _suggestionRepo.GetPagedAsync(
            parsedStatus, search, safePage, safePageSize, ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)safePageSize));
        return new PagedResponse<ShelfReplenishmentSuggestionResponse>(
            items.Select(MapShelfReplenishmentSuggestion).ToList(),
            safePage,
            safePageSize,
            totalCount,
            totalPages);
    }

    public async Task<ShelfReplenishmentSuggestionResponse?> GetShelfReplenishmentSuggestionAsync(
        Guid id,
        CancellationToken ct = default)
    {
        var suggestion = await _suggestionRepo.GetByIdAsync(id, ct);
        return suggestion is null ? null : MapShelfReplenishmentSuggestion(suggestion);
    }

    public async Task<int> CountOpenShelfReplenishmentSuggestionsAsync(CancellationToken ct = default) =>
        await _suggestionRepo.CountOpenAsync(ct);

    public async Task<ShelfReplenishmentSuggestionResponse> DismissShelfReplenishmentSuggestionAsync(
        Guid id,
        Guid actorId,
        CreatorSnapshot? actor,
        DismissShelfReplenishmentSuggestionRequest request,
        CancellationToken ct = default)
    {
        var suggestion = await _suggestionRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy gợi ý bổ sung kệ.");
        if (suggestion.Status != ShelfReplenishmentSuggestionStatus.Open)
            throw new InventoryValidationException("Chỉ gợi ý đang mở mới có thể bỏ qua.");

        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Vui lòng nhập lý do bỏ qua gợi ý.");

        suggestion.Status = ShelfReplenishmentSuggestionStatus.Dismissed;
        suggestion.HandledBy = actorId;
        suggestion.HandledByName = actor?.CreatedByName;
        suggestion.HandledByRoleName = actor?.CreatedByRoleName;
        suggestion.HandledAt = DateTime.UtcNow;
        suggestion.HandledNote = reason;
        await _suggestionRepo.SaveChangesAsync(ct);

        return MapShelfReplenishmentSuggestion(suggestion);
    }

    private static ShelfReplenishmentSuggestionStatus? ParseShelfReplenishmentSuggestionStatus(string? status) =>
        (status ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "" => null,
            "all" => null,
            "open" => ShelfReplenishmentSuggestionStatus.Open,
            "handled" => ShelfReplenishmentSuggestionStatus.Handled,
            "dismissed" => ShelfReplenishmentSuggestionStatus.Dismissed,
            _ => throw new InventoryValidationException("Trạng thái gợi ý không hợp lệ."),
        };

    private static ShelfReplenishmentSuggestionResponse MapShelfReplenishmentSuggestion(
        ShelfReplenishmentSuggestion suggestion)
    {
        var items = suggestion.Items
            .OrderBy(item => item.SkuCode)
            .Select(item => new ShelfReplenishmentSuggestionItemResponse(
                item.Id,
                item.SkuId,
                item.SkuCode,
                item.SkuSnapshotName,
                item.InventoryUnitSnapshot,
                item.ShelfQuantityAtStocktake,
                item.ShelfReservedAtStocktake,
                item.ShelfLowStockThreshold,
                item.WarehouseQuantityAtStocktake))
            .ToList();

        return new ShelfReplenishmentSuggestionResponse(
            suggestion.Id,
            suggestion.SuggestionCode,
            suggestion.SourceStocktakeRequestId,
            suggestion.SourceStocktakeCode,
            suggestion.Status.ToString(),
            suggestion.CreatedAt,
            suggestion.HandledBy,
            suggestion.HandledByName,
            suggestion.HandledByRoleName,
            suggestion.HandledAt,
            suggestion.HandledNote,
            items.Count,
            items);
    }

    public async Task<StocktakeRequestResponse> RejectStocktakeRequestAsync(
        Guid id,
        Guid reviewerId,
        CreatorSnapshot? reviewer,
        ReviewStocktakeRequest request,
        CancellationToken ct = default)
    {
        var entity = await _stocktakeRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Stocktake request was not found.");
        if (entity.Status != StocktakeStatus.PendingApproval)
            throw new InventoryValidationException("Only pending stocktake requests can be rejected.");
        if (entity.CreatedBy == reviewerId)
            throw new InventoryValidationException("Stocktake creator cannot reject their own request.");
        var reason = NormalizeSnapshotText(request.Reason);
        if (string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Reject reason is required.");

        entity.Status = StocktakeStatus.Rejected;
        entity.ReviewedBy = reviewerId == Guid.Empty ? null : reviewerId;
        entity.ReviewedByName = NormalizeSnapshotText(reviewer?.CreatedByName);
        entity.ReviewedByRoleName = NormalizeSnapshotText(reviewer?.CreatedByRoleName);
        entity.ReviewedAt = DateTime.UtcNow;
        entity.ReviewNote = reason;
        entity.UpdatedAt = DateTime.UtcNow;
        await _stocktakeRepo.SaveChangesAsync(ct);
        return MapStocktakeRequest(entity);
    }

    public async Task<StocktakeRequestResponse> CancelStocktakeRequestAsync(
        Guid id,
        Guid actorId,
        bool isPrivileged,
        CreatorSnapshot? actor,
        ReviewStocktakeRequest request,
        CancellationToken ct = default)
    {
        var entity = await _stocktakeRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Stocktake request was not found.");
        if (entity.Status == StocktakeStatus.Completed)
            throw new InventoryValidationException("Completed stocktake requests cannot be cancelled.");
        if (!isPrivileged && entity.CreatedBy != actorId)
            throw new InventoryValidationException("Only the creator, Manager, Warehouse or Admin can cancel this stocktake request.");
        var reason = NormalizeSnapshotText(request.Reason);
        if (string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Cancel reason is required.");

        entity.Status = StocktakeStatus.Cancelled;
        entity.ReviewedBy = actorId == Guid.Empty ? null : actorId;
        entity.ReviewedByName = NormalizeSnapshotText(actor?.CreatedByName);
        entity.ReviewedByRoleName = NormalizeSnapshotText(actor?.CreatedByRoleName);
        entity.ReviewedAt = DateTime.UtcNow;
        entity.ReviewNote = reason;
        entity.UpdatedAt = DateTime.UtcNow;
        await _stocktakeRepo.SaveChangesAsync(ct);
        return MapStocktakeRequest(entity);
    }

    /// <summary>
    /// Manager/Admin mở lại ngày bán: hủy marker kiểm kệ cuối ngày (Pending/Completed).
    /// Không đảo tồn đã áp — chỉ gỡ khóa ngày để Sale tiếp tục bán.
    /// </summary>
    public async Task<ShelfDayStocktakeStatusResponse> ReopenShelfDayAsync(
        DateTime? date,
        Guid actorId,
        CreatorSnapshot? actor,
        ReviewStocktakeRequest request,
        CancellationToken ct = default)
    {
        if (actorId == Guid.Empty)
            throw new InventoryValidationException("Cannot identify reopen actor.");

        var reason = NormalizeSnapshotText(request.Reason);
        if (string.IsNullOrWhiteSpace(reason))
            throw new InventoryValidationException("Lý do mở lại ngày bán là bắt buộc.");

        var day = date?.Date ?? DateTime.UtcNow.AddHours(7).Date;
        var markers = await _stocktakeRepo.GetShelfDayMarkersAsync(day, ct);
        var dayEnds = markers
            .Where(r => string.Equals(r.Reason?.Trim(), ShelfDayEndReason, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (dayEnds.Count == 0)
            throw new InventoryValidationException("Không có phiếu kiểm kệ cuối ngày để mở lại.");

        foreach (var marker in dayEnds)
        {
            var entity = await _stocktakeRepo.GetByIdAsync(marker.Id, ct)
                ?? throw new InventoryNotFoundException("Stocktake request was not found.");

            entity.Status = StocktakeStatus.Cancelled;
            entity.ReviewedBy = actorId;
            entity.ReviewedByName = NormalizeSnapshotText(actor?.CreatedByName);
            entity.ReviewedByRoleName = NormalizeSnapshotText(actor?.CreatedByRoleName);
            entity.ReviewedAt = DateTime.UtcNow;
            entity.ReviewNote = $"Mở lại ngày bán: {reason}";
            entity.UpdatedAt = DateTime.UtcNow;
            await _stocktakeRepo.SaveChangesAsync(ct);
        }

        return await GetShelfDayStocktakeStatusAsync(day, ct);
    }

    private sealed record NormalizedStocktakeItem(
        Guid SkuId,
        string SkuCode,
        string SkuSnapshotName,
        string? ProductTypeSnapshot,
        string? InventoryUnitSnapshot,
        int SystemQuantitySnapshot,
        int ActualQuantity,
        string ReasonCode,
        string? Note);

    private sealed record AppliedStocktakeLine(
        StocktakeRequestItem Item,
        int Quantity,
        int WarehouseBefore,
        int WarehouseAfter,
        int ShelfBefore,
        int ShelfAfter,
        List<StockExportBatchAllocation> Allocations,
        WarehouseBatchResponse? Batch);

    private async Task<List<NormalizedStocktakeItem>> NormalizeStocktakeItemsAsync(
        List<StocktakeItemRequest>? items,
        string location,
        CancellationToken ct)
    {
        if (items == null || items.Count == 0)
            throw new InventoryValidationException("Stocktake request must contain at least one SKU line.");

        ProductCatalogSnapshot? catalog = null;
        try
        {
            catalog = await _productCatalogClient.GetCatalogAsync(ct);
        }
        catch (InventoryValidationException)
        {
            // Stocktake must not depend on Product/BOM catalog availability. The request carries SKU snapshots,
            // and Inventory stock/batch data is authoritative for counted quantities.
        }
        var usedSkuIds = new HashSet<Guid>();
        var normalized = new List<NormalizedStocktakeItem>();

        foreach (var (line, index) in items.Select((value, i) => (value, i)))
        {
            if (line.SkuId == Guid.Empty)
                throw new InventoryValidationException($"Line {index + 1}: SKU is required.");
            if (!usedSkuIds.Add(line.SkuId))
                throw new InventoryValidationException($"Line {index + 1}: Duplicate SKU in the same stocktake request.");
            if (line.ActualQuantity < 0)
                throw new InventoryValidationException($"Line {index + 1}: Actual quantity must be non-negative.");

            var reasonCode = NormalizeStocktakeReasonCode(line.ReasonCode);
            var product = catalog?.FindProductByVariant(line.SkuId);
            var variant = catalog?.FindVariant(line.SkuId);
            var stock = await _skuStockRepo.GetBySkuIdAsync(line.SkuId, ct);
            var skuCode = NormalizeSnapshotText(line.SkuCode)
                ?? NormalizeSnapshotText(variant?.SkuCode)
                ?? NormalizeSnapshotText(stock?.SkuCode)
                ?? line.SkuId.ToString()[..8];
            var skuName = NormalizeSnapshotText(line.SkuSnapshotName)
                ?? BuildCatalogSkuName(product, variant)
                ?? skuCode;
            var systemQuantity = await GetSystemQuantityForLocationAsync(line.SkuId, location, ct);

            normalized.Add(new NormalizedStocktakeItem(
                line.SkuId,
                skuCode,
                skuName,
                NormalizeSnapshotText(product?.ProductType),
                NormalizeSnapshotText(product?.InventoryUnit) ?? NormalizeSnapshotText(product?.BaseUnit),
                systemQuantity,
                line.ActualQuantity,
                reasonCode,
                NormalizeSnapshotText(line.Note)));
        }

        return normalized;
    }

    private static string? BuildCatalogSkuName(CatalogProduct? product, CatalogVariant? variant)
    {
        if (product == null && variant == null)
            return null;
        if (product == null)
            return NormalizeSnapshotText(variant?.VariantName) ?? NormalizeSnapshotText(variant?.SkuCode);
        var variantName = NormalizeSnapshotText(variant?.VariantName);
        if (string.IsNullOrWhiteSpace(variantName))
            return product.Name;
        return $"{product.Name} - {variantName}";
    }

    private async Task<int> GetSystemQuantityForLocationAsync(Guid skuId, string location, CancellationToken ct)
    {
        // Tồn kệ phải khớp /api/v1/store/sku-stocks và POS (SkuStock.QuantityOnHand).
        // Không dùng tổng lô Shelf ở đây — nhiều luồng bán/trừ tồn chỉ cập nhật SkuStock,
        // nên SumQuantityOnHand(Shelf) dễ = 0 hoặc lệch so với số Sale đang đối chiếu.
        if (location == LocationShelf)
        {
            var shelfStock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct);
            return shelfStock?.QuantityOnHand ?? 0;
        }

        if (_inventoryOptions.SimulateWarehouse)
        {
            var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct);
            return stock?.WarehouseQuantityOnHand ?? 0;
        }

        return await _batchRepo.SumQuantityOnHandAsync(skuId, location, ct);
    }

    private static StocktakeStatus? ParseStocktakeStatus(string? status)
    {
        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<StocktakeStatus>(status, true, out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static string NormalizeStocktakeReasonCode(string? reasonCode)
    {
        var normalized = NormalizeSnapshotText(reasonCode)?.ToUpperInvariant();
        if (normalized == null || !StocktakeReasonCodes.ContainsKey(normalized))
            throw new InventoryValidationException("Stocktake reason code is invalid.");
        return normalized;
    }

    private static void EnsureValidStocktakeReason(string reasonCode) =>
        _ = NormalizeStocktakeReasonCode(reasonCode);

    private static void ApplyStocktakeBeforeAfter(StocktakeRequestItem item, string location, int before, int after)
    {
        if (location == LocationWarehouse)
        {
            item.WarehouseQtyBefore = before;
            item.WarehouseQtyAfter = after;
        }
        else
        {
            item.ShelfQtyBefore = before;
            item.ShelfQtyAfter = after;
        }
    }

    private static string BuildStocktakeLotCode(string requestCode, StocktakeRequestItem item)
    {
        var value = $"KK-{requestCode}-{item.Id:N}";
        return NormalizeLotCode(value[..Math.Min(50, value.Length)]);
    }

    private async Task<StockExportSlip?> CreateStocktakeExportSlipAsync(
        StocktakeRequest request,
        List<AppliedStocktakeLine> lines,
        Guid createdBy,
        CreatorSnapshot? creator,
        string? note,
        CancellationToken ct)
    {
        if (lines.Count == 0)
            return null;

        var now = DateTime.UtcNow;
        var countToday = await _exportSlipRepo.CountCreatedSinceAsync(now.Date, ct);
        var slipId = Guid.NewGuid();
        var slipLines = new List<StockExportSlipLine>();
        foreach (var line in lines)
        {
            var slipLine = new StockExportSlipLine
            {
                Id = Guid.NewGuid(),
                StockExportSlipId = slipId,
                SkuId = line.Item.SkuId,
                SkuCode = line.Item.SkuCode,
                ProductSnapshotName = line.Item.SkuSnapshotName,
                Quantity = line.Quantity,
                WarehouseQtyBefore = line.WarehouseBefore,
                WarehouseQtyAfter = line.WarehouseAfter,
                StoreQtyBefore = line.ShelfBefore,
                StoreQtyAfter = line.ShelfAfter,
                Note = line.Item.Note,
                CreatedAt = now,
            };
            slipLines.Add(slipLine);
            foreach (var allocation in line.Allocations)
            {
                allocation.StockExportSlipId = slipId;
                allocation.StockExportSlipLineId = slipLine.Id;
            }
        }

        var firstLine = lines[0];
        var slip = new StockExportSlip
        {
            Id = slipId,
            ExportCode = $"PX-{now:yyyyMMdd}-{(countToday + 1):D4}",
            ExportType = "stocktake_adjustment",
            ReferenceType = ReferenceStocktake,
            ReferenceId = request.Id,
            ReferenceCode = request.RequestCode,
            SkuId = firstLine.Item.SkuId,
            SkuCode = lines.Count == 1 ? firstLine.Item.SkuCode : "MULTI",
            SkuSnapshotName = lines.Count == 1 ? firstLine.Item.SkuSnapshotName : $"{lines.Count} stocktake decrease lines",
            Quantity = lines.Sum(l => l.Quantity),
            WarehouseQtyBefore = lines.Sum(l => l.WarehouseBefore),
            WarehouseQtyAfter = lines.Sum(l => l.WarehouseAfter),
            StoreQtyBefore = lines.Sum(l => l.ShelfBefore),
            StoreQtyAfter = lines.Sum(l => l.ShelfAfter),
            Note = NormalizeSnapshotText(note) ?? request.Reason ?? request.Note,
            CreatedBy = createdBy,
            CreatedById = createdBy == Guid.Empty ? null : createdBy,
            CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
            CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
            CreatedAt = now,
            Lines = slipLines,
        };

        await _exportSlipRepo.AddAsync(slip, ct);
        await _exportSlipRepo.SaveChangesAsync(ct);
        var allocations = lines.SelectMany(l => l.Allocations).ToList();
        if (allocations.Count > 0)
        {
            await _exportAllocationRepo.AddRangeAsync(allocations, ct);
            await _exportAllocationRepo.SaveChangesAsync(ct);
        }

        foreach (var line in lines)
        {
            line.Item.StockExportSlipId = slip.Id;
            line.Item.StockExportSlipCode = slip.ExportCode;
        }

        return slip;
    }

    private async Task<StockImportSlip?> CreateStocktakeImportSlipAsync(
        StocktakeRequest request,
        List<AppliedStocktakeLine> lines,
        Guid createdBy,
        CreatorSnapshot? creator,
        string? note,
        CancellationToken ct)
    {
        if (lines.Count == 0)
            return null;

        var now = DateTime.UtcNow;
        var countToday = await _importSlipRepo.CountCreatedSinceAsync(now.Date, ct);
        var slipId = Guid.NewGuid();
        var slipLines = lines.Select(line => new StockImportSlipLine
        {
            Id = Guid.NewGuid(),
            StockImportSlipId = slipId,
            SkuId = line.Item.SkuId,
            SkuCode = line.Item.SkuCode,
            ProductSnapshotName = line.Item.SkuSnapshotName,
            Quantity = line.Quantity,
            WarehouseQtyBefore = line.WarehouseBefore,
            WarehouseQtyAfter = line.WarehouseAfter,
            StoreQtyBefore = line.ShelfBefore,
            StoreQtyAfter = line.ShelfAfter,
            DestinationLocation = request.Location,
            WarehouseBatchId = line.Batch?.Id,
            WarehouseBatchLotCode = line.Batch?.LotCode,
            Note = line.Item.Note,
            CreatedAt = now,
        }).ToList();

        var firstLine = lines[0];
        var slip = new StockImportSlip
        {
            Id = slipId,
            ImportCode = $"PN-{now:yyyyMMdd}-{(countToday + 1):D4}",
            ImportType = "stocktake_adjustment_receipt",
            ReferenceType = ReferenceStocktake,
            ReferenceId = request.Id,
            ReferenceCode = request.RequestCode,
            SkuId = firstLine.Item.SkuId,
            SkuCode = lines.Count == 1 ? firstLine.Item.SkuCode : "MULTI",
            ProductSnapshotName = lines.Count == 1 ? firstLine.Item.SkuSnapshotName : $"{lines.Count} stocktake increase lines",
            Quantity = lines.Sum(l => l.Quantity),
            WarehouseQtyBefore = lines.Sum(l => l.WarehouseBefore),
            WarehouseQtyAfter = lines.Sum(l => l.WarehouseAfter),
            StoreQtyBefore = lines.Sum(l => l.ShelfBefore),
            StoreQtyAfter = lines.Sum(l => l.ShelfAfter),
            WarehouseBatchId = firstLine.Batch?.Id,
            WarehouseBatchLotCode = firstLine.Batch?.LotCode,
            Note = NormalizeSnapshotText(note) ?? request.Reason ?? request.Note,
            CreatedBy = createdBy,
            CreatedById = createdBy == Guid.Empty ? null : createdBy,
            CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
            CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
            CreatedAt = now,
            Lines = slipLines,
        };

        await _importSlipRepo.AddAsync(slip, ct);
        await _importSlipRepo.SaveChangesAsync(ct);
        foreach (var line in lines)
        {
            line.Item.StockImportSlipId = slip.Id;
            line.Item.StockImportSlipCode = slip.ImportCode;
        }

        return slip;
    }

    private static List<InventoryLedgerEntry> BuildStocktakeLedgerEntries(
        StocktakeRequest request,
        IEnumerable<AppliedStocktakeLine> lines,
        Guid transactionGroupId,
        Guid actorId,
        CreatorSnapshot? actor,
        string? reviewReason)
    {
        return lines
            .Select(line => CreateLedgerEntry(
                transactionGroupId,
                line.Item.SkuId,
                line.Item.SkuCode,
                line.Item.SkuSnapshotName,
                request.Location,
                request.Location == LocationWarehouse ? line.WarehouseBefore : line.ShelfBefore,
                line.Item.Variance,
                request.Location == LocationWarehouse ? line.WarehouseAfter : line.ShelfAfter,
                TransactionStocktakeAdjustment,
                null,
                null,
                ReferenceStocktake,
                request.Id,
                request.RequestCode,
                line.Batch?.Id ?? line.Allocations.FirstOrDefault()?.WarehouseBatchId,
                line.Batch?.LotCode ?? line.Allocations.FirstOrDefault()?.LotCode,
                actorId,
                actor,
                reviewReason ?? request.Reason ?? line.Item.ReasonCode,
                line.Item.StockImportSlipCode ?? line.Item.StockExportSlipCode,
                line.Item.ProductTypeSnapshot,
                line.Item.InventoryUnitSnapshot))
            .ToList();
    }

    private async Task PublishLowStockForSkuLocationAsync(Guid skuId, string location, CancellationToken ct)
    {
        var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct);
        if (stock == null)
            return;

        var quantity = location == LocationWarehouse
            ? stock.WarehouseQuantityOnHand
            : stock.QuantityOnHand;
        var threshold = location == LocationWarehouse
            ? stock.WarehouseLowStockThreshold
            : stock.ShelfLowStockThreshold;

        if (quantity <= threshold)
            await _eventPublisher.PublishLowStockAsync(stock.SkuId, stock.SkuCode, quantity, threshold, ct);
    }

    private static InventoryReturnRequestStatus? ParseInventoryReturnStatus(string? status)
    {
        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<InventoryReturnRequestStatus>(status, true, out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static string NormalizeReturnMode(string? mode)
    {
        var normalized = NormalizeSnapshotText(mode)?.ToUpperInvariant();
        return normalized switch
        {
            "DATA_CORRECTION" => "DATA_CORRECTION",
            "PHYSICAL_RETURN" or null => "PHYSICAL_RETURN",
            _ => throw new InventoryValidationException("ReturnMode không hợp lệ.")
        };
    }

    private static bool IsDataCorrectionMode(string? mode) =>
        string.Equals(mode, "DATA_CORRECTION", StringComparison.OrdinalIgnoreCase);

    private static void AddReturnItems(ShelfReturnRequest request, List<InventoryReturnItemRequest> items, string expectedLocation, CancellationToken _)
    {
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (line, index) in items.Select((value, i) => (value, i)))
        {
            var quantity = ValidateReturnLine(line, index + 1, expectedLocation);
            var key = $"{line.SkuId}:{line.BatchId?.ToString() ?? "fifo"}";
            if (!used.Add(key))
                throw new InventoryValidationException($"Dòng {index + 1}: SKU/lô bị trùng trong cùng yêu cầu.");

            request.Items.Add(new ShelfReturnRequestItem
            {
                Id = Guid.NewGuid(),
                ShelfReturnRequestId = request.Id,
                SkuId = line.SkuId,
                SkuCode = NormalizeSnapshotText(line.SkuCode) ?? line.SkuId.ToString()[..8],
                SkuSnapshotName = NormalizeSnapshotText(line.SkuSnapshotName) ?? NormalizeSnapshotText(line.SkuCode) ?? line.SkuId.ToString()[..8],
                Quantity = quantity,
                ShelfBatchId = line.BatchId,
                ShelfLotCode = NormalizeSnapshotText(line.LotCode),
                Note = NormalizeSnapshotText(line.Note),
            });
        }
    }

    private static void AddReturnItems(SupplierReturnRequest request, List<InventoryReturnItemRequest> items, string expectedLocation, CancellationToken _)
    {
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (line, index) in items.Select((value, i) => (value, i)))
        {
            var quantity = ValidateReturnLine(line, index + 1, expectedLocation);
            var key = $"{line.SkuId}:{line.BatchId?.ToString() ?? "fifo"}";
            if (!used.Add(key))
                throw new InventoryValidationException($"Dòng {index + 1}: SKU/lô bị trùng trong cùng yêu cầu.");

            request.Items.Add(new SupplierReturnRequestItem
            {
                Id = Guid.NewGuid(),
                SupplierReturnRequestId = request.Id,
                SkuId = line.SkuId,
                SkuCode = NormalizeSnapshotText(line.SkuCode) ?? line.SkuId.ToString()[..8],
                SkuSnapshotName = NormalizeSnapshotText(line.SkuSnapshotName) ?? NormalizeSnapshotText(line.SkuCode) ?? line.SkuId.ToString()[..8],
                Quantity = quantity,
                WarehouseBatchId = line.BatchId,
                WarehouseBatchLotCode = NormalizeSnapshotText(line.LotCode),
                Note = NormalizeSnapshotText(line.Note),
            });
        }
    }

    private static int ValidateReturnLine(InventoryReturnItemRequest line, int lineNumber, string expectedLocation)
    {
        if (line.SkuId == Guid.Empty)
            throw new InventoryValidationException($"Dòng {lineNumber}: SKU là bắt buộc.");
        if (line.Quantity <= 0)
            throw new InventoryValidationException($"Dòng {lineNumber}: Số lượng trả phải lớn hơn 0.");
        if (line.BatchId.HasValue && string.IsNullOrWhiteSpace(line.LotCode))
            throw new InventoryValidationException($"Dòng {lineNumber}: Vui lòng gửi mã lô khi chọn batch {expectedLocation}.");
        return line.Quantity;
    }

    private async Task ValidateReturnAvailabilityAsync(
        IEnumerable<(Guid SkuId, int Quantity, Guid? BatchId)> items,
        string location,
        bool useShelfAggregate,
        CancellationToken ct)
    {
        foreach (var item in items)
        {
            var stock = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, ct)
                ?? throw new InventoryValidationException("SKU chưa có tồn kho.");
            var aggregate = useShelfAggregate ? stock.QuantityOnHand : stock.WarehouseQuantityOnHand;
            if (aggregate < item.Quantity)
                throw new InventoryValidationException($"{(useShelfAggregate ? "Kệ Hàng" : "Kho")} không đủ tồn SKU {stock.SkuCode}.");

            if (_inventoryOptions.SimulateWarehouse)
                continue;

            if (item.BatchId.HasValue)
            {
                var batch = await _batchRepo.GetByIdAsync(item.BatchId.Value, ct)
                    ?? throw new InventoryValidationException("Không tìm thấy lô được chọn.");
                if (!string.Equals(batch.Location, location, StringComparison.OrdinalIgnoreCase))
                    throw new InventoryValidationException("Lô được chọn không thuộc đúng vị trí tồn kho.");
                var batchItem = batch.Items.FirstOrDefault(i => i.SkuId == item.SkuId)
                    ?? throw new InventoryValidationException("Lô được chọn không chứa SKU cần xử lý.");
                if (batchItem.QuantityOnHand < item.Quantity)
                    throw new InventoryValidationException($"Lô {batch.LotCode} không đủ tồn.");
            }
            else
            {
                var batchTotal = await _batchRepo.SumQuantityOnHandAsync(item.SkuId, location, ct);
                if (batchTotal < item.Quantity)
                    throw new InventoryValidationException($"{location} không đủ tồn theo lô để xử lý SKU {stock.SkuCode}.");
            }
        }
    }

    private static void ApplyReturnReviewDecision(
        ShelfReturnRequest request,
        InventoryReturnRequestStatus status,
        Guid reviewerId,
        CreatorSnapshot? reviewer,
        string? reason,
        string requiredMessage)
    {
        if (request.Status != InventoryReturnRequestStatus.Pending)
            throw new InventoryValidationException("Yêu cầu đã được xử lý.");
        var normalizedReason = NormalizeReturnReviewReason(reason, requiredMessage);
        request.Status = status;
        request.ReviewedBy = reviewerId == Guid.Empty ? null : reviewerId;
        request.ReviewedByName = NormalizeSnapshotText(reviewer?.CreatedByName);
        request.ReviewedByRoleName = NormalizeSnapshotText(reviewer?.CreatedByRoleName);
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewNote = normalizedReason;
        request.UpdatedAt = DateTime.UtcNow;
    }

    private static void ApplyReturnReviewDecision(
        SupplierReturnRequest request,
        InventoryReturnRequestStatus status,
        Guid reviewerId,
        CreatorSnapshot? reviewer,
        string? reason,
        string requiredMessage)
    {
        if (request.Status != InventoryReturnRequestStatus.Pending)
            throw new InventoryValidationException("Yêu cầu đã được xử lý.");
        var normalizedReason = NormalizeReturnReviewReason(reason, requiredMessage);
        request.Status = status;
        request.ReviewedBy = reviewerId == Guid.Empty ? null : reviewerId;
        request.ReviewedByName = NormalizeSnapshotText(reviewer?.CreatedByName);
        request.ReviewedByRoleName = NormalizeSnapshotText(reviewer?.CreatedByRoleName);
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewNote = normalizedReason;
        request.UpdatedAt = DateTime.UtcNow;
    }

    private static string NormalizeReturnReviewReason(string? reason, string requiredMessage)
    {
        var normalizedReason = NormalizeSnapshotText(reason);
        if (string.IsNullOrWhiteSpace(normalizedReason))
            throw new InventoryValidationException(requiredMessage);
        return normalizedReason;
    }

    private async Task<StockExportSlip> CreateReturnExportSlipAsync(
        string exportType,
        string referenceType,
        Guid referenceId,
        string referenceCode,
        Guid skuId,
        string skuCode,
        string skuName,
        int quantity,
        int warehouseBefore,
        int warehouseAfter,
        int storeBefore,
        int storeAfter,
        Guid createdBy,
        CreatorSnapshot? creator,
        string? note,
        List<StockExportBatchAllocation> allocations,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var countToday = await _exportSlipRepo.CountCreatedSinceAsync(now.Date, ct);
        var slipId = Guid.NewGuid();
        var slipLine = new StockExportSlipLine
        {
            Id = Guid.NewGuid(),
            StockExportSlipId = slipId,
            SkuId = skuId,
            SkuCode = skuCode,
            ProductSnapshotName = skuName,
            Quantity = quantity,
            WarehouseQtyBefore = warehouseBefore,
            WarehouseQtyAfter = warehouseAfter,
            StoreQtyBefore = storeBefore,
            StoreQtyAfter = storeAfter,
            Note = note,
            CreatedAt = now,
        };

        var slip = new StockExportSlip
        {
            Id = slipId,
            ExportCode = $"PX-{now:yyyyMMdd}-{(countToday + 1):D4}",
            ExportType = exportType,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            ReferenceCode = referenceCode,
            SkuId = skuId,
            SkuCode = skuCode,
            SkuSnapshotName = skuName,
            Quantity = quantity,
            WarehouseQtyBefore = warehouseBefore,
            WarehouseQtyAfter = warehouseAfter,
            StoreQtyBefore = storeBefore,
            StoreQtyAfter = storeAfter,
            Note = note,
            CreatedBy = createdBy,
            CreatedById = createdBy == Guid.Empty ? null : createdBy,
            CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
            CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
            CreatedAt = now,
            Lines = [slipLine],
        };

        await _exportSlipRepo.AddAsync(slip, ct);
        await _exportSlipRepo.SaveChangesAsync(ct);

        if (allocations.Count > 0)
        {
            foreach (var allocation in allocations)
            {
                allocation.StockExportSlipId = slip.Id;
                allocation.StockExportSlipLineId = slipLine.Id;
            }

            await _exportAllocationRepo.AddRangeAsync(allocations, ct);
            await _exportAllocationRepo.SaveChangesAsync(ct);
        }

        return slip;
    }

    private async Task<StockImportSlip> CreateReturnImportSlipAsync(
        string importType,
        string referenceType,
        Guid referenceId,
        string referenceCode,
        Guid skuId,
        string skuCode,
        string skuName,
        int quantity,
        int warehouseBefore,
        int warehouseAfter,
        int storeBefore,
        int storeAfter,
        WarehouseBatch? warehouseBatch,
        Guid createdBy,
        CreatorSnapshot? creator,
        string? note,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var countToday = await _importSlipRepo.CountCreatedSinceAsync(now.Date, ct);
        var slipId = Guid.NewGuid();
        var line = new StockImportSlipLine
        {
            Id = Guid.NewGuid(),
            StockImportSlipId = slipId,
            SkuId = skuId,
            SkuCode = skuCode,
            ProductSnapshotName = skuName,
            Quantity = quantity,
            WarehouseQtyBefore = warehouseBefore,
            WarehouseQtyAfter = warehouseAfter,
            StoreQtyBefore = storeBefore,
            StoreQtyAfter = storeAfter,
            DestinationLocation = LocationWarehouse,
            WarehouseBatchId = warehouseBatch?.Id,
            WarehouseBatchLotCode = warehouseBatch?.LotCode,
            Note = note,
            CreatedAt = now,
        };

        var slip = new StockImportSlip
        {
            Id = slipId,
            ImportCode = $"PN-{now:yyyyMMdd}-{(countToday + 1):D4}",
            ImportType = importType,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            ReferenceCode = referenceCode,
            SkuId = skuId,
            SkuCode = skuCode,
            ProductSnapshotName = skuName,
            Quantity = quantity,
            WarehouseQtyBefore = warehouseBefore,
            WarehouseQtyAfter = warehouseAfter,
            StoreQtyBefore = storeBefore,
            StoreQtyAfter = storeAfter,
            WarehouseBatchId = warehouseBatch?.Id,
            WarehouseBatchLotCode = warehouseBatch?.LotCode,
            Note = note,
            CreatedBy = createdBy,
            CreatedById = createdBy == Guid.Empty ? null : createdBy,
            CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
            CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
            CreatedAt = now,
            Lines = [line],
        };

        await _importSlipRepo.AddAsync(slip, ct);
        await _importSlipRepo.SaveChangesAsync(ct);
        return slip;
    }

    private static InventoryLedgerEntry CreateLedgerEntry(
        Guid transactionGroupId,
        Guid skuId,
        string skuCode,
        string skuName,
        string location,
        int before,
        int delta,
        int after,
        string transactionType,
        string? sourceLocation,
        string? destinationLocation,
        string referenceType,
        Guid referenceId,
        string referenceCode,
        Guid? batchId,
        string? lotCode,
        Guid actorId,
        CreatorSnapshot? actor,
        string? reason,
        string? note,
        string? productTypeSnapshot = null,
        string? inventoryUnitSnapshot = null) => new()
        {
            Id = Guid.NewGuid(),
            TransactionGroupId = transactionGroupId,
            OccurredAtUtc = DateTime.UtcNow,
            SkuId = skuId,
            SkuCode = skuCode,
            SkuNameSnapshot = skuName,
            ProductTypeSnapshot = NormalizeSnapshotText(productTypeSnapshot),
            InventoryUnitSnapshot = NormalizeSnapshotText(inventoryUnitSnapshot),
            Location = location,
            QuantityBefore = before,
            QuantityDelta = delta,
            QuantityAfter = after,
            TransactionType = transactionType,
            SourceLocation = sourceLocation,
            DestinationLocation = destinationLocation,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            ReferenceCode = referenceCode,
            BatchId = batchId,
            LotCode = lotCode,
            ActorId = actorId,
            ActorName = NormalizeSnapshotText(actor?.CreatedByName),
            ActorRole = NormalizeSnapshotText(actor?.CreatedByRoleName),
            Reason = NormalizeSnapshotText(reason),
            Note = note,
            CorrelationId = referenceId.ToString(),
        };

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
                DestinationLocation = LocationWarehouse,
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
            SupplierReceiptId = null,
            SupplierReceiptCode = null,
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
            ReferenceType = ReferenceShelfReplenishment,
            ReferenceId = request.Id,
            ReferenceCode = request.RequestCode,
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

    private async Task<List<WarehouseBatch>> CreateShelfBatchesFromAllocationsAsync(
        string referenceCode,
        Guid referenceId,
        StockAdjustmentRequestItem line,
        List<StockExportBatchAllocation> allocations,
        Guid createdBy,
        CancellationToken ct)
    {
        var created = new List<WarehouseBatch>();
        foreach (var allocation in allocations)
        {
            var sourceBatch = await _batchRepo.GetByIdAsync(allocation.WarehouseBatchId, ct)
                ?? throw new InventoryValidationException("Không tìm thấy lô gốc để chuyển sang Kệ Hàng.");
            var sourceItem = sourceBatch.Items.FirstOrDefault(i => i.Id == allocation.WarehouseBatchItemId)
                ?? throw new InventoryValidationException("Không tìm thấy dòng SKU trong lô gốc.");

            var now = DateTime.UtcNow;
            var batch = new WarehouseBatch
            {
                Id = Guid.NewGuid(),
                LotCode = BuildDerivedLotCode(sourceBatch.LotCode, "SH", referenceCode, allocation.Id),
                Supplier = sourceBatch.Supplier,
                ExpiresAt = sourceBatch.ExpiresAt,
                Note = $"Chuyển Kệ Hàng từ lô {sourceBatch.LotCode} theo {referenceCode}",
                SourceType = "shelf_replenishment",
                SourceReferenceId = referenceId,
                SourceReferenceCode = referenceCode,
                Location = LocationShelf,
                ParentBatchId = sourceBatch.ParentBatchId ?? sourceBatch.Id,
                SourceBatchId = sourceBatch.Id,
                Status = "active",
                CreatedBy = createdBy,
                CreatedAt = now,
                UpdatedAt = now,
            };
            batch.Items.Add(new WarehouseBatchItem
            {
                Id = Guid.NewGuid(),
                WarehouseBatchId = batch.Id,
                SkuId = line.SkuId,
                SkuCode = line.SkuCode,
                ProductSnapshotName = line.SkuSnapshotName,
                QuantityOnHand = allocation.Quantity,
                InitialQuantity = allocation.Quantity,
                UnitCost = sourceItem.UnitCost,
                CreatedAt = now,
                UpdatedAt = now,
            });

            await _batchRepo.AddAsync(batch, ct);
            created.Add(batch);
        }

        await _batchRepo.SaveChangesAsync(ct);
        return created;
    }

    private async Task ValidateShelfReplenishmentCatalogAsync(
        IEnumerable<StockAdjustmentRequestItem> items,
        CancellationToken ct)
    {
        var skuInputs = items
            .GroupBy(item => item.SkuId)
            .Select(group => group.First())
            .ToList();
        var catalog = await _productCatalogClient.GetCatalogForVariantIdsAsync(
            skuInputs.Select(item => item.SkuId), ct);

        foreach (var item in skuInputs)
        {
            var product = catalog.FindProductByVariant(item.SkuId);
            var variant = catalog.FindVariant(item.SkuId);
            if (product is null || variant is null || !product.IsActive || !variant.IsActive
                || !string.Equals(product.ProductType, "THANH_PHAM", StringComparison.OrdinalIgnoreCase)
                || !variant.IsSellable)
            {
                throw new InventoryValidationException(
                    $"SKU {item.SkuCode} không hợp lệ cho Kệ. Chỉ SKU Thành phẩm đang hoạt động và được phép bán trên Kệ Hàng mới được đưa lên Kệ.");
            }
        }
    }

    private async Task<List<WarehouseBatch>> CreateWarehouseBatchesFromShelfAllocationsAsync(
        string referenceCode,
        Guid referenceId,
        string sourceType,
        Guid createdBy,
        List<StockExportBatchAllocation> allocations,
        CancellationToken ct)
    {
        var created = new List<WarehouseBatch>();
        foreach (var allocation in allocations)
        {
            var shelfBatch = await _batchRepo.GetByIdAsync(allocation.WarehouseBatchId, ct)
                ?? throw new InventoryValidationException("Không tìm thấy lô Kệ Hàng để hoàn về Kho.");
            var shelfItem = shelfBatch.Items.FirstOrDefault(i => i.Id == allocation.WarehouseBatchItemId)
                ?? throw new InventoryValidationException("Không tìm thấy dòng SKU trong lô Kệ Hàng.");

            var now = DateTime.UtcNow;
            var batch = new WarehouseBatch
            {
                Id = Guid.NewGuid(),
                LotCode = BuildDerivedLotCode(shelfBatch.LotCode, "WH", referenceCode, allocation.Id),
                Supplier = shelfBatch.Supplier,
                ExpiresAt = shelfBatch.ExpiresAt,
                Note = $"Hoàn Kệ Hàng về Kho từ lô {shelfBatch.LotCode} theo {referenceCode}",
                SourceType = sourceType,
                SourceReferenceId = referenceId,
                SourceReferenceCode = referenceCode,
                Location = LocationWarehouse,
                ParentBatchId = shelfBatch.ParentBatchId ?? shelfBatch.SourceBatchId ?? shelfBatch.Id,
                SourceBatchId = shelfBatch.Id,
                Status = "active",
                CreatedBy = createdBy,
                CreatedAt = now,
                UpdatedAt = now,
            };
            batch.Items.Add(new WarehouseBatchItem
            {
                Id = Guid.NewGuid(),
                WarehouseBatchId = batch.Id,
                SkuId = shelfItem.SkuId,
                SkuCode = shelfItem.SkuCode,
                ProductSnapshotName = shelfItem.ProductSnapshotName,
                QuantityOnHand = allocation.Quantity,
                InitialQuantity = allocation.Quantity,
                UnitCost = shelfItem.UnitCost,
                CreatedAt = now,
                UpdatedAt = now,
            });

            await _batchRepo.AddAsync(batch, ct);
            created.Add(batch);
        }

        await _batchRepo.SaveChangesAsync(ct);
        return created;
    }

    private async Task<List<StockExportBatchAllocation>> AllocateAndDeductBatchesAsync(
        Guid skuId,
        int quantity,
        string location,
        Guid? batchId,
        CancellationToken ct)
    {
        if (!batchId.HasValue)
            return await AllocateAndDeductBatchesFifoAsync(skuId, quantity, ct, location);

        if (quantity <= 0)
            throw new InventoryValidationException("Số lượng xuất lô phải lớn hơn 0.");

        var batch = await _batchRepo.GetByIdAsync(batchId.Value, ct)
            ?? throw new InventoryValidationException("Không tìm thấy lô được chọn.");
        if (!string.Equals(batch.Location, location, StringComparison.OrdinalIgnoreCase))
            throw new InventoryValidationException("Lô được chọn không thuộc đúng vị trí tồn kho.");
        if (batch.Status != "active")
            throw new InventoryValidationException("Lô được chọn không còn hoạt động.");

        var item = batch.Items.FirstOrDefault(i => i.SkuId == skuId)
            ?? throw new InventoryValidationException("Lô được chọn không chứa SKU cần xử lý.");
        if (item.QuantityOnHand < quantity)
            throw new InventoryValidationException($"Lô {batch.LotCode} không đủ tồn. Thiếu {quantity - item.QuantityOnHand} đơn vị.");

        item.QuantityOnHand -= quantity;
        item.UpdatedAt = DateTime.UtcNow;
        await _batchRepo.SaveChangesAsync(ct);
        await RefreshBatchStatusesAsync([batch.Id], ct);

        return
        [
            new StockExportBatchAllocation
            {
                Id = Guid.NewGuid(),
                WarehouseBatchId = batch.Id,
                WarehouseBatchItemId = item.Id,
                LotCode = batch.LotCode,
                SkuCode = item.SkuCode,
                Quantity = quantity,
            }
        ];
    }

    private static string BuildDerivedLotCode(string sourceLotCode, string movementCode, string referenceCode, Guid seed)
    {
        var suffix = seed.ToString("N")[..8].ToUpperInvariant();
        var source = NormalizeLotCode(sourceLotCode);
        var reference = NormalizeLotCode(referenceCode).Replace("-", string.Empty);
        var fixedPart = $"-{movementCode}-{reference}-{suffix}";
        var maxSourceLength = Math.Max(1, 50 - fixedPart.Length);
        if (source.Length > maxSourceLength)
            source = source[..maxSourceLength];
        return $"{source}{fixedPart}";
    }

    private static string BuildCustomerReturnLotCode(DateTime now, string returnCode, Guid skuId)
    {
        var reference = NormalizeLotCode(returnCode).Replace("-", string.Empty);
        if (reference.Length > 18)
            reference = reference[..18];
        return $"RET-{now:yyyyMMdd}-{reference}-{skuId.ToString("N")[..8].ToUpperInvariant()}";
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
        string? sourceReferenceCode = null,
        string location = LocationWarehouse,
        string? batchCode = null,
        bool preserveLotCodeCase = false,
        DateTime? manufactureDate = null,
        Guid? supplierLotSupplierId = null,
        Guid? supplierLotSkuId = null)
    {
        if (items == null || items.Count == 0)
            throw new InventoryValidationException("Lô phải có ít nhất một dòng SKU.");

        var storedLotCode = preserveLotCodeCase
            ? NormalizeSnapshotText(lotCode) ?? string.Empty
            : NormalizeLotCode(lotCode);
        if (string.IsNullOrWhiteSpace(storedLotCode))
            throw new InventoryValidationException("Mã lô là bắt buộc.");

        var normalizedBatchCode = NormalizeLotCode(batchCode ?? storedLotCode);
        if (string.IsNullOrWhiteSpace(normalizedBatchCode))
            throw new InventoryValidationException("Mã lô nội bộ là bắt buộc.");
        if (await _batchRepo.ExistsBatchCodeAsync(normalizedBatchCode, ct: ct))
            throw new InventoryValidationException($"Mã lô nội bộ '{normalizedBatchCode}' đã tồn tại.");

        var skuIds = items.Select(i => i.SkuId).ToList();
        if (skuIds.Distinct().Count() != skuIds.Count)
            throw new InventoryValidationException("Mỗi SKU chỉ xuất hiện một lần trong cùng một lô.");

        var now = DateTime.UtcNow;
        var normalizedLocation = NormalizeInventoryLocationName(location);
        if (normalizedLocation == LocationShelf)
        {
            var shelfCatalog = await _productCatalogClient.GetCatalogForVariantIdsAsync(items.Select(item => item.SkuId), ct);
            foreach (var item in items)
            {
                var product = shelfCatalog.FindProductByVariant(item.SkuId);
                var variant = shelfCatalog.FindVariant(item.SkuId);
                if (product is null || variant is null || !product.IsActive || !variant.IsActive
                    || !string.Equals(product.ProductType, "THANH_PHAM", StringComparison.OrdinalIgnoreCase))
                    throw new InventoryValidationException($"SKU {item.SkuCode} không được đặt tại Kệ.");
            }
        }
        var batch = new WarehouseBatch
        {
            Id = Guid.NewGuid(),
            BatchCode = normalizedBatchCode,
            LotCode = storedLotCode,
            Supplier = supplier?.Trim(),
            SupplierId = supplierLotSupplierId,
            SkuId = supplierLotSkuId,
            NormalizedSupplierLotCode = supplierLotSupplierId.HasValue && supplierLotSkuId.HasValue
                ? NormalizeLotCode(storedLotCode)
                : null,
            ManufactureDate = manufactureDate,
            ExpiresAt = expiresAt,
            Note = note?.Trim(),
            SourceType = sourceType?.Trim(),
            SourceReferenceId = sourceReferenceId,
            SourceReferenceCode = sourceReferenceCode?.Trim(),
            Location = normalizedLocation,
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
            if (stock != null && normalizedLocation == LocationWarehouse)
                await SyncWarehouseQtyFromBatchesAsync(stock, ct);
            else if (stock != null)
            {
                stock.QuantityOnHand = await _batchRepo.SumQuantityOnHandAsync(stock.SkuId, LocationShelf, ct);
                stock.UpdatedAt = DateTime.UtcNow;
                await _skuStockRepo.SaveChangesAsync(ct);
            }

        }

        return MapWarehouseBatch(batch);
    }

    /// <summary>
    /// Lấy lô kho cho một dòng phiếu nhập NCC.
    /// Khóa nghiệp vụ SupplierId + SkuId + mã lô NCC đã chuẩn hóa là duy nhất toàn hệ thống:
    /// nếu lô đã tồn tại từ phiếu nhập trước thì cộng dồn số lượng vào chính lô đó,
    /// không tạo lô thứ hai. Phiếu nhập, ledger và liên kết dòng phiếu vẫn được tạo riêng.
    /// </summary>
    private async Task<WarehouseBatchResponse> ResolveSupplierReceiptBatchAsync(
        SupplierReceipt receipt,
        SupplierReceiptItem item,
        CancellationToken ct)
    {
        var normalizedLot = NormalizeLotCode(item.LotCode);
        var supplierId = receipt.SupplierId;

        if (supplierId.HasValue && supplierId.Value != Guid.Empty && !string.IsNullOrWhiteSpace(normalizedLot))
        {
            var existing = await _batchRepo.FindBySupplierLotIdentityAsync(
                supplierId.Value, item.SkuId, normalizedLot, ct);
            if (existing is not null)
                return await AppendToExistingSupplierLotAsync(existing, item, ct);
        }

        return await CreateWarehouseBatchInternalAsync(
            item.LotCode,
            receipt.SupplierName,
            item.ExpiresAt,
            BuildSupplierReceiptBatchNote(receipt, item),
            [
                new CreateWarehouseBatchItemRequest(
                    item.SkuId,
                    item.SkuCode,
                    item.SkuNameSnapshot,
                    item.Quantity,
                    null)
            ],
            receipt.CreatedBy,
            ct,
            sourceType: "supplier_receipt",
            sourceReferenceId: receipt.Id,
            sourceReferenceCode: receipt.ReceiptCode,
            batchCode: BuildSupplierReceiptInternalBatchCode(item),
            preserveLotCodeCase: true,
            manufactureDate: item.ManufacturedAt,
            supplierLotSupplierId: supplierId,
            supplierLotSkuId: item.SkuId);
    }

    private async Task<WarehouseBatchResponse> AppendToExistingSupplierLotAsync(
        WarehouseBatch existing,
        SupplierReceiptItem item,
        CancellationToken ct)
    {
        if (!IsSameLotDate(existing.ManufactureDate, item.ManufacturedAt)
            || !IsSameLotDate(existing.ExpiresAt, item.ExpiresAt))
        {
            throw new InventoryValidationException(
                $"SKU {item.SkuCode} - Mã lô NCC '{item.LotCode}' đã tồn tại với Ngày SX/HSD khác. "
                + "Dữ liệu lô không nhất quán, vui lòng kiểm tra lại chứng từ nhà cung cấp.");
        }

        if (!string.Equals(existing.Location, LocationWarehouse, StringComparison.OrdinalIgnoreCase))
        {
            throw new InventoryValidationException(
                $"SKU {item.SkuCode} - Mã lô NCC '{item.LotCode}' đang nằm ngoài Kho, không thể nhập bổ sung.");
        }

        var now = DateTime.UtcNow;
        var line = existing.Items.FirstOrDefault(i => i.SkuId == item.SkuId);
        if (line is null)
        {
            line = new WarehouseBatchItem
            {
                Id = Guid.NewGuid(),
                WarehouseBatchId = existing.Id,
                SkuId = item.SkuId,
                SkuCode = item.SkuCode,
                ProductSnapshotName = item.SkuNameSnapshot,
                QuantityOnHand = 0,
                InitialQuantity = 0,
                UnitCost = null,
                CreatedAt = now,
                UpdatedAt = now,
            };
            existing.Items.Add(line);
        }

        line.QuantityOnHand += item.Quantity;
        line.InitialQuantity += item.Quantity;
        line.UpdatedAt = now;
        existing.Status = "active";
        existing.UpdatedAt = now;
        await _batchRepo.SaveChangesAsync(ct);

        var stock = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, ct);
        if (stock != null)
            await SyncWarehouseQtyFromBatchesAsync(stock, ct);

        return MapWarehouseBatch(existing);
    }

    private static bool IsSameLotDate(DateTime? left, DateTime? right)
    {
        if (left is null && right is null) return true;
        if (left is null || right is null) return false;
        return left.Value.Date == right.Value.Date;
    }

    private async Task<List<StockExportBatchAllocation>> AllocateAndDeductBatchesFifoAsync(
        Guid skuId,
        int quantity,
        CancellationToken ct,
        string location = LocationWarehouse)
    {
        if (quantity <= 0)
            throw new InventoryValidationException("Số lượng xuất lô phải lớn hơn 0.");

        var batchItems = await _batchRepo.GetAvailableItemsForSkuAsync(skuId, location, ct);
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

    private static string NormalizeLotCode(string? lotCode) =>
        (lotCode ?? string.Empty).Trim().ToUpperInvariant();

    private static string? NormalizeSnapshotText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var stripped = HtmlTagRegex.Replace(value, " ");
        var normalized = stripped.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private sealed record NormalizedSupplierReceiptItem(
        Guid SkuId,
        string SkuCode,
        string SkuNameSnapshot,
        string ProductTypeSnapshot,
        string InventoryUnitSnapshot,
        string? SubmittedUnit,
        decimal SubmittedQuantity,
        decimal DocumentQuantity,
        int Quantity,
        decimal? UnitCost,
        decimal? LineAmount,
        string LotCode,
        DateTime? ManufacturedAt,
        DateTime? ExpiresAt,
        string? QualityNote);

    private sealed record SupplierReceiptLineCheck(
        Guid SkuId,
        string? SkuCode,
        decimal SubmittedQuantity,
        decimal DocumentQuantity,
        decimal? UnitCost,
        string? LotCode,
        DateTime? ManufacturedAt,
        DateTime? ExpiresAt);

    private sealed record SupplierReceiptDocumentCheck(
        Guid? SupplierId,
        string? SupplierReference,
        string? SupplierDocumentNumber,
        DateTime? SupplierDocumentDate,
        DateTime? ReceivedDate,
        IReadOnlyList<SupplierReceiptLineCheck> Items);

    private static SupplierReceiptDocumentCheck BuildSupplierReceiptCheck(UpsertSupplierReceiptRequest request)
        => new(
            request.SupplierId,
            request.SupplierReference,
            request.SupplierDocumentNumber,
            request.SupplierDocumentDate,
            request.ReceivedDate,
            (request.Items ?? new List<SupplierReceiptItemRequest>())
                .Select(i => new SupplierReceiptLineCheck(
                    i.SkuId,
                    i.SkuCode,
                    i.ActualQuantity ?? i.SubmittedQuantity,
                    i.DocumentQuantity ?? i.ActualQuantity ?? i.SubmittedQuantity,
                    i.UnitCost,
                    i.LotCode,
                    i.ManufacturedAt,
                    i.ExpiresAt))
                .ToList());

    private static SupplierReceiptDocumentCheck BuildSupplierReceiptCheck(SupplierReceipt receipt)
        => new(
            receipt.SupplierId,
            receipt.SupplierReference,
            receipt.SupplierDocumentNumber,
            receipt.SupplierDocumentDate,
            receipt.ReceivedDate,
            receipt.Items
                .Select(i => new SupplierReceiptLineCheck(
                    i.SkuId,
                    i.SkuCode,
                    i.SubmittedQuantity,
                    i.DocumentQuantity,
                    i.UnitCost,
                    i.LotCode,
                    i.ManufacturedAt,
                    i.ExpiresAt))
                .ToList());

    private async Task ValidateSupplierReceiptDocumentAsync(
        SupplierReceiptDocumentCheck check,
        Guid? excludeReceiptId,
        CancellationToken ct)
    {
        // SupplierReference là ghi chú tham chiếu tự do, không còn kiêm vai trò Mã Nhà Cung Cấp.
        // Mã NCC lấy từ Supplier và lưu vào SupplierCodeSnapshot.
        if (check.SupplierReference is { } reference && reference.Trim().Length > 100)
            throw new InventoryValidationException("Tham chiếu NCC không được vượt quá 100 ký tự.");
        if (string.IsNullOrWhiteSpace(check.SupplierDocumentNumber))
            throw new InventoryValidationException("Số hóa đơn / chứng từ NCC không được để trống.");
        if (check.SupplierDocumentNumber.Trim().Length > 100)
            throw new InventoryValidationException("Số chứng từ không được vượt quá 100 ký tự.");
        if (!DocumentNumberRegex.IsMatch(check.SupplierDocumentNumber.Trim()))
            throw new InventoryValidationException("Số chứng từ chỉ được chứa chữ cái, số và ký tự - / .");
        if (check.SupplierDocumentDate.HasValue && check.SupplierDocumentDate.Value.Date > DateTime.UtcNow.Date)
            throw new InventoryValidationException("Ngày chứng từ không được là ngày tương lai.");
        if (check.SupplierDocumentDate.HasValue && check.ReceivedDate.HasValue
            && check.ReceivedDate.Value.Date < check.SupplierDocumentDate.Value.Date)
            throw new InventoryValidationException("Ngày nhận hàng không thể trước ngày chứng từ NCC.");

        if (check.SupplierId.HasValue)
        {
            var supplier = await _supplierRepo.GetByIdAsync(check.SupplierId.Value, ct);
            if (supplier == null || supplier.IsDeleted)
                throw new InventoryValidationException("Nhà cung cấp không tồn tại hoặc đã ngừng hoạt động.");
        }

        var duplicate = await _supplierReceiptRepo.FindDuplicateDocumentAsync(
            check.SupplierId, check.SupplierDocumentNumber, excludeReceiptId, ct);
        if (duplicate != null)
            throw new InventoryValidationException(
                $"Số chứng từ \"{check.SupplierDocumentNumber?.Trim()}\" đã được sử dụng trong phiếu {duplicate.ReceiptCode}. Kiểm tra lại để tránh nhập trùng.");

        if (check.Items.Count == 0)
            throw new InventoryValidationException("Phiếu nhập phải có ít nhất một dòng hàng.");

        var lineIdentities = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in check.Items)
        {
            if (!IsPositiveInteger(item.SubmittedQuantity))
                throw new InventoryValidationException($"Số lượng thực nhập SKU {item.SkuCode} phải là số nguyên lớn hơn 0.");
            if (!IsPositiveInteger(item.DocumentQuantity))
                throw new InventoryValidationException($"Số lượng theo chứng từ SKU {item.SkuCode} phải là số nguyên lớn hơn 0.");
            if (item.UnitCost < 0)
                throw new InventoryValidationException($"Đơn giá SKU {item.SkuCode} không được âm.");
            if (!string.IsNullOrWhiteSpace(item.LotCode) && item.LotCode.Trim().Length > 50)
                throw new InventoryValidationException($"Mã lô SKU {item.SkuCode} không được vượt quá 50 ký tự.");
            var lineIdentity = BuildSupplierReceiptLineIdentity(item.SkuId, item.LotCode);
            if (lineIdentity is not null && !lineIdentities.Add(lineIdentity))
                throw new InventoryValidationException(
                    $"SKU {item.SkuCode} bị trùng Mã lô NCC trong cùng phiếu. Gộp thành một dòng duy nhất.");
            if (item.ManufacturedAt.HasValue && item.ManufacturedAt.Value.Date > DateTime.UtcNow.Date)
                throw new InventoryValidationException($"Ngày sản xuất SKU {item.SkuCode} không được là ngày tương lai.");
            if (item.ManufacturedAt.HasValue && check.ReceivedDate.HasValue
                && item.ManufacturedAt.Value.Date > check.ReceivedDate.Value.Date)
                throw new InventoryValidationException($"Ngày sản xuất SKU {item.SkuCode} không thể sau ngày nhận hàng.");
            if (item.ExpiresAt.HasValue)
            {
                if (item.ManufacturedAt.HasValue && item.ExpiresAt.Value.Date <= item.ManufacturedAt.Value.Date)
                    throw new InventoryValidationException($"Hạn dùng SKU {item.SkuCode} phải sau ngày sản xuất.");
                if (check.ReceivedDate.HasValue && item.ExpiresAt.Value.Date <= check.ReceivedDate.Value.Date)
                    throw new InventoryValidationException($"SKU {item.SkuCode} đã hết hạn tại ngày nhận hàng. Không thể nhập kho.");
            }

            var skuStock = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, ct);
            if (skuStock == null)
                throw new InventoryValidationException($"SKU {item.SkuCode} không tồn tại trong hệ thống.");
        }
    }

    private async Task<List<NormalizedSupplierReceiptItem>> NormalizeSupplierReceiptItemsAsync(
        UpsertSupplierReceiptRequest request,
        CancellationToken ct)
    {
        if (request.Items == null || request.Items.Count == 0)
            throw new InventoryValidationException("Phiếu nhập phải có ít nhất một dòng SKU.");

        var catalog = await _productCatalogClient.GetSupplierReceiptCatalogForVariantIdsAsync(
            request.Items.Select(item => item.SkuId),
            ct);
        var normalized = new List<NormalizedSupplierReceiptItem>();
        var lineIdentities = new HashSet<string>(StringComparer.Ordinal);
        var receivedDate = request.ReceivedDate?.Date ?? DateTime.UtcNow.Date;

        foreach (var (line, index) in request.Items.Select((value, i) => (value, i)))
        {
            if (line.SkuId == Guid.Empty)
                throw new InventoryValidationException($"Dòng {index + 1}: SKU là bắt buộc.");

            var product = catalog.FindProductByVariant(line.SkuId)
                ?? throw new InventoryValidationException($"Dòng {index + 1}: SKU không tồn tại hoặc không hoạt động.");
            var variant = catalog.FindVariant(line.SkuId)
                ?? throw new InventoryValidationException($"Dòng {index + 1}: SKU không tồn tại hoặc không hoạt động.");

            if (!product.IsActive || !variant.IsActive)
                throw new InventoryValidationException($"Dòng {index + 1}: SKU {variant.SkuCode} đang ngưng hoạt động.");

            var productType = NormalizeSnapshotText(product.ProductType)?.ToUpperInvariant() ?? string.Empty;
            if (productType is not ("NGUYEN_LIEU" or "BAO_BI" or "THANH_PHAM"))
                throw new InventoryValidationException($"Dòng {index + 1}: Loại hàng {productType} không được hỗ trợ nhập nhà cung cấp.");
            if (!variant.IsPurchasable)
                throw new InventoryValidationException($"Dòng {index + 1}: SKU {variant.SkuCode} không được phép nhập từ nhà cung cấp.");

            var inventoryUnit = NormalizeSnapshotText(product.InventoryUnit);
            if (inventoryUnit is null)
                throw new InventoryValidationException($"Dòng {index + 1}: SKU {variant.SkuCode} chưa có InventoryUnit.");

            var actualQuantity = line.ActualQuantity ?? line.SubmittedQuantity;
            var documentQuantity = line.DocumentQuantity ?? actualQuantity;
            if (!IsPositiveInteger(actualQuantity) || !IsPositiveInteger(documentQuantity))
                throw new InventoryValidationException(
                    $"Dòng {index + 1}: Số lượng phải là số nguyên lớn hơn 0.");
            if (line.UnitCost < 0)
                throw new InventoryValidationException($"Dòng {index + 1}: Đơn giá không được âm.");

            var authoritativeUnit = NormalizeSnapshotText(variant.UnitName) ?? inventoryUnit;
            var quantity = NormalizeSupplierReceiptQuantity(
                actualQuantity,
                inventoryUnit,
                line.SubmittedUnit,
                index + 1);
            var lotCode = NormalizeSnapshotText(line.LotCode) ?? string.Empty;
            var lineIdentity = BuildSupplierReceiptLineIdentity(line.SkuId, lotCode);
            if (lineIdentity is not null && !lineIdentities.Add(lineIdentity))
                throw new InventoryValidationException(
                    $"Dòng {index + 1}: Trùng SKU và Mã lô NCC trong cùng phiếu. Gộp thành một dòng duy nhất.");
            if (line.ManufacturedAt.HasValue && line.ExpiresAt.HasValue
                && line.ExpiresAt.Value.Date <= line.ManufacturedAt.Value.Date)
                throw new InventoryValidationException($"Dòng {index + 1}: Hạn dùng phải sau ngày sản xuất.");
            if (line.ExpiresAt.HasValue && line.ExpiresAt.Value.Date < receivedDate)
                throw new InventoryValidationException($"Dòng {index + 1}: Hạn sử dụng không được trước ngày nhận hàng.");

            var skuName = NormalizeSnapshotText(line.SkuNameSnapshot)
                ?? NormalizeSnapshotText(variant.VariantName)
                ?? NormalizeSnapshotText(product.Name)
                ?? variant.SkuCode;

            normalized.Add(new NormalizedSupplierReceiptItem(
                line.SkuId,
                variant.SkuCode,
                skuName,
                productType,
                authoritativeUnit,
                NormalizeSnapshotText(line.SubmittedUnit),
                actualQuantity,
                documentQuantity,
                quantity,
                line.UnitCost,
                CalculateSupplierReceiptLineAmount(actualQuantity, line.UnitCost),
                lotCode,
                line.ManufacturedAt?.Date,
                line.ExpiresAt?.Date,
                NormalizeSnapshotText(line.QualityNote)));
        }

        return normalized;
    }

    private async Task ValidateSupplierReceiptItemsForApprovalAsync(
        SupplierReceipt receipt,
        CancellationToken ct,
        ProductCatalogSnapshot? catalogSnapshot = null)
    {
        if (receipt.Items.Count == 0)
            throw new InventoryValidationException("Phiếu nhập phải có ít nhất một dòng SKU.");

        var catalog = catalogSnapshot
            ?? await _productCatalogClient.GetSupplierReceiptCatalogForVariantIdsAsync(
                receipt.Items.Select(item => item.SkuId),
                ct);
        var lineIdentities = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (item, index) in receipt.Items.Select((value, i) => (value, i)))
        {
            if (item.Quantity <= 0)
                throw new InventoryValidationException($"Dòng {index + 1}: Số lượng nhập phải lớn hơn 0.");
            if (!IsPositiveInteger(item.SubmittedQuantity))
                throw new InventoryValidationException($"Dòng {index + 1}: Số lượng thực nhập phải là số nguyên lớn hơn 0.");
            if (!IsPositiveInteger(item.DocumentQuantity))
                throw new InventoryValidationException($"Dòng {index + 1}: Số lượng theo chứng từ phải là số nguyên lớn hơn 0.");
            if (!item.UnitCost.HasValue || item.UnitCost.Value <= 0)
                throw new InventoryValidationException($"Dòng {index + 1}: Đơn giá theo chứng từ phải lớn hơn 0 trước khi gửi duyệt.");
            if (item.SkuId == Guid.Empty)
                throw new InventoryValidationException($"Dòng {index + 1}: SKU là bắt buộc.");
            var product = catalog.FindProductByVariant(item.SkuId)
                ?? throw new InventoryValidationException($"Dòng {index + 1}: SKU không tồn tại hoặc capability catalog bị thiếu.");
            var variant = catalog.FindVariant(item.SkuId)
                ?? throw new InventoryValidationException($"Dòng {index + 1}: SKU không tồn tại hoặc capability catalog bị thiếu.");
            if (!product.IsActive || !variant.IsActive)
                throw new InventoryValidationException($"Dòng {index + 1}: SKU {variant.SkuCode} đang ngừng hoạt động.");
            var productType = NormalizeSnapshotText(product.ProductType)?.ToUpperInvariant() ?? string.Empty;
            if (productType is not ("NGUYEN_LIEU" or "BAO_BI" or "THANH_PHAM"))
                throw new InventoryValidationException($"Dòng {index + 1}: Loại hàng {productType} không được hỗ trợ nhập nhà cung cấp.");
            if (!variant.IsPurchasable)
                throw new InventoryValidationException($"Dòng {index + 1}: SKU {variant.SkuCode} không được phép nhập từ nhà cung cấp.");
            var lotCode = NormalizeSnapshotText(item.LotCode);
            if (string.IsNullOrWhiteSpace(lotCode))
                throw new InventoryValidationException($"Dòng {index + 1}: Mã lô NCC là bắt buộc.");
            if (!item.ManufacturedAt.HasValue)
                throw new InventoryValidationException($"Dòng {index + 1}: Ngày sản xuất là bắt buộc.");
            if (!item.ExpiresAt.HasValue)
                throw new InventoryValidationException($"Dòng {index + 1}: Hạn dùng là bắt buộc.");
            var lineIdentity = BuildSupplierReceiptLineIdentity(item.SkuId, lotCode)!;
            if (!lineIdentities.Add(lineIdentity))
                throw new InventoryValidationException(
                    $"Dòng {index + 1}: Trùng SKU và Mã lô NCC trong cùng phiếu. Gộp thành một dòng duy nhất.");
            if (item.ExpiresAt.Value.Date <= item.ManufacturedAt.Value.Date)
                throw new InventoryValidationException($"Dòng {index + 1}: Hạn dùng phải sau ngày sản xuất.");
            if (item.ExpiresAt.HasValue && item.ExpiresAt.Value.Date < receipt.ReceivedDate.Date)
                throw new InventoryValidationException($"Dòng {index + 1}: Hạn sử dụng không được trước ngày nhận hàng.");
        }
    }

    private static int NormalizeSupplierReceiptQuantity(
        decimal submittedQuantity,
        string inventoryUnit,
        string? submittedUnit,
        int lineNumber)
    {
        if (submittedQuantity <= 0)
            throw new InventoryValidationException($"Dòng {lineNumber}: Số lượng nhập phải lớn hơn 0.");

        var normalizedUnit = NormalizeUnitText(submittedUnit);
        var isGram = string.Equals(inventoryUnit, "Gram", StringComparison.OrdinalIgnoreCase);
        var multiplier = isGram && normalizedUnit == "kg" ? 1000m : 1m;
        var normalized = submittedQuantity * multiplier;

        if (normalized != Math.Truncate(normalized))
            throw new InventoryValidationException($"Dòng {lineNumber}: Số lượng sau quy đổi phải là số nguyên.");

        if (!isGram && normalizedUnit is "kg" or "g")
            throw new InventoryValidationException($"Dòng {lineNumber}: SKU đơn vị Piece không được nhập bằng kg/g.");

        if (normalized > int.MaxValue)
            throw new InventoryValidationException($"Dòng {lineNumber}: Số lượng nhập vượt giới hạn cho phép.");

        return (int)normalized;
    }

    private static string NormalizeUnitText(string? unit)
    {
        var value = unit?.Trim().ToLowerInvariant();
        return value switch
        {
            "kilogram" or "kilograms" or "kg" => "kg",
            "gram" or "grams" or "g" => "g",
            "piece" or "pieces" or "pcs" or "cai" or "cái" or "chiếc" => "piece",
            _ => value ?? string.Empty,
        };
    }

    private static string BuildSupplierReceiptBatchNote(SupplierReceipt receipt, SupplierReceiptItem item)
    {
        var parts = new List<string> { $"Phiếu nhập NCC {receipt.ReceiptCode}" };
        if (!string.IsNullOrWhiteSpace(receipt.SupplierName))
            parts.Add(receipt.SupplierName);
        if (!string.IsNullOrWhiteSpace(item.LotCode))
            parts.Add($"Mã lô NCC: {item.LotCode}");
        if (!string.IsNullOrWhiteSpace(item.QualityNote))
            parts.Add(item.QualityNote!);
        return string.Join(" - ", parts);
    }

    private static string BuildSupplierReceiptInternalBatchCode(SupplierReceiptItem item) =>
        $"SR-{item.Id:N}".ToUpperInvariant();

    private static bool IsPositiveInteger(decimal value) =>
        value > 0 && value == decimal.Truncate(value);

    /// <summary>
    /// Khóa chống trùng dòng trong cùng một phiếu nhập: SkuId + mã lô NCC đã chuẩn hóa.
    /// SupplierId không cần đưa vào vì mọi dòng trong một phiếu đều thuộc cùng một nhà cung cấp.
    /// Cố ý KHÔNG gồm ManufacturedAt/ExpiresAt: cùng lô NCC phải là một lô duy nhất,
    /// khác ngày SX/HSD là dữ liệu mâu thuẫn chứ không phải lô mới.
    /// </summary>
    private static string? BuildSupplierReceiptLineIdentity(
        Guid skuId,
        string? supplierLotCode)
    {
        var normalizedLot = NormalizeLotCode(supplierLotCode);
        if (skuId == Guid.Empty || string.IsNullOrWhiteSpace(normalizedLot))
            return null;

        return FormattableString.Invariant($"{skuId:N}|{normalizedLot}");
    }

    private static decimal? CalculateSupplierReceiptLineAmount(
        decimal actualQuantity,
        decimal? unitCost)
    {
        if (!unitCost.HasValue)
            return null;

        return Math.Round(
            actualQuantity * unitCost.Value,
            2,
            MidpointRounding.AwayFromZero);
    }

    private static decimal CalculateSupplierReceiptTotal(IEnumerable<SupplierReceiptItem> items) =>
        Math.Round(
            items.Sum(item =>
                CalculateSupplierReceiptLineAmount(item.SubmittedQuantity, item.UnitCost) ?? 0m),
            2,
            MidpointRounding.AwayFromZero);

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
        {
            if (!string.IsNullOrWhiteSpace(s.AffectedSkuCode) && !string.IsNullOrWhiteSpace(s.ComponentSkuCode))
            {
                return $"Không đủ tồn component {s.ComponentSkuCode} cho sản phẩm {s.AffectedSkuCode}. Cần {s.RequiredQuantity}, hiện có {s.AvailableQuantity}.";
            }

            return $"{s.SkuName} thiếu {s.ShortageQuantity} (cần {s.RequiredQuantity}, khả dụng {s.AvailableQuantity})";
        }));

        return $"Không đủ tồn để hoàn tất đơn. {lineText}. Nguyên liệu không đủ để đóng gói phần còn thiếu: {shortageText}. Vui lòng giảm số lượng hoặc bổ sung tồn/nguyên liệu.";
    }

    private static string ResolveBomMaterialDisplayName(CatalogBomLine bomLine, CatalogProduct materialProduct) =>
        !string.IsNullOrWhiteSpace(bomLine.ComponentVariantName)
            ? bomLine.ComponentVariantName
            : !string.IsNullOrWhiteSpace(bomLine.MaterialName)
                ? bomLine.MaterialName
                : materialProduct.Name;

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
        stock.UpdatedAt,
        // POS-04: tồn khả bán không bao giờ âm dù dữ liệu lệch.
        stock.ReservedQuantity,
        Math.Max(0, stock.QuantityOnHand - stock.ReservedQuantity));

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
            batch.BatchCode,
            batch.LotCode,
            batch.Supplier,
            batch.ExpiresAt,
            batch.Note,
            batch.SourceType,
            batch.SourceReferenceId,
            batch.SourceReferenceCode,
            batch.Location,
            batch.ParentBatchId,
            batch.SourceBatchId,
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
        slip.ReferenceType,
        slip.ReferenceId,
        slip.ReferenceCode,
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
        slip.SupplierReceiptId,
        slip.SupplierReceiptCode,
        slip.ReferenceType,
        slip.ReferenceId,
        slip.ReferenceCode,
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
                null,
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
        line.DestinationLocation,
        line.WarehouseBatchId,
        line.WarehouseBatchLotCode,
        line.ProductionOrderOutputLineId,
        line.Note,
        line.CreatedAt);

    private static StocktakeRequestResponse MapStocktakeRequest(StocktakeRequest request)
    {
        var items = request.Items
            .OrderBy(i => i.SkuCode)
            .Select(i => new StocktakeRequestItemResponse(
                i.Id,
                i.SkuId,
                i.SkuCode,
                i.SkuSnapshotName,
                i.ProductTypeSnapshot,
                i.InventoryUnitSnapshot,
                i.SystemQuantitySnapshot,
                i.ActualQuantity,
                i.Variance,
                i.ReasonCode,
                i.Note,
                i.WarehouseQtyBefore,
                i.WarehouseQtyAfter,
                i.ShelfQtyBefore,
                i.ShelfQtyAfter,
                i.StockExportSlipId,
                i.StockExportSlipCode,
                i.StockImportSlipId,
                i.StockImportSlipCode,
                i.WarehouseBatchId,
                i.WarehouseBatchLotCode))
            .ToList();

        return new StocktakeRequestResponse(
            request.Id,
            request.RequestCode,
            request.Location,
            request.CountDate,
            request.Reason,
            request.Note,
            request.Status.ToString(),
            request.CreatedBy,
            request.CreatedByName,
            request.CreatedByRoleName,
            request.CreatedAt,
            request.UpdatedAt,
            request.SubmittedBy,
            request.SubmittedAt,
            request.ReviewedBy,
            request.ReviewedByName,
            request.ReviewedByRoleName,
            request.ReviewedAt,
            request.ReviewNote,
            items.Where(i => i.Variance > 0).Sum(i => i.Variance),
            Math.Abs(items.Where(i => i.Variance < 0).Sum(i => i.Variance)),
            items.Sum(i => Math.Abs(i.Variance)),
            items);
    }

    private static InventoryLedgerEntryResponse MapLedgerEntry(InventoryLedgerEntry entry) => new(
        entry.Id,
        entry.TransactionGroupId,
        entry.OccurredAtUtc,
        entry.SkuId,
        entry.SkuCode,
        entry.SkuNameSnapshot,
        entry.ProductTypeSnapshot,
        entry.InventoryUnitSnapshot,
        entry.Location,
        entry.QuantityBefore,
        entry.QuantityDelta,
        entry.QuantityAfter,
        entry.TransactionType,
        entry.SourceLocation,
        entry.DestinationLocation,
        entry.ReferenceType,
        entry.ReferenceId,
        entry.ReferenceCode,
        entry.BatchId,
        entry.LotCode,
        entry.ActorId,
        entry.ActorName,
        entry.ActorRole,
        entry.Reason,
        entry.Note,
        entry.CorrelationId);

    private static SupplierReceiptItemResponse MapSupplierReceiptItem(SupplierReceiptItem item) => new(
        item.Id,
        item.SkuId,
        item.SkuCode,
        item.SkuNameSnapshot,
        item.ProductTypeSnapshot,
        item.InventoryUnitSnapshot,
        item.SubmittedUnit,
        item.SubmittedQuantity,
        item.Quantity,
        item.UnitCost,
        item.DocumentQuantity,
        item.SubmittedQuantity,
        CalculateSupplierReceiptLineAmount(item.SubmittedQuantity, item.UnitCost),
        item.LotCode,
        item.ManufacturedAt,
        item.ExpiresAt,
        item.ActualReceivedQuantity,
        item.QualityNote,
        item.WarehouseBatchId,
        item.WarehouseBatchLotCode,
        item.WarehouseQtyBefore,
        item.WarehouseQtyAfter,
        item.ShelfQtyBefore,
        item.ShelfQtyAfter);

    private static SupplierReceiptResponse MapSupplierReceipt(SupplierReceipt receipt)
    {
        var items = receipt.Items
            .OrderBy(i => i.SkuCode)
            .ThenBy(i => i.LotCode)
            .Select(MapSupplierReceiptItem)
            .ToList();

        return new SupplierReceiptResponse(
            receipt.Id,
            receipt.ReceiptCode,
            receipt.SupplierId,
            receipt.SupplierName,
            receipt.SupplierCodeSnapshot,
            receipt.SupplierNameSnapshot,
            receipt.SupplierReference,
            receipt.SupplierDocumentNumber,
            receipt.SupplierDocumentDate,
            receipt.DeliveredByName,
            receipt.OriginalDocumentReference,
            LocationWarehouse,
            receipt.ReceivedDate,
            receipt.Note,
            receipt.Status.ToString().ToLowerInvariant(),
            receipt.CreatedBy,
            receipt.CreatedByName,
            receipt.CreatedByRoleName,
            receipt.CreatedAt,
            receipt.UpdatedAt,
            receipt.SubmittedBy,
            receipt.SubmittedAt,
            receipt.ReviewedBy,
            receipt.ReviewedByName,
            receipt.ReviewedByRoleName,
            receipt.ReviewedAt,
            receipt.ReviewNote,
            receipt.StockImportSlipId,
            receipt.StockImportSlipCode,
            items.Sum(i => i.Quantity),
            CalculateSupplierReceiptTotal(receipt.Items),
            items);
    }

    private static ShelfReturnRequestItemResponse MapShelfReturnRequestItem(ShelfReturnRequestItem item) => new(
        item.Id,
        item.SkuId,
        item.SkuCode,
        item.SkuSnapshotName,
        item.Quantity,
        item.ShelfBatchId,
        item.ShelfLotCode,
        item.ShelfQtyBefore,
        item.ShelfQtyAfter,
        item.WarehouseQtyBefore,
        item.WarehouseQtyAfter,
        item.StockExportSlipId,
        item.StockExportSlipCode,
        item.StockImportSlipId,
        item.StockImportSlipCode,
        item.WarehouseBatchId,
        item.WarehouseBatchLotCode,
        item.Note);

    private static ShelfReturnRequestResponse MapShelfReturnRequest(ShelfReturnRequest request)
    {
        var items = request.Items
            .OrderBy(i => i.SkuCode)
            .ThenBy(i => i.ShelfLotCode)
            .Select(MapShelfReturnRequestItem)
            .ToList();

        return new ShelfReturnRequestResponse(
            request.Id,
            request.ReturnCode,
            request.ReturnMode,
            request.OriginalStockAdjustmentRequestId,
            request.OriginalStockAdjustmentRequestCode,
            request.Reason,
            request.Note,
            request.Status.ToString().ToLowerInvariant(),
            request.CreatedBy,
            request.CreatedByName,
            request.CreatedByRoleName,
            request.CreatedAt,
            request.UpdatedAt,
            request.ReviewedBy,
            request.ReviewedByName,
            request.ReviewedByRoleName,
            request.ReviewedAt,
            request.ReviewNote,
            items.Sum(i => i.Quantity),
            items);
    }

    private static SupplierReturnRequestItemResponse MapSupplierReturnRequestItem(SupplierReturnRequestItem item) => new(
        item.Id,
        item.SkuId,
        item.SkuCode,
        item.SkuSnapshotName,
        item.Quantity,
        item.WarehouseBatchId,
        item.WarehouseBatchLotCode,
        item.WarehouseQtyBefore,
        item.WarehouseQtyAfter,
        item.ShelfQtyBefore,
        item.ShelfQtyAfter,
        item.StockExportSlipId,
        item.StockExportSlipCode,
        item.Note);

    private static SupplierReturnRequestResponse MapSupplierReturnRequest(SupplierReturnRequest request)
    {
        var items = request.Items
            .OrderBy(i => i.SkuCode)
            .ThenBy(i => i.WarehouseBatchLotCode)
            .Select(MapSupplierReturnRequestItem)
            .ToList();

        return new SupplierReturnRequestResponse(
            request.Id,
            request.ReturnCode,
            request.ReturnMode,
            request.SupplierReceiptId,
            request.SupplierReceiptCode,
            request.SupplierName,
            request.SupplierReference,
            request.Reason,
            request.Note,
            request.Status.ToString().ToLowerInvariant(),
            request.CreatedBy,
            request.CreatedByName,
            request.CreatedByRoleName,
            request.CreatedAt,
            request.UpdatedAt,
            request.ReviewedBy,
            request.ReviewedByName,
            request.ReviewedByRoleName,
            request.ReviewedAt,
            request.ReviewNote,
            items.Sum(i => i.Quantity),
            items);
    }

    private static StockAdjustmentRequestItemResponse MapAdjustmentRequestItem(
        StockAdjustmentRequestItem item,
        IReadOnlyDictionary<Guid, int>? draftReservedByLine = null)
    {
        var draftReserved = 0;
        draftReservedByLine?.TryGetValue(item.Id, out draftReserved);
        var availableToTransfer = Math.Max(
            0,
            item.ApprovedQuantity - item.FulfilledQuantity - draftReserved);

        return new(
            item.Id,
            item.SkuId,
            item.SkuCode,
            item.SkuSnapshotName,
            item.QuantityDelta,
            item.QuantityOnHandSnapshot,
            item.QuantityOnHandAfter,
            item.WarehouseQuantityOnHandAfter,
            item.ExportSlipId,
            item.ExportSlip?.ExportCode,
            item.QuantityDelta,
            item.ApprovedQuantity,
            item.FulfilledQuantity,
            item.RejectedQuantity,
            item.RemainingQuantity,
            item.Status.ToString().ToLowerInvariant(),
            item.ReviewNote,
            item.RejectionReason,
            item.ClosedReason,
            draftReserved,
            availableToTransfer);
    }

    private static StockAdjustmentRequestResponse MapAdjustmentRequest(
        StockAdjustmentRequest entity,
        IReadOnlyDictionary<Guid, int>? draftReservedByLine = null)
    {
        var items = entity.Items
            .OrderBy(i => i.SkuCode)
            .Select(item => MapAdjustmentRequestItem(item, draftReservedByLine))
            .ToList();

        return new(
            entity.Id,
            entity.RequestCode,
            entity.Reason,
            entity.Status.ToString().ToLowerInvariant(),
            entity.RequestedBy,
            entity.RequestedAt,
            entity.ReviewedBy,
            entity.ReviewedAt,
            entity.ReviewNote,
            items,
            entity.Items.Sum(i => i.QuantityDelta),
            entity.Items.Sum(i => i.FulfilledQuantity),
            entity.Items.Sum(i => i.RejectedQuantity),
            entity.Items.Sum(i => i.RemainingQuantity),
            entity.RequestedByName,
            entity.RequestedByRoleName,
            entity.ReviewedByName,
            entity.ReviewedByRoleName,
            entity.Items.Sum(i => i.ApprovedQuantity),
            items.Sum(i => i.AvailableToTransferQuantity));
    }

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

    private static string NormalizeInventoryLocationName(string? value, string defaultLocation = LocationWarehouse)
    {
        if (string.IsNullOrWhiteSpace(value))
            return defaultLocation;

        var trimmed = value.Trim();
        if (string.Equals(trimmed, LocationWarehouse, StringComparison.OrdinalIgnoreCase))
            return LocationWarehouse;
        if (string.Equals(trimmed, LocationShelf, StringComparison.OrdinalIgnoreCase))
            return LocationShelf;

        throw new InventoryValidationException("Vị trí tồn kho chỉ hỗ trợ Warehouse hoặc Shelf.");
    }

    // ── Production Orders ──────────────────────────────────────────────────────

    public async Task<ProductionOrderResponse> CreateProductionOrderAsync(
        CreateProductionOrderRequest request,
        Guid userId,
        CreatorSnapshot? creator,
        CancellationToken ct = default)
    {
        var outputs = ResolveProductionOutputs(request.OutputLines);
        var materialLines = ResolveProductionMaterialLines(request.Lines);
        await ValidateProductionCatalogAsync(outputs, materialLines, ct);

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
            CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
            CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
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
                DestinationLocation = output.DestinationLocation ?? LocationWarehouse,
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

    private Task ValidateStoredProductionCatalogAsync(ProductionOrder order, CancellationToken ct) =>
        ValidateProductionCatalogAsync(
            order.OutputLines.Select(line => new ProductionOrderOutputLineInput(
                line.FinishedSkuId, line.FinishedSkuCode, line.FinishedSkuSnapshotName,
                line.PlannedQuantity, line.ExpiresAt, line.DestinationLocation)).ToList(),
            order.Lines.Select(line => new ProductionOrderLineInput(
                line.MaterialSkuId, line.MaterialSkuCode, line.MaterialSnapshotName, line.PlannedQuantity)).ToList(),
            ct);

    private async Task ValidateProductionCatalogAsync(
        List<ProductionOrderOutputLineInput> outputs,
        List<ProductionOrderLineInput> materials,
        CancellationToken ct)
    {
        // Full catalog is intentionally used here: consumer-side validation must
        // resolve every BOM component without choosing an arbitrary SKU.
        var catalog = await _productCatalogClient.GetCatalogAsync(ct);

        foreach (var output in outputs)
        {
            var product = catalog.FindProductByVariant(output.FinishedSkuId)
                ?? throw new InventoryValidationException($"SKU đầu ra {output.FinishedSkuCode} không tồn tại hoặc capability catalog bị thiếu.");
            var variant = catalog.FindVariant(output.FinishedSkuId)
                ?? throw new InventoryValidationException($"SKU đầu ra {output.FinishedSkuCode} không tồn tại hoặc capability catalog bị thiếu.");

            if (!product.IsActive || !variant.IsActive)
                throw new InventoryValidationException($"SKU đầu ra {output.FinishedSkuCode} đang ngừng hoạt động.");
            if (!string.Equals(product.ProductType, "THANH_PHAM", StringComparison.OrdinalIgnoreCase))
                throw new InventoryValidationException($"SKU {output.FinishedSkuCode} không được phép làm đầu ra sản xuất.");
            if (!variant.CanHaveBom)
                throw new InventoryValidationException($"SKU {output.FinishedSkuCode} không được phép sản xuất vì CanHaveBom=false.");
            if (variant.BomLines.Count == 0)
                throw new InventoryValidationException($"SKU {output.FinishedSkuCode} chưa có operational BOM để sản xuất.");
            if (string.Equals(output.DestinationLocation, LocationShelf, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(product.ProductType, "THANH_PHAM", StringComparison.OrdinalIgnoreCase))
                throw new InventoryValidationException($"SKU {output.FinishedSkuCode} không được đặt tại Kệ.");

            foreach (var bomLine in variant.BomLines)
            {
                if (bomLine.IsRequiredBaseComponent || bomLine.Quantity <= 0 || !bomLine.ComponentVariantId.HasValue)
                    throw new InventoryValidationException($"Operational BOM của SKU {output.FinishedSkuCode} không hợp lệ.");
                var component = catalog.FindVariant(bomLine.ComponentVariantId.Value)
                    ?? throw new InventoryValidationException($"Operational BOM của SKU {output.FinishedSkuCode} có component không resolve được.");
                var componentProduct = catalog.FindProductByVariant(component.Id)
                    ?? throw new InventoryValidationException($"Operational BOM của SKU {output.FinishedSkuCode} có component không resolve được.");
                if (!component.IsActive || !component.CanBeBomComponent
                    || !string.Equals(componentProduct.ProductType, "NGUYEN_LIEU", StringComparison.OrdinalIgnoreCase)
                       && !string.Equals(componentProduct.ProductType, "BAO_BI", StringComparison.OrdinalIgnoreCase)
                       && !string.Equals(componentProduct.ProductType, "THANH_PHAM", StringComparison.OrdinalIgnoreCase))
                    throw new InventoryValidationException($"Operational BOM của SKU {output.FinishedSkuCode} có component không hợp lệ.");
            }
        }

        foreach (var material in materials)
        {
            var product = catalog.FindProductByVariant(material.MaterialSkuId)
                ?? throw new InventoryValidationException($"SKU nguyên liệu {material.MaterialSkuCode} không tồn tại hoặc capability catalog bị thiếu.");
            var variant = catalog.FindVariant(material.MaterialSkuId)
                ?? throw new InventoryValidationException($"SKU nguyên liệu {material.MaterialSkuCode} không tồn tại hoặc capability catalog bị thiếu.");
            if (!product.IsActive || !variant.IsActive || !variant.CanBeBomComponent
                || !string.Equals(product.ProductType, "NGUYEN_LIEU", StringComparison.OrdinalIgnoreCase)
                   && !string.Equals(product.ProductType, "BAO_BI", StringComparison.OrdinalIgnoreCase)
                   && !string.Equals(product.ProductType, "THANH_PHAM", StringComparison.OrdinalIgnoreCase))
                throw new InventoryValidationException($"SKU {material.MaterialSkuCode} không được phép làm component BOM.");
        }
    }

    private static void ValidateSupplierReceiptHeaderMetadata(UpsertSupplierReceiptRequest request)
    {
        if ((request.DeliveredByName?.Trim().Length ?? 0) > 255)
            throw new InventoryValidationException("Tên người giao hàng không được vượt quá 255 ký tự.");
        if ((request.OriginalDocumentReference?.Trim().Length ?? 0) > 500)
            throw new InventoryValidationException("Chứng từ gốc / chứng từ kèm theo không được vượt quá 500 ký tự.");
        if ((request.Note?.Trim().Length ?? 0) > 500)
            throw new InventoryValidationException("Ghi chú phiếu nhập không được vượt quá 500 ký tự.");
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
                output.ExpiresAt,
                NormalizeInventoryLocationName(output.DestinationLocation)));
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

    public async Task<ProductionOrderResponse> SubmitProductionOrderAsync(
        Guid id,
        Guid userId,
        CreatorSnapshot? submitter,
        CancellationToken ct = default)
    {
        var order = await _productionOrderRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy lệnh sản xuất.");

        if (order.Status is not (ProductionOrderStatus.Draft or ProductionOrderStatus.Rejected))
            throw new InventoryValidationException("Chỉ có thể gửi duyệt lệnh đang ở trạng thái Nháp hoặc Bị từ chối.");

        ResolveCompletionOutputLines(order);
        if (order.Lines.Count == 0)
            throw new InventoryValidationException("Lệnh sản xuất phải có ít nhất một dòng nguyên liệu.");
        await ValidateStoredProductionCatalogAsync(order, ct);

        var now = DateTime.UtcNow;
        order.Status = ProductionOrderStatus.PendingApproval;
        order.SubmittedBy = userId == Guid.Empty ? null : userId;
        order.SubmittedAt = now;
        order.CreatedByName ??= NormalizeSnapshotText(submitter?.CreatedByName);
        order.CreatedByRoleName ??= NormalizeSnapshotText(submitter?.CreatedByRoleName);
        order.ReviewedBy = null;
        order.ReviewedByName = null;
        order.ReviewedByRoleName = null;
        order.ReviewedAt = null;
        order.ReviewNote = null;
        order.UpdatedAt = now;

        await _productionOrderRepo.SaveChangesAsync(ct);
        return MapProductionOrder(order);
    }

    public async Task<ProductionOrderResponse> ApproveProductionOrderAsync(
        Guid id,
        Guid reviewerId,
        CreatorSnapshot? reviewer,
        ReviewProductionOrderRequest? request,
        CancellationToken ct = default)
    {
        if (reviewerId == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người duyệt lệnh sản xuất.");

        var order = await _productionOrderRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy lệnh sản xuất.");

        if (order.Status != ProductionOrderStatus.PendingApproval)
            throw new InventoryValidationException("Chỉ có thể duyệt lệnh sản xuất đang chờ duyệt.");
        if (order.CreatedBy == reviewerId)
            throw new InventoryValidationException("Người tạo lệnh không được tự duyệt lệnh sản xuất của mình.");

        ResolveCompletionOutputLines(order);
        if (order.Lines.Count == 0)
            throw new InventoryValidationException("Lệnh sản xuất phải có ít nhất một dòng nguyên liệu.");
        await ValidateStoredProductionCatalogAsync(order, ct);

        var now = DateTime.UtcNow;
        order.Status = ProductionOrderStatus.Approved;
        order.ReviewedBy = reviewerId;
        order.ReviewedByName = NormalizeSnapshotText(reviewer?.CreatedByName);
        order.ReviewedByRoleName = NormalizeSnapshotText(reviewer?.CreatedByRoleName);
        order.ReviewedAt = now;
        order.ReviewNote = NormalizeSnapshotText(request?.Reason);
        order.UpdatedAt = now;

        await _productionOrderRepo.SaveChangesAsync(ct);
        return MapProductionOrder(order);
    }

    public async Task<ProductionOrderResponse> RejectProductionOrderAsync(
        Guid id,
        Guid reviewerId,
        CreatorSnapshot? reviewer,
        ReviewProductionOrderRequest request,
        CancellationToken ct = default)
    {
        if (reviewerId == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người duyệt lệnh sản xuất.");

        var reason = RequireProductionReviewReason(request?.Reason, "Lý do từ chối là bắt buộc.");
        var order = await _productionOrderRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy lệnh sản xuất.");

        if (order.Status != ProductionOrderStatus.PendingApproval)
            throw new InventoryValidationException("Chỉ có thể từ chối lệnh sản xuất đang chờ duyệt.");
        if (order.CreatedBy == reviewerId)
            throw new InventoryValidationException("Người tạo lệnh không được tự từ chối lệnh sản xuất của mình.");

        var now = DateTime.UtcNow;
        order.Status = ProductionOrderStatus.Rejected;
        order.ReviewedBy = reviewerId;
        order.ReviewedByName = NormalizeSnapshotText(reviewer?.CreatedByName);
        order.ReviewedByRoleName = NormalizeSnapshotText(reviewer?.CreatedByRoleName);
        order.ReviewedAt = now;
        order.ReviewNote = reason;
        order.UpdatedAt = now;

        await _productionOrderRepo.SaveChangesAsync(ct);
        return MapProductionOrder(order);
    }

    private static string RequireProductionReviewReason(string? reason, string message)
    {
        var normalized = NormalizeSnapshotText(reason);
        if (normalized == null)
            throw new InventoryValidationException(message);
        return normalized;
    }

    public async Task<ProductionOrderResponse> CompleteProductionOrderAsync(
        Guid id,
        Guid userId,
        CreatorSnapshot? creator,
        CancellationToken ct = default)
    {
        var order = await _productionOrderRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy lệnh sản xuất.");

        if (order.Status == ProductionOrderStatus.Completed)
            return MapProductionOrder(order);

        if (order.Status != ProductionOrderStatus.Approved)
            throw new InventoryValidationException("Chỉ có thể hoàn thành lệnh sản xuất đã được duyệt.");

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var now = DateTime.UtcNow;
            var materialSkuIds = new List<Guid>();
            var outputLines = ResolveCompletionOutputLines(order);
            var materialLines = order.Lines.OrderBy(l => l.MaterialSkuCode).ToList();
            if (materialLines.Count == 0)
                throw new InventoryValidationException("Lệnh sản xuất phải có ít nhất một dòng nguyên liệu.");
            await ValidateProductionCatalogAsync(
                outputLines.Select(line => new ProductionOrderOutputLineInput(
                    line.FinishedSkuId, line.FinishedSkuCode, line.FinishedSkuSnapshotName,
                    line.PlannedQuantity, line.ExpiresAt, line.DestinationLocation)).ToList(),
                materialLines.Select(line => new ProductionOrderLineInput(
                    line.MaterialSkuId, line.MaterialSkuCode, line.MaterialSnapshotName, line.PlannedQuantity)).ToList(),
                innerCt);
            foreach (var line in materialLines)
            {
                if (line.PlannedQuantity <= 0)
                    throw new InventoryValidationException($"Số lượng nguyên liệu {line.MaterialSkuCode} phải lớn hơn 0.");
            }

            var shortages = new List<string>();
            foreach (var line in materialLines)
            {
                var available = await _batchRepo.SumQuantityOnHandAsync(line.MaterialSkuId, LocationWarehouse, innerCt);
                if (available < line.PlannedQuantity)
                    shortages.Add($"{line.MaterialSkuCode}: cần {line.PlannedQuantity}, còn {available}, thiếu {line.PlannedQuantity - available}");
            }

            if (shortages.Count > 0)
                throw new InventoryValidationException($"Không đủ tồn Kho để hoàn thành lệnh sản xuất {order.ProductionCode}: {string.Join("; ", shortages)}.");

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
                ReferenceType = ReferenceProductionOrder,
                ReferenceId = order.Id,
                ReferenceCode = order.ProductionCode,
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
            var ledgerEntries = new List<InventoryLedgerEntry>();
            var transactionGroupId = Guid.NewGuid();

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

                ledgerEntries.Add(CreateLedgerEntry(
                    transactionGroupId,
                    line.MaterialSkuId,
                    line.MaterialSkuCode,
                    line.MaterialSnapshotName,
                    LocationWarehouse,
                    warehouseBefore,
                    -line.PlannedQuantity,
                    warehouseAfter,
                    TransactionProductionMaterialExport,
                    LocationWarehouse,
                    null,
                    ReferenceProductionOrder,
                    order.Id,
                    order.ProductionCode,
                    null,
                    null,
                    userId,
                    creator,
                    $"Xuất nguyên liệu cho lệnh sản xuất {order.ProductionCode}",
                    slipLine.Note));

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
                var destinationLocation = NormalizeInventoryLocationName(outputLine.DestinationLocation);
                outputLine.DestinationLocation = destinationLocation;
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
                    sourceReferenceCode: order.ProductionCode,
                    location: destinationLocation);

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
                    DestinationLocation = destinationLocation,
                    WarehouseBatchId = finishedBatch.Id,
                    WarehouseBatchLotCode = finishedBatch.LotCode,
                    ProductionOrderOutputLineId = outputLine.Id,
                    Note = $"Nhập thành phẩm từ lệnh {order.ProductionCode}",
                    CreatedAt = now,
                });

                ledgerEntries.Add(CreateLedgerEntry(
                    transactionGroupId,
                    outputLine.FinishedSkuId,
                    outputLine.FinishedSkuCode,
                    outputLine.FinishedSkuSnapshotName,
                    destinationLocation,
                    destinationLocation == LocationShelf ? finishedStoreBefore : finishedWarehouseBefore,
                    outputLine.PlannedQuantity,
                    destinationLocation == LocationShelf ? finishedStoreAfter : finishedWarehouseAfter,
                    TransactionProductionFinishedReceipt,
                    null,
                    destinationLocation,
                    ReferenceProductionOrder,
                    order.Id,
                    order.ProductionCode,
                    finishedBatch.Id,
                    finishedBatch.LotCode,
                    userId,
                    creator,
                    $"Nhập thành phẩm từ lệnh sản xuất {order.ProductionCode}",
                    outputLine.FinishedSkuCode));
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
                SupplierReceiptId = null,
                SupplierReceiptCode = null,
                ReferenceType = ReferenceProductionOrder,
                ReferenceId = order.Id,
                ReferenceCode = order.ProductionCode,
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

            if (ledgerEntries.Count > 0)
            {
                await _ledgerRepo.AddRangeAsync(ledgerEntries, innerCt);
                await _ledgerRepo.SaveChangesAsync(innerCt);
            }

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
            output.DestinationLocation = NormalizeInventoryLocationName(output.DestinationLocation);
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
        bool isAdmin,
        CreatorSnapshot? actor,
        ReviewProductionOrderRequest? request,
        CancellationToken ct = default)
    {
        var reason = RequireProductionReviewReason(request?.Reason, "Lý do hủy là bắt buộc.");
        var order = await _productionOrderRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy lệnh sản xuất.");

        if (order.Status == ProductionOrderStatus.Completed)
            throw new InventoryValidationException("Không thể hủy lệnh sản xuất đã hoàn thành.");
        if (order.Status == ProductionOrderStatus.Cancelled)
            return MapProductionOrder(order);
        if (!isAdmin && order.Status == ProductionOrderStatus.Draft && userId != order.CreatedBy)
            throw new InventoryValidationException("Chỉ người tạo hoặc Admin được hủy lệnh nháp.");

        var now = DateTime.UtcNow;
        order.Status = ProductionOrderStatus.Cancelled;
        order.ReviewedBy = userId == Guid.Empty ? null : userId;
        order.ReviewedByName = NormalizeSnapshotText(actor?.CreatedByName);
        order.ReviewedByRoleName = NormalizeSnapshotText(actor?.CreatedByRoleName);
        order.ReviewedAt = now;
        order.ReviewNote = reason;
        order.UpdatedAt = now;
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
        order.CreatedByName,
        order.CreatedByRoleName,
        order.CreatedAt,
        order.UpdatedAt,
        order.SubmittedBy,
        order.SubmittedAt,
        order.ReviewedBy,
        order.ReviewedByName,
        order.ReviewedByRoleName,
        order.ReviewedAt,
        order.ReviewNote,
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
                NormalizeInventoryLocationName(l.DestinationLocation),
                l.WarehouseBatchId,
                l.WarehouseBatchLotCode,
                l.CreatedAt))
            .ToList();

        return outputLines;
    }

    public async Task DeductMaterialsAsync(
        DeductMaterialsRequest request,
        Guid createdBy,
        CreatorSnapshot? creator,
        CancellationToken ct = default)
    {
        var itemList = (request.Items ?? [])
            .Where(i => i.SkuId != Guid.Empty && i.Quantity > 0)
            .GroupBy(i => i.SkuId)
            .Select(g =>
            {
                var first = g.First();
                return new DeductMaterialItem(
                    g.Key,
                    g.Sum(i => i.Quantity),
                    NormalizeSnapshotText(first.SkuCode),
                    NormalizeSnapshotText(first.SkuName));
            })
            .OrderBy(i => i.SkuCode ?? i.SkuName ?? i.SkuId.ToString())
            .ToList();

        if (itemList.Count == 0)
            throw new InventoryValidationException("Yeu cau tru nguyen lieu phai co it nhat mot SKU hop le.");

        var touchedSkuIds = new List<Guid>();
        await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var now = DateTime.UtcNow;
            var stockBySku = new Dictionary<Guid, SkuStock>();
            var shortages = new List<string>();

            foreach (var item in itemList)
            {
                var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(item.SkuId, innerCt)
                    ?? throw new InventoryValidationException($"Khong tim thay ton kho cho SKU {item.SkuId}.");
                var available = _inventoryOptions.SimulateWarehouse
                    ? Math.Max(0, stock.WarehouseQuantityOnHand)
                    : Math.Max(0, await _batchRepo.SumQuantityOnHandAsync(item.SkuId, LocationWarehouse, innerCt));

                if (available < item.Quantity)
                    shortages.Add($"{item.SkuCode ?? stock.SkuCode}: can {item.Quantity}, con {available}, thieu {item.Quantity - available}");

                stockBySku[item.SkuId] = stock;
            }

            if (shortages.Count > 0)
                throw new InventoryValidationException($"Khong du ton Kho de tru nguyen lieu: {string.Join("; ", shortages)}.");

            var referenceType = NormalizeSnapshotText(request.ReferenceType) ?? ReferenceCustomBundle;
            var referenceId = request.ReferenceId ?? Guid.Empty;
            var referenceCode = NormalizeSnapshotText(request.ReferenceCode) ?? referenceId.ToString();
            var note = NormalizeSnapshotText(request.Note) ?? $"Xuat nguyen lieu {referenceCode}";
            var slipId = Guid.NewGuid();
            var exportCountToday = await _exportSlipRepo.CountCreatedSinceAsync(now.Date, innerCt);
            var slipLines = new List<StockExportSlipLine>();
            var allAllocations = new List<StockExportBatchAllocation>();
            var ledgerEntries = new List<InventoryLedgerEntry>();
            var transactionGroupId = Guid.NewGuid();

            foreach (var item in itemList)
            {
                var stock = stockBySku[item.SkuId];
                var skuCode = item.SkuCode ?? stock.SkuCode;
                var skuName = item.SkuName ?? stock.SkuCode;
                var warehouseBefore = _inventoryOptions.SimulateWarehouse
                    ? stock.WarehouseQuantityOnHand
                    : await _batchRepo.SumQuantityOnHandAsync(item.SkuId, LocationWarehouse, innerCt);
                var storeBefore = stock.QuantityOnHand;
                List<StockExportBatchAllocation> allocations = [];

                if (_inventoryOptions.SimulateWarehouse)
                {
                    stock.WarehouseQuantityOnHand -= item.Quantity;
                    stock.UpdatedAt = now;
                }
                else
                {
                    allocations = await AllocateAndDeductBatchesFifoAsync(item.SkuId, item.Quantity, innerCt, LocationWarehouse);
                    await SyncWarehouseQtyFromBatchesAsync(stock, innerCt);
                }

                var warehouseAfter = stock.WarehouseQuantityOnHand;
                var slipLine = new StockExportSlipLine
                {
                    Id = Guid.NewGuid(),
                    StockExportSlipId = slipId,
                    SkuId = item.SkuId,
                    SkuCode = skuCode,
                    ProductSnapshotName = skuName,
                    Quantity = item.Quantity,
                    WarehouseQtyBefore = warehouseBefore,
                    WarehouseQtyAfter = warehouseAfter,
                    StoreQtyBefore = storeBefore,
                    StoreQtyAfter = storeBefore,
                    Note = note,
                    CreatedAt = now,
                };

                foreach (var allocation in allocations)
                {
                    allocation.StockExportSlipId = slipId;
                    allocation.StockExportSlipLineId = slipLine.Id;
                }

                slipLines.Add(slipLine);
                allAllocations.AddRange(allocations);
                touchedSkuIds.Add(item.SkuId);
                ledgerEntries.Add(CreateLedgerEntry(
                    transactionGroupId,
                    item.SkuId,
                    skuCode,
                    skuName,
                    LocationWarehouse,
                    warehouseBefore,
                    -item.Quantity,
                    warehouseAfter,
                    TransactionCustomBundleMaterialExport,
                    LocationWarehouse,
                    null,
                    referenceType,
                    referenceId,
                    referenceCode,
                    allocations.Count == 1 ? allocations[0].WarehouseBatchId : null,
                    allocations.Count == 1 ? allocations[0].LotCode : null,
                    createdBy,
                    creator,
                    note,
                    note));
            }

            var firstLine = slipLines[0];
            var exportSlip = new StockExportSlip
            {
                Id = slipId,
                ExportCode = $"PX-{now:yyyyMMdd}-{(exportCountToday + 1):D4}",
                ExportType = "custom_bundle_material_export",
                ReferenceType = referenceType,
                ReferenceId = referenceId == Guid.Empty ? null : referenceId,
                ReferenceCode = referenceCode,
                SkuId = slipLines.Count == 1 ? firstLine.SkuId : Guid.Empty,
                SkuCode = slipLines.Count == 1 ? firstLine.SkuCode : "MULTI",
                SkuSnapshotName = slipLines.Count == 1 ? firstLine.ProductSnapshotName : $"{slipLines.Count} dong nguyen lieu goi custom",
                Quantity = slipLines.Sum(l => l.Quantity),
                WarehouseQtyBefore = slipLines.Sum(l => l.WarehouseQtyBefore),
                WarehouseQtyAfter = slipLines.Sum(l => l.WarehouseQtyAfter),
                StoreQtyBefore = slipLines.Sum(l => l.StoreQtyBefore),
                StoreQtyAfter = slipLines.Sum(l => l.StoreQtyAfter),
                Note = note,
                CreatedBy = createdBy,
                CreatedById = createdBy == Guid.Empty ? null : createdBy,
                CreatedByName = NormalizeSnapshotText(creator?.CreatedByName),
                CreatedByRoleName = NormalizeSnapshotText(creator?.CreatedByRoleName),
                CreatedAt = now,
                Lines = slipLines,
            };

            await _exportSlipRepo.AddAsync(exportSlip, innerCt);
            if (allAllocations.Count > 0)
                await _exportAllocationRepo.AddRangeAsync(allAllocations, innerCt);
            if (ledgerEntries.Count > 0)
                await _ledgerRepo.AddRangeAsync(ledgerEntries, innerCt);
            await _skuStockRepo.SaveChangesAsync(innerCt);
            return true;
        }, ct);

        foreach (var skuId in touchedSkuIds.Distinct())
        {
            var stock = await _skuStockRepo.GetBySkuIdAsync(skuId, ct);
            if (stock != null && stock.WarehouseQuantityOnHand <= stock.WarehouseLowStockThreshold)
                await _eventPublisher.PublishLowStockAsync(
                    stock.SkuId, stock.SkuCode, stock.WarehouseQuantityOnHand, stock.WarehouseLowStockThreshold, ct);
        }
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

    // ---- Supplier management ----

    public async Task<PagedResponse<SupplierResponse>> GetSuppliersAsync(
        string? search, bool includeDeleted, int page, int pageSize, CancellationToken ct = default)
    {
        var (items, total) = await _supplierRepo.GetPagedAsync(search, includeDeleted, page, pageSize, ct);
        // Tuần tự: MapSupplierAsync truy vấn database nên Task.WhenAll dùng chung DbContext
        // sẽ ném "A second operation was started on this context instance".
        var responses = new List<SupplierResponse>(items.Count);
        foreach (var supplier in items)
            responses.Add(await MapSupplierAsync(supplier, ct));

        return new PagedResponse<SupplierResponse>(
            [.. responses],
            page, pageSize, total,
            (int)Math.Ceiling(total / (double)pageSize));
    }

    public async Task<SupplierResponse> GetSupplierAsync(Guid id, CancellationToken ct = default)
    {
        var supplier = await _supplierRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy nhà cung cấp.");
        return await MapSupplierAsync(supplier, ct);
    }

    public async Task<List<SupplierSimpleResponse>> GetActiveSuppliersAsync(CancellationToken ct = default)
    {
        var list = await _supplierRepo.GetActiveListAsync(ct);
        return list.Select(s => new SupplierSimpleResponse(s.Id, s.SupplierCode, s.Name, s.Phone, s.Email)).ToList();
    }

    public async Task<SupplierResponse> CreateSupplierAsync(CreateSupplierRequest request, CancellationToken ct = default)
    {
        var name = NormalizeSnapshotText(request.Name) ?? throw new InventoryValidationException("Tên nhà cung cấp không được để trống.");
        var customCode = NormalizeSupplierCodeInput(request.SupplierCode);
        var now = DateTime.UtcNow;
        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = name,
            Phone = NormalizeSnapshotText(request.Phone),
            Email = NormalizeSnapshotText(request.Email),
            Address = NormalizeSnapshotText(request.Address),
            Note = NormalizeSnapshotText(request.Note),
            IsDeleted = false,
            CreatedAt = now,
            UpdatedAt = now,
        };

        if (customCode is not null)
        {
            await AssignSupplierCodeAsync(supplier, customCode, ct);
            await _supplierRepo.AddAsync(supplier, ct);
            await _supplierRepo.SaveChangesAsync(ct);
        }
        else
        {
            await _supplierRepo.AddWithGeneratedCodeAsync(supplier, ct);
        }

        return await MapSupplierAsync(supplier, ct);
    }

    public async Task<SupplierResponse> UpdateSupplierAsync(Guid id, UpdateSupplierRequest request, CancellationToken ct = default)
    {
        var name = NormalizeSnapshotText(request.Name) ?? throw new InventoryValidationException("Tên nhà cung cấp không được để trống.");
        var supplier = await _supplierRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy nhà cung cấp.");

        var customCode = NormalizeSupplierCodeInput(request.SupplierCode);
        if (customCode is not null)
            await AssignSupplierCodeAsync(supplier, customCode, ct);

        supplier.Name = name;
        supplier.Phone = NormalizeSnapshotText(request.Phone);
        supplier.Email = NormalizeSnapshotText(request.Email);
        supplier.Address = NormalizeSnapshotText(request.Address);
        supplier.Note = NormalizeSnapshotText(request.Note);
        supplier.UpdatedAt = DateTime.UtcNow;

        await _supplierRepo.SaveChangesAsync(ct);
        return await MapSupplierAsync(supplier, ct);
    }

    public async Task<SupplierResponse> SoftDeleteSupplierAsync(Guid id, CancellationToken ct = default)
    {
        var supplier = await _supplierRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy nhà cung cấp.");
        if (supplier.IsDeleted)
            throw new InventoryValidationException("Nhà cung cấp đã bị ẩn.");

        supplier.IsDeleted = true;
        supplier.UpdatedAt = DateTime.UtcNow;
        await _supplierRepo.SaveChangesAsync(ct);
        return await MapSupplierAsync(supplier, ct);
    }

    public async Task<SupplierResponse> RestoreSupplierAsync(Guid id, CancellationToken ct = default)
    {
        var supplier = await _supplierRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy nhà cung cấp.");
        if (!supplier.IsDeleted)
            throw new InventoryValidationException("Nhà cung cấp chưa bị ẩn.");

        supplier.IsDeleted = false;
        supplier.UpdatedAt = DateTime.UtcNow;
        await _supplierRepo.SaveChangesAsync(ct);
        return await MapSupplierAsync(supplier, ct);
    }

    private async Task<SupplierResponse> MapSupplierAsync(Supplier s, CancellationToken ct)
    {
        var stats = await _supplierReceiptRepo.GetStatsBySupplierIdAsync(s.Id, ct);
        return new SupplierResponse(
            s.Id, s.SupplierCode, s.Name, s.Phone, s.Email, s.Address, s.Note, s.IsDeleted,
            s.CreatedAt, s.UpdatedAt,
            stats.Count, stats.TotalValue);
    }

    /// <summary>Trim mã người dùng nhập; chuỗi rỗng hoặc chỉ khoảng trắng coi như không nhập.</summary>
    private static string? NormalizeSupplierCodeInput(string? raw)
    {
        var trimmed = raw?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    /// <summary>
    /// Lấy snapshot Mã/Tên nhà cung cấp từ nguồn dữ liệu Supplier, không tin client.
    /// Khi phiếu không gắn SupplierId thì chỉ giữ tên tự do người dùng nhập.
    /// </summary>
    private async Task<(string? Code, string? Name)> ResolveSupplierSnapshotAsync(
        Guid? supplierId,
        string? fallbackName,
        CancellationToken ct)
    {
        if (supplierId is null || supplierId.Value == Guid.Empty)
            return (null, NormalizeSnapshotText(fallbackName));

        var supplier = await _supplierRepo.GetByIdAsync(supplierId.Value, ct)
            ?? throw new InventoryValidationException("Không tìm thấy nhà cung cấp.");

        return (supplier.SupplierCode, supplier.Name);
    }

    private static string NormalizeSupplierCodeKey(string code) => code.ToUpperInvariant();

    private async Task AssignSupplierCodeAsync(Supplier supplier, string code, CancellationToken ct)
    {
        if (code.Length > SupplierCodeMaxLength)
            throw new InventoryValidationException($"Mã Nhà Cung Cấp tối đa {SupplierCodeMaxLength} ký tự.");

        var normalized = NormalizeSupplierCodeKey(code);
        if (string.Equals(supplier.NormalizedSupplierCode, normalized, StringComparison.Ordinal))
        {
            supplier.SupplierCode = code;
            return;
        }

        if (await _supplierRepo.NormalizedCodeExistsAsync(normalized, supplier.Id, ct))
            throw new InventoryValidationException(SupplierCodeDuplicateMessage);

        supplier.SupplierCode = code;
        supplier.NormalizedSupplierCode = normalized;
    }

    // ---- Supplier product catalog (danh mục sản phẩm/nguyên liệu theo nhà cung cấp) ----

    private const int SupplierItemCodeMaxLength = 50;

    public async Task<PagedResponse<SupplierProductResponse>> GetSupplierProductsAsync(
        Guid? supplierId,
        string? search,
        string? productType,
        bool includeInactive,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;

        var (items, total) = await _supplierProductRepo.GetPagedBySupplierAsync(
            supplierId, search, productType, includeInactive, page, pageSize, ct);

        return new PagedResponse<SupplierProductResponse>(
            [.. items.Select(MapSupplierProduct)],
            page, pageSize, total,
            (int)Math.Ceiling(total / (double)pageSize));
    }

    public async Task<SupplierProductResponse> GetSupplierProductAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _supplierProductRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy sản phẩm nhà cung cấp.");
        return MapSupplierProduct(entity);
    }

    /// <summary>
    /// BR-03: danh sách nhà cung cấp đang cung ứng một SKU, sắp xếp theo giá chào tăng dần.
    /// </summary>
    public async Task<List<SupplierProductResponse>> GetSupplierProductsBySkuAsync(
        Guid skuId, CancellationToken ct = default)
    {
        var items = await _supplierProductRepo.GetBySkuIdAsync(skuId, ct);
        return [.. items.Select(MapSupplierProduct)];
    }

    /// <summary>
    /// Danh mục hàng đang cung ứng của một nhà cung cấp — dùng để lọc SKU và điền sẵn giá chào
    /// ở màn hình lập phiếu nhập (SP-10, SP-11).
    /// </summary>
    public async Task<List<SupplierProductResponse>> GetActiveSupplierProductsAsync(
        Guid supplierId, CancellationToken ct = default)
    {
        var supplier = await _supplierRepo.GetByIdAsync(supplierId, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy nhà cung cấp.");

        var items = await _supplierProductRepo.GetActiveBySupplierAsync(supplier.Id, ct);
        // Repository dùng AsNoTracking nên navigation Supplier rỗng — gán snapshot thủ công để map.
        foreach (var item in items)
            item.Supplier = supplier;

        return [.. items.Select(MapSupplierProduct)];
    }

    public async Task<SupplierProductResponse> CreateSupplierProductAsync(
        Guid supplierId,
        CreateSupplierProductRequest request,
        CreatorSnapshot actor,
        CancellationToken ct = default)
    {
        var supplier = await _supplierRepo.GetByIdAsync(supplierId, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy nhà cung cấp.");

        // BR-06: nhà cung cấp đã ẩn thì không được bổ sung mặt hàng mới.
        if (supplier.IsDeleted)
            throw new InventoryValidationException("Nhà cung cấp đang bị ẩn, không thể thêm mặt hàng.");

        if (request.SkuId == Guid.Empty)
            throw new InventoryValidationException("Vui lòng chọn SKU.");

        // BR-01: một nhà cung cấp chỉ có một bản ghi cho mỗi SKU.
        if (await _supplierProductRepo.ExistsAsync(supplier.Id, request.SkuId, null, ct))
            throw new InventoryValidationException("SKU này đã có trong danh mục của nhà cung cấp.");

        var (skuCode, skuName, productType, inventoryUnit) =
            await ResolveSupplierProductSkuSnapshotAsync(request.SkuId, ct);

        var itemCode = NormalizeSupplierItemCodeInput(request.SupplierItemCode);
        string? normalizedItemCode = null;
        if (itemCode is not null)
        {
            normalizedItemCode = NormalizeSupplierCodeKey(itemCode);
            // BR-02: mã hàng của nhà cung cấp duy nhất trong phạm vi nhà cung cấp đó.
            if (await _supplierProductRepo.NormalizedItemCodeExistsAsync(supplier.Id, normalizedItemCode, null, ct))
                throw new InventoryValidationException("Mã hàng của nhà cung cấp đã tồn tại.");
        }

        ValidateSupplierProductNumbers(request.QuotedPrice, request.MinimumOrderQuantity, request.LeadTimeDays);

        var now = DateTime.UtcNow;
        var entity = new SupplierProduct
        {
            Id = Guid.NewGuid(),
            SupplierId = supplier.Id,
            SkuId = request.SkuId,
            SkuCodeSnapshot = skuCode,
            SkuNameSnapshot = skuName,
            ProductTypeSnapshot = productType,
            InventoryUnitSnapshot = inventoryUnit,
            SupplierItemCode = itemCode,
            NormalizedSupplierItemCode = normalizedItemCode,
            SupplierItemName = NormalizeSnapshotText(request.SupplierItemName),
            QuotedPrice = request.QuotedPrice,
            MinimumOrderQuantity = request.MinimumOrderQuantity,
            LeadTimeDays = request.LeadTimeDays,
            IsPrimarySource = request.IsPrimarySource,
            Note = NormalizeSnapshotText(request.Note),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await _supplierProductRepo.AddAsync(entity, ct);

        // BR-04: mỗi SKU tối đa một nguồn cung chính.
        if (entity.IsPrimarySource)
            await _supplierProductRepo.ClearPrimarySourceAsync(entity.SkuId, entity.Id, ct);

        if (entity.QuotedPrice.HasValue)
            await AddSupplierProductPriceHistoryAsync(entity, null, entity.QuotedPrice, now, null, actor, ct);

        await _supplierProductRepo.SaveChangesAsync(ct);

        entity.Supplier = supplier;
        return MapSupplierProduct(entity);
    }

    /// <summary>
    /// SP-08: import danh mục hàng cung ứng từ Excel. Từng dòng độc lập — một dòng lỗi
    /// chỉ bị bỏ qua, các dòng còn lại vẫn được ghi (partial success).
    /// Catalog SKU tra một lần cho cả file thay vì mỗi dòng một lượt gọi ProductService.
    /// </summary>
    public async Task<SupplierProductImportResultResponse> ImportSupplierProductsAsync(
        Guid supplierId,
        ImportSupplierProductsRequest request,
        CreatorSnapshot actor,
        CancellationToken ct = default)
    {
        var supplier = await _supplierRepo.GetByIdAsync(supplierId, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy nhà cung cấp.");

        if (supplier.IsDeleted)
            throw new InventoryValidationException("Nhà cung cấp đang bị ẩn, không thể thêm mặt hàng.");

        var rows = request.Rows ?? [];
        if (rows.Count == 0)
            throw new InventoryValidationException("File không có dòng dữ liệu nào.");

        var skuIds = rows.Select(r => r.SkuId).Where(id => id != Guid.Empty).Distinct().ToList();
        var catalog = skuIds.Count == 0
            ? new ProductCatalogSnapshot([])
            : await _productCatalogClient.GetSupplierReceiptCatalogForVariantIdsAsync(skuIds, ct);

        var results = new List<SupplierProductImportRowResultResponse>(rows.Count);
        // Chặn trùng ngay trong file: SaveChanges chạy sau mỗi dòng nên query trùng thấy được
        // dòng trước, nhưng giữ HashSet để báo lỗi rõ ràng "trùng trong file" thay vì "đã tồn tại".
        var seenSkuIds = new HashSet<Guid>();
        var seenItemCodes = new HashSet<string>(StringComparer.Ordinal);
        var successCount = 0;
        var warningCount = 0;
        var failedCount = 0;

        foreach (var row in rows)
        {
            var messages = new List<string>();
            try
            {
                if (row.SkuId == Guid.Empty)
                    throw new InventoryValidationException("Không xác định được mặt hàng từ mã SKU.");

                if (!seenSkuIds.Add(row.SkuId))
                    throw new InventoryValidationException("Mã SKU bị lặp trong file.");

                if (await _supplierProductRepo.ExistsAsync(supplier.Id, row.SkuId, null, ct))
                    throw new InventoryValidationException("SKU này đã có trong danh mục của nhà cung cấp.");

                var (skuCode, skuName, productType, inventoryUnit) =
                    ResolveSupplierProductSkuSnapshot(catalog, row.SkuId);

                var itemCode = NormalizeSupplierItemCodeInput(row.SupplierItemCode);
                string? normalizedItemCode = null;
                if (itemCode is not null)
                {
                    normalizedItemCode = NormalizeSupplierCodeKey(itemCode);
                    if (!seenItemCodes.Add(normalizedItemCode))
                        throw new InventoryValidationException("Mã hàng của nhà cung cấp bị lặp trong file.");
                    if (await _supplierProductRepo.NormalizedItemCodeExistsAsync(
                            supplier.Id, normalizedItemCode, null, ct))
                        throw new InventoryValidationException("Mã hàng của nhà cung cấp đã tồn tại.");
                }

                ValidateSupplierProductNumbers(row.QuotedPrice, null, null);

                var now = DateTime.UtcNow;
                var entity = new SupplierProduct
                {
                    Id = Guid.NewGuid(),
                    SupplierId = supplier.Id,
                    SkuId = row.SkuId,
                    SkuCodeSnapshot = skuCode,
                    SkuNameSnapshot = skuName,
                    ProductTypeSnapshot = productType,
                    InventoryUnitSnapshot = inventoryUnit,
                    SupplierItemCode = itemCode,
                    NormalizedSupplierItemCode = normalizedItemCode,
                    SupplierItemName = NormalizeSnapshotText(row.SupplierItemName),
                    QuotedPrice = row.QuotedPrice,
                    IsPrimarySource = row.IsPrimarySource,
                    Note = NormalizeSnapshotText(row.Note),
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                };

                await _supplierProductRepo.AddAsync(entity, ct);

                if (entity.IsPrimarySource)
                    await _supplierProductRepo.ClearPrimarySourceAsync(entity.SkuId, entity.Id, ct);

                if (entity.QuotedPrice.HasValue)
                    await AddSupplierProductPriceHistoryAsync(entity, null, entity.QuotedPrice, now, null, actor, ct);

                await _supplierProductRepo.SaveChangesAsync(ct);

                if (!entity.QuotedPrice.HasValue)
                    messages.Add("Chưa có giá chào — cần bổ sung sau.");

                if (messages.Count > 0)
                {
                    warningCount++;
                    results.Add(new SupplierProductImportRowResultResponse(
                        row.RowNumber, skuCode, "Warning", messages));
                }
                else
                {
                    successCount++;
                    results.Add(new SupplierProductImportRowResultResponse(
                        row.RowNumber, skuCode, "Success", []));
                }
            }
            catch (Exception ex) when (ex is InventoryValidationException or InventoryNotFoundException)
            {
                failedCount++;
                results.Add(new SupplierProductImportRowResultResponse(
                    row.RowNumber, NormalizeSnapshotText(row.SkuCode), "Error", [ex.Message]));
            }
        }

        return new SupplierProductImportResultResponse(
            rows.Count, successCount, failedCount, warningCount, results);
    }

    public async Task<SupplierProductResponse> UpdateSupplierProductAsync(
        Guid id,
        UpdateSupplierProductRequest request,
        CancellationToken ct = default)
    {
        var entity = await _supplierProductRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy sản phẩm nhà cung cấp.");

        var itemCode = NormalizeSupplierItemCodeInput(request.SupplierItemCode);
        string? normalizedItemCode = null;
        if (itemCode is not null)
        {
            normalizedItemCode = NormalizeSupplierCodeKey(itemCode);
            if (await _supplierProductRepo.NormalizedItemCodeExistsAsync(
                    entity.SupplierId, normalizedItemCode, entity.Id, ct))
                throw new InventoryValidationException("Mã hàng của nhà cung cấp đã tồn tại.");
        }

        ValidateSupplierProductNumbers(null, request.MinimumOrderQuantity, request.LeadTimeDays);

        entity.SupplierItemCode = itemCode;
        entity.NormalizedSupplierItemCode = normalizedItemCode;
        entity.SupplierItemName = NormalizeSnapshotText(request.SupplierItemName);
        entity.MinimumOrderQuantity = request.MinimumOrderQuantity;
        entity.LeadTimeDays = request.LeadTimeDays;
        entity.IsPrimarySource = request.IsPrimarySource;
        entity.Note = NormalizeSnapshotText(request.Note);
        entity.UpdatedAt = DateTime.UtcNow;

        if (entity.IsPrimarySource)
            await _supplierProductRepo.ClearPrimarySourceAsync(entity.SkuId, entity.Id, ct);

        await _supplierProductRepo.SaveChangesAsync(ct);
        return MapSupplierProduct(entity);
    }

    /// <summary>
    /// SP-06: đổi giá chào. Tách khỏi UpdateSupplierProductAsync để mọi lần đổi giá đều ghi lịch sử.
    /// BR-13: giá chào chỉ là giá mua tham chiếu, tuyệt đối không ghi sang giá vốn/giá bán của SKU.
    /// </summary>
    public async Task<SupplierProductResponse> UpdateSupplierProductPriceAsync(
        Guid id,
        UpdateSupplierProductPriceRequest request,
        CreatorSnapshot actor,
        CancellationToken ct = default)
    {
        var entity = await _supplierProductRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy sản phẩm nhà cung cấp.");

        ValidateSupplierProductNumbers(request.QuotedPrice, null, null);

        var oldPrice = entity.QuotedPrice;
        var newPrice = request.QuotedPrice;
        if (oldPrice == newPrice)
            return MapSupplierProduct(entity);

        var now = DateTime.UtcNow;
        entity.QuotedPrice = newPrice;
        entity.UpdatedAt = now;

        await AddSupplierProductPriceHistoryAsync(
            entity, oldPrice, newPrice, request.EffectiveDate ?? now, request.Reason, actor, ct);

        await _supplierProductRepo.SaveChangesAsync(ct);
        return MapSupplierProduct(entity);
    }

    /// <summary>BR-10: ngừng cung cấp là ẩn mềm, giữ nguyên lịch sử phiếu nhập đã phát sinh.</summary>
    public async Task<SupplierProductResponse> DeactivateSupplierProductAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _supplierProductRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy sản phẩm nhà cung cấp.");
        if (!entity.IsActive)
            throw new InventoryValidationException("Mặt hàng đã ngừng cung cấp.");

        entity.IsActive = false;
        entity.IsPrimarySource = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _supplierProductRepo.SaveChangesAsync(ct);
        return MapSupplierProduct(entity);
    }

    public async Task<SupplierProductResponse> RestoreSupplierProductAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _supplierProductRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy sản phẩm nhà cung cấp.");
        if (entity.IsActive)
            throw new InventoryValidationException("Mặt hàng đang cung cấp bình thường.");

        // BR-06: không mở lại mặt hàng khi nhà cung cấp vẫn đang bị ẩn.
        if (entity.Supplier is { IsDeleted: true })
            throw new InventoryValidationException("Nhà cung cấp đang bị ẩn, hãy khôi phục nhà cung cấp trước.");

        entity.IsActive = true;
        entity.UpdatedAt = DateTime.UtcNow;
        await _supplierProductRepo.SaveChangesAsync(ct);
        return MapSupplierProduct(entity);
    }

    public async Task<List<SupplierProductPriceHistoryResponse>> GetSupplierProductPriceHistoryAsync(
        Guid id, CancellationToken ct = default)
    {
        _ = await _supplierProductRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy sản phẩm nhà cung cấp.");

        var history = await _supplierProductRepo.GetPriceHistoryAsync(id, ct);
        return [.. history.Select(h => new SupplierProductPriceHistoryResponse(
            h.Id, h.SupplierProductId, h.OldPrice, h.NewPrice, h.EffectiveDate,
            h.ChangedBy, h.ChangedByName, h.ChangedAt, h.Reason))];
    }

    /// <summary>
    /// BR-05: chỉ SKU đang hoạt động và được phép nhập từ nhà cung cấp mới vào được danh mục.
    /// Snapshot lấy từ ProductService qua API, không tin dữ liệu client gửi lên.
    /// </summary>
    private async Task<(string SkuCode, string SkuName, string ProductType, string InventoryUnit)>
        ResolveSupplierProductSkuSnapshotAsync(Guid skuId, CancellationToken ct)
    {
        var catalog = await _productCatalogClient.GetSupplierReceiptCatalogForVariantIdsAsync([skuId], ct);
        return ResolveSupplierProductSkuSnapshot(catalog, skuId);
    }

    /// <summary>Phần thuần kiểm tra của BR-05 — tách ra để import tra catalog một lần cho cả file.</summary>
    private static (string SkuCode, string SkuName, string ProductType, string InventoryUnit)
        ResolveSupplierProductSkuSnapshot(ProductCatalogSnapshot catalog, Guid skuId)
    {
        var product = catalog.FindProductByVariant(skuId)
            ?? throw new InventoryValidationException("SKU không tồn tại hoặc không hoạt động.");
        var variant = catalog.FindVariant(skuId)
            ?? throw new InventoryValidationException("SKU không tồn tại hoặc không hoạt động.");

        if (!product.IsActive || !variant.IsActive)
            throw new InventoryValidationException($"SKU {variant.SkuCode} đang ngưng hoạt động.");

        var productType = NormalizeSnapshotText(product.ProductType)?.ToUpperInvariant() ?? string.Empty;
        if (productType is not ("NGUYEN_LIEU" or "BAO_BI" or "THANH_PHAM"))
            throw new InventoryValidationException($"Loại hàng {productType} không được hỗ trợ nhập từ nhà cung cấp.");

        if (!variant.IsPurchasable)
            throw new InventoryValidationException($"SKU {variant.SkuCode} không được phép nhập từ nhà cung cấp.");

        var inventoryUnit = NormalizeSnapshotText(product.InventoryUnit)
            ?? throw new InventoryValidationException($"SKU {variant.SkuCode} chưa có đơn vị kho.");

        var rawVariantName = NormalizeSnapshotText(variant.VariantName);
        var rawProductName = NormalizeSnapshotText(product.Name);
        string skuName;
        if (rawVariantName != null && rawProductName != null &&
            !rawVariantName.StartsWith(rawProductName, StringComparison.OrdinalIgnoreCase))
            skuName = $"{rawProductName} - {rawVariantName}";
        else
            skuName = rawVariantName ?? rawProductName ?? variant.SkuCode;

        return (variant.SkuCode, skuName, productType, inventoryUnit);
    }

    private Task AddSupplierProductPriceHistoryAsync(
        SupplierProduct entity,
        decimal? oldPrice,
        decimal? newPrice,
        DateTime effectiveDate,
        string? reason,
        CreatorSnapshot actor,
        CancellationToken ct) =>
        _supplierProductRepo.AddPriceHistoryAsync(new SupplierProductPriceHistory
        {
            Id = Guid.NewGuid(),
            SupplierProductId = entity.Id,
            SupplierId = entity.SupplierId,
            SkuId = entity.SkuId,
            OldPrice = oldPrice,
            NewPrice = newPrice,
            EffectiveDate = effectiveDate,
            ChangedBy = actor.CreatedById == Guid.Empty ? null : actor.CreatedById,
            ChangedByName = NormalizeSnapshotText(actor.CreatedByName),
            ChangedAt = DateTime.UtcNow,
            Reason = NormalizeSnapshotText(reason),
        }, ct);

    private static string? NormalizeSupplierItemCodeInput(string? raw)
    {
        var trimmed = raw?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        if (trimmed.Length > SupplierItemCodeMaxLength)
            throw new InventoryValidationException($"Mã hàng nhà cung cấp tối đa {SupplierItemCodeMaxLength} ký tự.");
        return trimmed;
    }

    /// <summary>BR-07 giá chào phải dương khi có điền; BR-09 số lượng tối thiểu và số ngày giao không âm.</summary>
    private static void ValidateSupplierProductNumbers(decimal? quotedPrice, int? minimumOrderQuantity, int? leadTimeDays)
    {
        if (quotedPrice is <= 0m)
            throw new InventoryValidationException("Giá chào phải lớn hơn 0.");
        if (minimumOrderQuantity is < 0)
            throw new InventoryValidationException("Số lượng đặt tối thiểu không được âm.");
        if (leadTimeDays is < 0)
            throw new InventoryValidationException("Số ngày giao hàng không được âm.");
    }

    private static SupplierProductResponse MapSupplierProduct(SupplierProduct p) =>
        new(
            p.Id,
            p.SupplierId,
            p.Supplier?.SupplierCode ?? string.Empty,
            p.Supplier?.Name ?? string.Empty,
            p.SkuId,
            p.SkuCodeSnapshot,
            p.SkuNameSnapshot,
            p.ProductTypeSnapshot,
            p.InventoryUnitSnapshot,
            p.SupplierItemCode,
            p.SupplierItemName,
            p.QuotedPrice,
            p.MinimumOrderQuantity,
            p.LeadTimeDays,
            p.IsPrimarySource,
            p.Note,
            p.IsActive,
            p.CreatedAt,
            p.UpdatedAt);
}
