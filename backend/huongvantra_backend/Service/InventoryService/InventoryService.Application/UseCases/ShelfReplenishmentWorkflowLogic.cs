using HuongVanTra.Shared.Notifications;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.Interfaces;
using InventoryService.Domain.Enums;
using InventoryService.Domain.Exceptions;

namespace InventoryService.Application.UseCases;

/// <summary>
/// Luồng bổ sung Kệ Hàng tối giản theo từng dòng yêu cầu. Phiếu điều chuyển vẫn được
/// tạo nội bộ để giữ atomic, FEFO, chứng từ và ledger nhưng người dùng không phải lập phiếu.
/// </summary>
public class ShelfReplenishmentWorkflowLogic(
    IStockAdjustmentRequestRepository _requestRepo,
    IProductionOrderRepository _productionOrderRepo,
    ISkuStockRepository _skuStockRepo,
    IWarehouseBatchRepository _warehouseBatchRepo,
    IProductCatalogClient _productCatalogClient,
    INotificationClient _notificationClient,
    InventoryLogic _inventoryLogic,
    StockTransferLogic _stockTransferLogic)
{
    public async Task<ShelfReplenishmentItemProcessResponse> ProcessItemAsync(
        Guid requestId,
        Guid itemId,
        Guid actorId,
        CreatorSnapshot actor,
        CancellationToken ct = default)
    {
        if (actorId == Guid.Empty)
            throw new InventoryValidationException("Không xác định được Nhân viên kho thực hiện.");

        var request = await _requestRepo.GetByIdAsync(requestId, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Yêu cầu bổ sung Kệ Hàng.");
        var item = request.Items.SingleOrDefault(candidate => candidate.Id == itemId)
            ?? throw new InventoryNotFoundException("Không tìm thấy sản phẩm trong Yêu cầu bổ sung Kệ Hàng.");

        if (item.Status == StockAdjustmentRequestItemStatus.Fulfilled)
            return BuildResponse(request.Id, item.Id, request.RequestCode, "Hoàn tất",
                "Sản phẩm đã được bổ sung đủ lên Kệ Hàng.", item.AutoProductionOrder, []);
        if (StockAdjustmentFulfillment.IsLineClosed(item.Status))
            throw new InventoryValidationException("Sản phẩm trong yêu cầu đã kết thúc, không thể xử lý lại.");

        var existingOrder = item.AutoProductionOrder
            ?? await _productionOrderRepo.GetBySourceRequestItemIdAsync(item.Id, ct);
        if (existingOrder != null)
        {
            if (item.AutoProductionOrderId != existingOrder.Id)
            {
                item.AutoProductionOrderId = existingOrder.Id;
                item.AutoProductionOrder = existingOrder;
                item.ApprovedQuantity = item.QuantityDelta;
                item.Status = StockAdjustmentRequestItemStatus.WaitingForStock;
                item.ReviewNote = $"Đã liên kết lại Lệnh sản xuất tự động {existingOrder.ProductionCode}.";
                StockAdjustmentFulfillment.RecalculateRequestStatus(request);
                await _requestRepo.SaveChangesAsync(ct);
            }

            if (existingOrder.Status == ProductionOrderStatus.Completed)
                return await PrepareTransferForConfirmationAsync(request, item, actorId, actor, ct);

            return BuildResponse(request.Id, item.Id, request.RequestCode, "Đang sản xuất",
                $"Lệnh sản xuất {existingOrder.ProductionCode} đã được tự động tạo và đang chờ Nhân viên kho hoàn tất.",
                existingOrder, []);
        }

        var aggregateStock = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, ct);
        var finishedBatchOnHand = await _warehouseBatchRepo.SumQuantityOnHandAsync(
            item.SkuId,
            "Warehouse",
            ct);
        var finishedGoodsOnHand = Math.Max(
            0,
            Math.Min(aggregateStock?.WarehouseQuantityOnHand ?? 0, finishedBatchOnHand));
        if (finishedGoodsOnHand >= item.QuantityDelta)
        {
            item.ApprovedQuantity = item.QuantityDelta;
            item.Status = StockAdjustmentRequestItemStatus.Approved;
            StockAdjustmentFulfillment.RecalculateRequestStatus(request);
            await _requestRepo.SaveChangesAsync(ct);
            return await PrepareTransferForConfirmationAsync(request, item, actorId, actor, ct);
        }

        var shortage = item.QuantityDelta - finishedGoodsOnHand;
        var (_, checks) = await BuildAutomaticProductionRequestAsync(item, shortage, ct);
        if (checks.Any(check => check.ShortageQuantity > 0))
        {
            var shortageSummary = string.Join("; ", checks
                .Where(check => check.ShortageQuantity > 0)
                .Take(5)
                .Select(check => $"{check.SkuCode} thiếu {check.ShortageQuantity}"));
            item.ApprovedQuantity = 0;
            item.RejectedQuantity = item.QuantityDelta;
            item.RejectionReason = string.IsNullOrWhiteSpace(shortageSummary)
                ? "Không đủ Nguyên liệu/Bao bì để sản xuất đủ số lượng yêu cầu."
                : $"Không đủ Nguyên liệu/Bao bì để sản xuất đủ số lượng yêu cầu: {shortageSummary}.";
            item.Status = StockAdjustmentRequestItemStatus.Rejected;
            StockAdjustmentFulfillment.RecalculateRequestStatus(request);
            request.ReviewedBy = actorId;
            request.ReviewedByName = actor.CreatedByName;
            request.ReviewedByRoleName = actor.CreatedByRoleName;
            request.ReviewedAt = DateTime.UtcNow;
            await _requestRepo.SaveChangesAsync(ct);

            _ = _notificationClient.SendDirectAsync(
                request.RequestedBy,
                NotificationTypes.StockAdjustmentRequestRejected,
                $"{item.SkuCode} trong yêu cầu {request.RequestCode} bị từ chối vì thiếu Nguyên liệu/Bao bì",
                $"/inventory/stock-adjustment-requests/{request.Id}");

            return BuildResponse(request.Id, item.Id, request.RequestCode, "Từ chối",
                "Không đủ Nguyên liệu/Bao bì để sản xuất. Sản phẩm trong yêu cầu đã bị từ chối.", null, checks);
        }

        return await CreateAutomaticProductionOrderAsync(requestId, itemId, actorId, actor, ct);
    }

    /// <summary>
    /// Giữ endpoint cũ để tương thích client đã phát hành. Việc tạo Lệnh sản xuất hiện
    /// được thực hiện ngay tại thao tác xử lý, không còn cần một bước xác nhận riêng.
    /// </summary>
    public async Task<ShelfReplenishmentItemProcessResponse> ConfirmProductionAsync(
        Guid requestId,
        Guid itemId,
        Guid actorId,
        CreatorSnapshot actor,
        CancellationToken ct = default)
    {
        return await ProcessItemAsync(requestId, itemId, actorId, actor, ct);
    }

    /// <summary>Kiểm tra lại tồn thực tế ngay trước khi tự tạo Lệnh sản xuất.</summary>
    private async Task<ShelfReplenishmentItemProcessResponse> CreateAutomaticProductionOrderAsync(
        Guid requestId,
        Guid itemId,
        Guid actorId,
        CreatorSnapshot actor,
        CancellationToken ct)
    {
        var request = await _requestRepo.GetByIdAsync(requestId, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Yêu cầu bổ sung Kệ Hàng.");
        var item = request.Items.SingleOrDefault(candidate => candidate.Id == itemId)
            ?? throw new InventoryNotFoundException("Không tìm thấy sản phẩm trong Yêu cầu bổ sung Kệ Hàng.");
        var aggregateStock = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, ct);
        var finishedBatchOnHand = await _warehouseBatchRepo.SumQuantityOnHandAsync(item.SkuId, "Warehouse", ct);
        var finishedGoodsOnHand = Math.Max(0, Math.Min(aggregateStock?.WarehouseQuantityOnHand ?? 0, finishedBatchOnHand));
        var shortage = item.QuantityDelta - finishedGoodsOnHand;
        if (shortage <= 0)
            return await ProcessItemAsync(requestId, itemId, actorId, actor, ct);

        var (createRequest, checks) = await BuildAutomaticProductionRequestAsync(item, shortage, ct);
        if (checks.Any(check => check.ShortageQuantity > 0))
            return await ProcessItemAsync(requestId, itemId, actorId, actor, ct);

        createRequest = createRequest with
        {
            Note = $"Tự động tạo để đáp ứng {request.RequestCode} - {item.SkuCode}, phần thiếu {shortage}."
        };
        var created = await _inventoryLogic.CreateProductionOrderAsync(
            createRequest, actorId, actor, ct, request.Id, item.Id);
        var order = await _productionOrderRepo.GetByIdAsync(created.Id, ct)
            ?? throw new InventoryNotFoundException("Không tải lại được Lệnh sản xuất vừa tạo.");

        item.AutoProductionOrderId = order.Id;
        item.AutoProductionOrder = order;
        item.ApprovedQuantity = item.QuantityDelta;
        item.Status = StockAdjustmentRequestItemStatus.WaitingForStock;
        item.ReviewNote = $"Đã tự động tạo Lệnh sản xuất {order.ProductionCode} sau khi Nhân viên kho xử lý yêu cầu.";
        request.ReviewedBy = actorId;
        request.ReviewedByName = actor.CreatedByName;
        request.ReviewedByRoleName = actor.CreatedByRoleName;
        request.ReviewedAt = DateTime.UtcNow;
        StockAdjustmentFulfillment.RecalculateRequestStatus(request);
        await _requestRepo.SaveChangesAsync(ct);

        return BuildResponse(request.Id, item.Id, request.RequestCode, "Đang sản xuất",
            $"Đã tạo và lưu Lệnh sản xuất {order.ProductionCode} cho {shortage} Thành phẩm còn thiếu.", order, checks);
    }

    /// <summary>
    /// SC-05: Duyệt toàn bộ yêu cầu khi đủ Thành phẩm trên Kho. Chặn tự duyệt;
    /// kiểm tồn tất cả dòng trước khi ghi; tạo một phiếu điều chuyển rồi Complete (FEFO/atomic/slip/ledger).
    /// </summary>
    public async Task<StockAdjustmentRequestResponse> ApproveRequestAsync(
        Guid requestId,
        Guid actorId,
        CreatorSnapshot actor,
        CancellationToken ct = default)
    {
        if (actorId == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người duyệt.");

        var request = await _requestRepo.GetByIdAsync(requestId, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Yêu cầu bổ sung Kệ Hàng.");

        if (request.Status != StockAdjustmentRequestStatus.Pending)
            throw new InventoryValidationException("Chỉ có thể duyệt yêu cầu đang chờ xử lý.");

        if (request.RequestedBy == actorId)
            throw new InventoryValidationException("Người tạo yêu cầu không được tự duyệt.");

        var openLines = request.Items
            .Where(item => !StockAdjustmentFulfillment.IsLineClosed(item.Status))
            .ToList();
        if (openLines.Count == 0)
            throw new InventoryValidationException("Yêu cầu không còn dòng nào để duyệt.");

        if (openLines.Any(item =>
                item.Status != StockAdjustmentRequestItemStatus.Pending
                || item.ApprovedQuantity > 0
                || item.FulfilledQuantity > 0
                || item.AutoProductionOrderId.HasValue))
        {
            throw new InventoryValidationException(
                "Yêu cầu đã được xử lý từng dòng. Hãy dùng thao tác theo sản phẩm hoặc tạo yêu cầu mới.");
        }

        var existingTransfers = await _requestRepo.GetTransfersBySourceRequestAsync(request.Id, ct);
        if (existingTransfers.Count > 0)
            throw new InventoryValidationException("Yêu cầu đã có phiếu điều chuyển liên quan, không thể duyệt lại toàn bộ.");

        var shortages = new List<string>();
        foreach (var item in openLines)
        {
            var aggregateStock = await _skuStockRepo.GetBySkuIdAsync(item.SkuId, ct);
            var finishedBatchOnHand = await _warehouseBatchRepo.SumQuantityOnHandAsync(item.SkuId, "Warehouse", ct);
            var finishedGoodsOnHand = Math.Max(
                0,
                Math.Min(aggregateStock?.WarehouseQuantityOnHand ?? 0, finishedBatchOnHand));
            if (finishedGoodsOnHand < item.QuantityDelta)
            {
                shortages.Add(
                    $"{item.SkuCode}: cần {item.QuantityDelta}, tồn Kho {finishedGoodsOnHand}");
            }
        }

        if (shortages.Count > 0)
        {
            throw new InventoryValidationException(
                "Không đủ Thành phẩm trên Kho để duyệt toàn bộ yêu cầu. " +
                string.Join("; ", shortages.Take(8)) +
                (shortages.Count > 8 ? "…" : string.Empty));
        }

        foreach (var item in openLines)
        {
            item.ApprovedQuantity = item.QuantityDelta;
            item.Status = StockAdjustmentRequestItemStatus.Approved;
            item.ReviewNote = "Đã duyệt toàn bộ yêu cầu; hệ thống điều chuyển Kho → Kệ.";
        }

        StockAdjustmentFulfillment.RecalculateRequestStatus(request);
        request.ReviewedBy = actorId;
        request.ReviewedByName = actor.CreatedByName;
        request.ReviewedByRoleName = actor.CreatedByRoleName;
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewNote = "Đã duyệt và điều chuyển đủ lên Kệ Hàng.";
        await _requestRepo.SaveChangesAsync(ct);

        var transfer = await _stockTransferLogic.CreateAsync(
            new UpsertStockTransferRequest(
                $"Duyệt yêu cầu {request.RequestCode} — điều chuyển toàn bộ lên Kệ Hàng.",
                openLines.Select(item => new UpsertStockTransferLineRequest(
                    item.SkuId,
                    item.SkuCode,
                    item.SkuSnapshotName,
                    null,
                    item.QuantityDelta,
                    item.Id)).ToList(),
                request.Id,
                null),
            actorId,
            actor,
            ct);

        await _stockTransferLogic.CompleteAsync(transfer.TransferId, actorId, actor, ct);

        var refreshed = await _inventoryLogic.GetStockAdjustmentRequestAsync(request.Id, ct)
            ?? throw new InventoryNotFoundException("Không tải lại được yêu cầu sau khi duyệt.");

        _ = _notificationClient.SendDirectAsync(
            refreshed.RequestedBy,
            NotificationTypes.StockAdjustmentRequestReviewed,
            $"Yêu cầu {refreshed.RequestCode} đã được duyệt và bổ sung lên Kệ Hàng",
            $"/inventory/stock-adjustment-requests/{refreshed.Id}");

        return refreshed;
    }

    /// <summary>SC-05: Từ chối toàn bộ yêu cầu đang Pending — không ảnh hưởng tồn kho.</summary>
    public async Task<StockAdjustmentReviewResponse> RejectRequestAsync(
        Guid requestId,
        Guid actorId,
        CreatorSnapshot actor,
        string? reason,
        CancellationToken ct = default)
    {
        if (actorId == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người từ chối.");

        var note = reason?.Trim();
        if (string.IsNullOrWhiteSpace(note))
            throw new InventoryValidationException("Vui lòng nhập lý do từ chối.");

        var request = await _requestRepo.GetByIdAsync(requestId, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Yêu cầu bổ sung Kệ Hàng.");

        if (request.Status != StockAdjustmentRequestStatus.Pending)
            throw new InventoryValidationException("Chỉ có thể từ chối yêu cầu đang chờ xử lý.");

        if (request.RequestedBy == actorId)
            throw new InventoryValidationException("Người tạo yêu cầu không được tự từ chối để đóng vòng duyệt.");

        foreach (var item in request.Items.Where(i => !StockAdjustmentFulfillment.IsLineClosed(i.Status)))
        {
            item.ApprovedQuantity = 0;
            item.RejectedQuantity = item.QuantityDelta;
            item.RejectionReason = note;
            item.Status = StockAdjustmentRequestItemStatus.Rejected;
        }

        request.Status = StockAdjustmentRequestStatus.Rejected;
        request.ReviewedBy = actorId;
        request.ReviewedByName = actor.CreatedByName;
        request.ReviewedByRoleName = actor.CreatedByRoleName;
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewNote = note;
        await _requestRepo.SaveChangesAsync(ct);

        _ = _notificationClient.SendDirectAsync(
            request.RequestedBy,
            NotificationTypes.StockAdjustmentRequestRejected,
            $"Yêu cầu {request.RequestCode} đã bị từ chối",
            $"/inventory/stock-adjustment-requests/{request.Id}");

        return new StockAdjustmentReviewResponse(
            request.Id,
            request.RequestCode,
            request.Status.ToString().ToLowerInvariant(),
            request.ReviewedAt,
            []);
    }

    public async Task TryFulfillCompletedProductionAsync(
        Guid productionOrderId,
        Guid actorId,
        CreatorSnapshot actor,
        CancellationToken ct = default)
    {
        var order = await _productionOrderRepo.GetByIdAsync(productionOrderId, ct);
        if (order?.IsAutoGeneratedForShelfReplenishment != true
            || !order.SourceStockAdjustmentRequestId.HasValue
            || !order.SourceStockAdjustmentRequestItemId.HasValue
            || order.Status != ProductionOrderStatus.Completed)
            return;

        var request = await _requestRepo.GetByIdAsync(order.SourceStockAdjustmentRequestId.Value, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Yêu cầu bổ sung Kệ Hàng nguồn.");
        var item = request.Items.Single(candidate => candidate.Id == order.SourceStockAdjustmentRequestItemId.Value);
        await PrepareTransferForConfirmationAsync(request, item, actorId, actor, ct);
    }

    /// <summary>
    /// Tạo Phiếu điều chuyển nội bộ ở trạng thái Draft. Đây chỉ là bước chuẩn bị;
    /// tồn Kho và Kệ Hàng chưa thay đổi cho đến khi Warehouse xác nhận đã chuyển thực tế.
    /// </summary>
    private async Task<ShelfReplenishmentItemProcessResponse> PrepareTransferForConfirmationAsync(
        InventoryService.Domain.Entities.StockAdjustmentRequest request,
        InventoryService.Domain.Entities.StockAdjustmentRequestItem item,
        Guid actorId,
        CreatorSnapshot actor,
        CancellationToken ct)
    {
        var related = await _requestRepo.GetTransfersBySourceRequestAsync(request.Id, ct);
        var existing = related.FirstOrDefault(transfer =>
            transfer.Lines.Any(line => line.SourceRequestLineId == item.Id));

        if (existing == null)
        {
            var transfer = await _stockTransferLogic.CreateAsync(
                new UpsertStockTransferRequest(
                    $"Hệ thống tự động bổ sung Kệ Hàng từ {request.RequestCode}.",
                    [new UpsertStockTransferLineRequest(
                        item.SkuId, item.SkuCode, item.SkuSnapshotName, null,
                        item.QuantityDelta, item.Id)],
                    request.Id,
                    null),
                actorId,
                actor,
                ct);
            existing = related.FirstOrDefault(candidate => candidate.Id == transfer.TransferId)
                ?? await GetTransferEntityAsync(request.Id, transfer.TransferId, ct);
        }

        item.ApprovedQuantity = item.QuantityDelta;
        item.Status = StockAdjustmentRequestItemStatus.Approved;
        item.ReviewNote = "Đã chuẩn bị Phiếu điều chuyển nội bộ; chờ Nhân viên kho xác nhận đã chuyển đủ lên Kệ Hàng.";
        StockAdjustmentFulfillment.RecalculateRequestStatus(request);
        request.ReviewedBy = actorId;
        request.ReviewedByName = actor.CreatedByName;
        request.ReviewedByRoleName = actor.CreatedByRoleName;
        request.ReviewedAt = DateTime.UtcNow;
        await _requestRepo.SaveChangesAsync(ct);
        return BuildResponse(request.Id, item.Id, request.RequestCode, "Chờ xác nhận chuyển lên Kệ",
            "Đã chuẩn bị Phiếu điều chuyển nội bộ. Tồn Kho và Kệ Hàng chưa thay đổi; hãy xác nhận sau khi đã chuyển đủ hàng lên Kệ.",
            item.AutoProductionOrder, []);
    }

    /// <summary>
    /// Warehouse xác nhận việc chuyển hàng thực tế. Chỉ tại đây Phiếu điều chuyển nội bộ
    /// được hoàn tất, dẫn tới thay đổi tồn Kho/Kệ Hàng và hoàn tất dòng yêu cầu.
    /// </summary>
    public async Task<ShelfReplenishmentItemProcessResponse> ConfirmTransferAsync(
        Guid requestId,
        Guid itemId,
        Guid actorId,
        CreatorSnapshot actor,
        CancellationToken ct = default)
    {
        var request = await _requestRepo.GetByIdAsync(requestId, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Yêu cầu bổ sung Kệ Hàng.");
        var item = request.Items.SingleOrDefault(candidate => candidate.Id == itemId)
            ?? throw new InventoryNotFoundException("Không tìm thấy sản phẩm trong Yêu cầu bổ sung Kệ Hàng.");
        if (item.Status == StockAdjustmentRequestItemStatus.Fulfilled)
            return BuildResponse(request.Id, item.Id, request.RequestCode, "Hoàn tất",
                "Sản phẩm đã được bổ sung đủ lên Kệ Hàng.", item.AutoProductionOrder, []);

        var related = await _requestRepo.GetTransfersBySourceRequestAsync(request.Id, ct);
        var transfer = related.FirstOrDefault(candidate =>
            candidate.Lines.Any(line => line.SourceRequestLineId == item.Id));
        if (transfer == null)
            throw new InventoryValidationException("Chưa có Phiếu điều chuyển nội bộ để xác nhận. Hãy xử lý đủ số lượng trước.");

        await _stockTransferLogic.CompleteAsync(transfer.Id, actorId, actor, ct);
        var refreshed = await _requestRepo.GetByIdAsync(request.Id, ct) ?? request;
        var refreshedItem = refreshed.Items.Single(candidate => candidate.Id == item.Id);
        refreshed.ReviewedBy = actorId;
        refreshed.ReviewedByName = actor.CreatedByName;
        refreshed.ReviewedByRoleName = actor.CreatedByRoleName;
        refreshed.ReviewedAt = DateTime.UtcNow;
        await _requestRepo.SaveChangesAsync(ct);
        _ = _notificationClient.SendDirectAsync(
            refreshed.RequestedBy,
            NotificationTypes.StockAdjustmentRequestReviewed,
            $"{refreshedItem.SkuCode} trong yêu cầu {refreshed.RequestCode} đã được bổ sung đủ lên Kệ Hàng",
            $"/inventory/stock-adjustment-requests/{refreshed.Id}");
        return BuildResponse(refreshed.Id, refreshedItem.Id, refreshed.RequestCode, "Hoàn tất",
            "Nhân viên kho đã xác nhận chuyển đủ hàng lên Kệ. Kho giảm và Kệ Hàng tăng đủ số lượng yêu cầu.",
            refreshedItem.AutoProductionOrder, []);
    }

    private async Task<InventoryService.Domain.Entities.StockTransfer> GetTransferEntityAsync(
        Guid requestId, Guid transferId, CancellationToken ct)
    {
        var transfers = await _requestRepo.GetTransfersBySourceRequestAsync(requestId, ct);
        return transfers.Single(transfer => transfer.Id == transferId);
    }

    private async Task<(CreateProductionOrderRequest Request, List<ShelfReplenishmentMaterialCheckResponse> Checks)>
        BuildAutomaticProductionRequestAsync(
            InventoryService.Domain.Entities.StockAdjustmentRequestItem item,
            int shortage,
            CancellationToken ct)
    {
        var catalog = await _productCatalogClient.GetCatalogForVariantIdsAsync([item.SkuId], ct);
        var finished = catalog.FindVariant(item.SkuId)
            ?? throw new InventoryValidationException($"Không tìm thấy Thành phẩm {item.SkuCode} để kiểm tra khả năng sản xuất.");
        if (!finished.CanHaveBom || finished.BomLines.Count == 0)
            return (EmptyProductionRequest(item, shortage),
                [new ShelfReplenishmentMaterialCheckResponse(
                    item.SkuId, item.SkuCode, "Công thức sản xuất Thành phẩm", 1, 0, 1, "Thiếu")]);

        var materialLines = new List<ProductionOrderLineInput>();
        var checks = new List<ShelfReplenishmentMaterialCheckResponse>();
        foreach (var bom in finished.BomLines)
        {
            if (!bom.ComponentVariantId.HasValue || bom.Quantity <= 0 || bom.IsRequiredBaseComponent)
            {
                checks.Add(new ShelfReplenishmentMaterialCheckResponse(
                    item.SkuId, item.SkuCode, bom.MaterialName, 1, 0, 1, "Thiếu"));
                continue;
            }

            var component = catalog.FindVariant(bom.ComponentVariantId.Value);
            if (component == null)
            {
                checks.Add(new ShelfReplenishmentMaterialCheckResponse(
                    bom.ComponentVariantId.Value, bom.ComponentSkuCode ?? "—", bom.MaterialName, 1, 0, 1, "Thiếu"));
                continue;
            }

            var required = checked((int)Math.Ceiling(bom.Quantity * shortage));
            var available = Math.Max(
                0,
                await _warehouseBatchRepo.SumQuantityOnHandAsync(component.Id, "Warehouse", ct));
            checks.Add(new ShelfReplenishmentMaterialCheckResponse(
                component.Id, component.SkuCode, bom.MaterialName, required, available,
                Math.Max(0, required - available), available >= required ? "Đủ" : "Thiếu"));
            materialLines.Add(new ProductionOrderLineInput(
                component.Id, component.SkuCode, bom.MaterialName, required));
        }

        return (new CreateProductionOrderRequest(
                $"Tự động tạo để bổ sung {item.SkuCode} lên Kệ Hàng.",
                [new ProductionOrderOutputLineInput(
                    item.SkuId, item.SkuCode, item.SkuSnapshotName, shortage, null, "Warehouse")],
                materialLines),
            checks);
    }

    private static CreateProductionOrderRequest EmptyProductionRequest(
        InventoryService.Domain.Entities.StockAdjustmentRequestItem item, int shortage) =>
        new(null,
            [new ProductionOrderOutputLineInput(item.SkuId, item.SkuCode, item.SkuSnapshotName, shortage)],
            []);

    private static ShelfReplenishmentItemProcessResponse BuildResponse(
        Guid requestId,
        Guid itemId,
        string requestCode,
        string status,
        string message,
        InventoryService.Domain.Entities.ProductionOrder? order,
        List<ShelfReplenishmentMaterialCheckResponse> checks) =>
        new(requestId, itemId, requestCode, status, message, order?.Id, order?.ProductionCode,
            order?.Status.ToString(), checks);
}
