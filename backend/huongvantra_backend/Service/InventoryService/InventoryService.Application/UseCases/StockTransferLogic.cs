using System.Diagnostics.CodeAnalysis;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Domain.Exceptions;

namespace InventoryService.Application.UseCases;

public class StockTransferLogic(
    IStockTransferRepository _transferRepo,
    IStockAdjustmentRequestRepository _adjustmentRequestRepo,
    ISkuStockRepository _skuStockRepo,
    IWarehouseBatchRepository _batchRepo,
    IStockExportSlipRepository _exportSlipRepo,
    IStockImportSlipRepository _importSlipRepo,
    IInventoryLedgerRepository _ledgerRepo,
    IProductCatalogClient _productCatalogClient,
    IInventoryUnitOfWork _unitOfWork)
{
    private const string LocationWarehouse = "Warehouse";
    private const string LocationShelf = "Shelf";
    private const string TransferType = "warehouse_to_shelf_transfer";
    private const string ReferenceType = "StockTransfer";
    private const string LedgerWarehouseOut = "STOCK_TRANSFER_WAREHOUSE_OUT";
    private const string LedgerShelfIn = "STOCK_TRANSFER_SHELF_IN";

    public async Task<PagedResponse<StockTransferResponse>> GetPagedAsync(
        string? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default,
        Guid? sourceRequestId = null,
        string? transferType = null,
        Guid? createdBy = null,
        DateTime? fromDateUtc = null,
        DateTime? toDateUtc = null,
        string? sort = null)
    {
        StockTransferStatus? parsedStatus = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<StockTransferStatus>(status, true, out var value)
                || !Enum.IsDefined(value))
                throw new InventoryValidationException("Trạng thái Phiếu điều chuyển không hợp lệ.");
            parsedStatus = value;
        }

        if (fromDateUtc.HasValue && toDateUtc.HasValue && toDateUtc.Value <= fromDateUtc.Value)
            throw new InventoryValidationException("Khoảng thời gian không hợp lệ: ngày kết thúc phải sau ngày bắt đầu.");

        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 50);
        var (items, totalCount) = await _transferRepo.GetPagedAsync(
            parsedStatus,
            search,
            safePage,
            safePageSize,
            ct,
            sourceRequestId,
            transferType,
            createdBy,
            fromDateUtc,
            toDateUtc,
            sort);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)safePageSize));
        return new PagedResponse<StockTransferResponse>(
            items.Select(transfer => Map(transfer)).ToList(), safePage, safePageSize, totalCount, totalPages);
    }

    public async Task<StockTransferResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var transfer = await _transferRepo.GetByIdAsync(id, ct);
        return transfer is null ? null : Map(transfer);
    }

    public async Task<StockTransferResponse> CreateAsync(
        UpsertStockTransferRequest request,
        Guid actorId,
        CreatorSnapshot? actor,
        CancellationToken ct = default)
    {
        EnsureActor(actorId);
        var normalizedLines = await ValidateAndNormalizeLinesAsync(request.Lines, ct);
        var sourceRequest = await ValidateSourceRequestAsync(
            request.SourceRequestId, normalizedLines, null, ct);
        var now = DateTime.UtcNow;
        var id = Guid.NewGuid();
        var transfer = new StockTransfer
        {
            Id = id,
            TransferCode = $"DC-{now:yyyyMMddHHmmss}-{id.ToString("N")[..6].ToUpperInvariant()}",
            SourceLocation = LocationWarehouse,
            DestinationLocation = LocationShelf,
            Status = StockTransferStatus.Draft,
            Note = NormalizeText(request.Note),
            SourceRequestId = sourceRequest?.Id,
            CreatedBy = actorId,
            CreatedByName = NormalizeText(actor?.CreatedByName),
            CreatedByRoleName = NormalizeText(actor?.CreatedByRoleName),
            CreatedAt = now,
            UpdatedAt = now,
        };
        AddLines(transfer, normalizedLines, now);

        await _transferRepo.AddAsync(transfer, ct);
        await _transferRepo.SaveChangesAsync(ct);
        transfer.SourceRequest = sourceRequest;
        return Map(transfer);
    }

    public Task<StockTransferResponse> UpdateAsync(
        Guid id,
        UpsertStockTransferRequest request,
        Guid actorId,
        CancellationToken ct = default)
    {
        EnsureActor(actorId);
        return UpdateInternalAsync(id, request, ct);
    }

    private async Task<StockTransferResponse> UpdateInternalAsync(
        Guid id,
        UpsertStockTransferRequest request,
        CancellationToken ct)
    {
        var existing = await _transferRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Phiếu điều chuyển.");
        // Phiếu đã gắn yêu cầu nguồn thì bị ràng buộc vĩnh viễn vào yêu cầu đó: không đổi sang
        // yêu cầu khác, không chuyển thành phiếu trực tiếp, và ngược lại phiếu trực tiếp không
        // được gắn yêu cầu nguồn khi sửa.
        var requestedSourceId = request.SourceRequestId == Guid.Empty ? null : request.SourceRequestId;
        if (existing.SourceRequestId != requestedSourceId)
        {
            throw new InventoryValidationException(
                existing.SourceRequestId is null
                    ? "Phiếu điều chuyển trực tiếp không thể chuyển thành phiếu tạo từ yêu cầu."
                    : "Không thể đổi Yêu cầu bổ sung Kệ Hàng nguồn của Phiếu điều chuyển.");
        }

        var normalizedLines = await ValidateAndNormalizeLinesAsync(request.Lines, ct);
        var sourceRequest = await ValidateSourceRequestAsync(
            request.SourceRequestId, normalizedLines, id, ct);
        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var now = DateTime.UtcNow;
            if (!await _transferRepo.TryLockDraftForUpdateAsync(id, now, innerCt))
            {
                var current = await _transferRepo.GetByIdAsync(id, innerCt)
                    ?? throw new InventoryNotFoundException("Không tìm thấy Phiếu điều chuyển.");
                throw new InventoryValidationException(
                    current.Status == StockTransferStatus.Draft
                        ? "Không thể khóa Phiếu điều chuyển để cập nhật."
                        : "Chỉ được sửa Phiếu điều chuyển ở trạng thái Draft.");
            }

            var transfer = await _transferRepo.GetTrackedByIdAsync(id, innerCt)
                ?? throw new InventoryNotFoundException("Không tìm thấy Phiếu điều chuyển.");
            transfer.Note = NormalizeText(request.Note);
            transfer.SourceRequestId = sourceRequest?.Id;
            transfer.UpdatedAt = now;
            transfer.Lines.Clear();
            var replacementLines = AddLines(transfer, normalizedLines, now);
            // Dòng mới có khóa chính gán sẵn nên phải Add tường minh, nếu không EF Core sinh UPDATE
            // trên dòng chưa tồn tại giống lỗi của luồng hoàn tất.
            await _transferRepo.AddLinesAsync(replacementLines, innerCt);
            await _transferRepo.SaveChangesAsync(innerCt);
            return Map(transfer);
        }, ct);
    }

    /// <summary>
    /// Kiểm tra liên kết Yêu cầu bổ sung Kệ Hàng: dòng nguồn hợp lệ, không vượt số lượng còn lại,
    /// và tổng số lượng của các Phiếu điều chuyển Draft khác cũng không làm vượt số lượng yêu cầu.
    /// </summary>
    private async Task<StockAdjustmentRequest?> ValidateSourceRequestAsync(
        Guid? sourceRequestId,
        List<NormalizedTransferLine> lines,
        Guid? excludeTransferId,
        CancellationToken ct)
    {
        var referencedLineIds = lines
            .Where(line => line.SourceRequestLineId.HasValue)
            .Select(line => line.SourceRequestLineId!.Value)
            .ToList();

        if (sourceRequestId is null || sourceRequestId == Guid.Empty)
        {
            if (referencedLineIds.Count > 0)
            {
                throw new InventoryValidationException(
                    "Dòng điều chuyển tham chiếu Yêu cầu bổ sung Kệ Hàng nhưng phiếu chưa gắn yêu cầu nguồn.");
            }
            return null;
        }

        var request = await _adjustmentRequestRepo.GetByIdAsync(sourceRequestId!.Value, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Yêu cầu bổ sung Kệ Hàng nguồn.");

        if (StockAdjustmentFulfillment.IsClosed(request.Status))
            throw new InventoryValidationException("Yêu cầu bổ sung Kệ Hàng đã kết thúc, không thể tạo thêm Phiếu điều chuyển.");

        if (referencedLineIds.Count != referencedLineIds.Distinct().Count())
            throw new InventoryValidationException("Mỗi dòng yêu cầu chỉ được tham chiếu một lần trong Phiếu điều chuyển.");

        if (lines.Any(line => !line.SourceRequestLineId.HasValue))
            throw new InventoryValidationException("Phiếu điều chuyển gắn yêu cầu nguồn phải khai báo dòng yêu cầu cho mọi dòng SKU.");

        var draftQuantities = await _transferRepo.GetDraftQuantitiesBySourceRequestAsync(
            request.Id, excludeTransferId, ct);

        foreach (var line in lines)
        {
            var requestLine = request.Items.FirstOrDefault(item => item.Id == line.SourceRequestLineId!.Value)
                ?? throw new InventoryValidationException(
                    $"Dòng yêu cầu của SKU {line.SkuCode} không thuộc Yêu cầu bổ sung Kệ Hàng này.");

            if (requestLine.SkuId != line.SkuId)
                throw new InventoryValidationException($"SKU {line.SkuCode} không khớp dòng yêu cầu nguồn.");

            if (StockAdjustmentFulfillment.IsLineClosed(requestLine.Status))
                throw new InventoryValidationException($"Dòng yêu cầu của SKU {line.SkuCode} đã kết thúc, không thể điều chuyển thêm.");

            draftQuantities.TryGetValue(requestLine.Id, out var otherDraftQuantity);
            // Availability dựa trên số lượng Thủ kho đã duyệt, không dùng RemainingQuantity
            // (RemainingQuantity dẫn xuất từ số lượng yêu cầu ban đầu nên rộng hơn phần được duyệt).
            var allowed = requestLine.ApprovedQuantity - requestLine.FulfilledQuantity - otherDraftQuantity;
            if (line.Quantity > allowed)
            {
                throw new InventoryValidationException(
                    $"Số lượng điều chuyển của SKU {line.SkuCode} vượt quá số lượng có thể điều chuyển của yêu cầu " +
                    $"(đã duyệt {requestLine.ApprovedQuantity}, đã điều chuyển {requestLine.FulfilledQuantity}, " +
                    $"đang nằm trên phiếu nháp khác {otherDraftQuantity}).");
            }
        }

        return request;
    }

    public async Task<StockTransferResponse> CancelAsync(
        Guid id,
        CancelStockTransferRequest request,
        Guid actorId,
        CancellationToken ct = default)
    {
        EnsureActor(actorId);
        var reason = NormalizeText(request.Reason);
        if (reason is null)
            throw new InventoryValidationException("Vui lòng nhập lý do hủy Phiếu điều chuyển.");

        var cancelledAt = DateTime.UtcNow;
        if (!await _transferRepo.TryCancelDraftAsync(id, actorId, cancelledAt, reason, ct))
        {
            var current = await _transferRepo.GetByIdAsync(id, ct)
                ?? throw new InventoryNotFoundException("Không tìm thấy Phiếu điều chuyển.");
            throw new InventoryValidationException(
                current.Status == StockTransferStatus.Completed
                    ? "Phiếu điều chuyển đã hoàn tất, không thể hủy."
                    : "Phiếu điều chuyển đã hủy hoặc không còn ở trạng thái Draft.");
        }

        var cancelled = await _transferRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Phiếu điều chuyển sau khi hủy.");
        return Map(cancelled);
    }

    public async Task<StockTransferResponse> CompleteAsync(
        Guid id,
        Guid actorId,
        CreatorSnapshot? actor,
        CancellationToken ct = default)
    {
        EnsureActor(actorId);

        // HTTP Product catalog call stays outside the Inventory transaction. It is repeated at
        // completion immediately before the DB-backed state claim and any stock mutation.
        var candidate = await _transferRepo.GetByIdAsync(id, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Phiếu điều chuyển.");
        if (candidate.Status == StockTransferStatus.Completed)
            return Map(candidate);
        if (candidate.Status == StockTransferStatus.Cancelled)
            throw new InventoryValidationException("Phiếu điều chuyển đã hủy, không thể hoàn tất.");
        await ValidateExistingLinesAsync(candidate.Lines, ct);

        return await _unitOfWork.ExecuteInTransactionAsync(async innerCt =>
        {
            var now = DateTime.UtcNow;
            var claimed = await _transferRepo.TryClaimDraftForCompletionAsync(id, now, innerCt);
            if (!claimed)
            {
                var current = await _transferRepo.GetByIdAsync(id, innerCt)
                    ?? throw new InventoryNotFoundException("Không tìm thấy Phiếu điều chuyển.");
                if (current.Status == StockTransferStatus.Completed)
                    return Map(current);
                throw new InventoryValidationException("Phiếu điều chuyển đã hủy hoặc không còn ở trạng thái Draft.");
            }

            var transfer = await _transferRepo.GetTrackedByIdAsync(id, innerCt)
                ?? throw new InventoryNotFoundException("Không tìm thấy Phiếu điều chuyển.");
            if (transfer.Lines.Count == 0)
                throw new InventoryValidationException("Phiếu điều chuyển phải có ít nhất một dòng SKU.");

            // Lock all aggregate stock rows in deterministic order, then build every FEFO plan
            // without changing tracked quantities. A missing/insufficient line aborts everything.
            var plans = new List<TransferLinePlan>();
            foreach (var line in transfer.Lines.OrderBy(line => line.SkuId))
            {
                var stock = await _skuStockRepo.GetBySkuIdWithLockAsync(line.SkuId, innerCt)
                    ?? throw new InventoryValidationException($"SKU {line.SkuCode} chưa được đồng bộ tồn kho.");
                if (stock.WarehouseQuantityOnHand < line.Quantity)
                    throw new InventoryValidationException($"Kho không đủ tồn cho SKU {line.SkuCode}.");

                var availableItems = await _batchRepo.GetAvailableItemsForSkuAsync(
                    line.SkuId, LocationWarehouse, innerCt);
                if (availableItems.Sum(item => item.QuantityOnHand) < line.Quantity)
                    throw new InventoryValidationException($"Tồn lô Kho không đủ cho SKU {line.SkuCode}.");

                var remaining = line.Quantity;
                var sources = new List<TransferSourcePlan>();
                foreach (var item in availableItems)
                {
                    if (remaining == 0) break;
                    var take = Math.Min(item.QuantityOnHand, remaining);
                    if (take <= 0) continue;
                    var batch = item.Batch
                        ?? throw new InventoryValidationException($"Lô nguồn của SKU {line.SkuCode} không hợp lệ.");
                    sources.Add(new TransferSourcePlan(batch, item, take));
                    remaining -= take;
                }

                if (remaining != 0)
                    throw new InventoryValidationException($"Không lập được kế hoạch FEFO đầy đủ cho SKU {line.SkuCode}.");

                plans.Add(new TransferLinePlan(
                    line,
                    stock,
                    stock.WarehouseQuantityOnHand,
                    stock.QuantityOnHand,
                    sources));
            }

            var exportSlipId = Guid.NewGuid();
            var importSlipId = Guid.NewGuid();
            var exportSlip = BuildExportSlip(transfer, plans, exportSlipId, actorId, actor, now);
            var importSlip = BuildImportSlip(transfer, plans, importSlipId, actorId, actor, now);
            var ledgerEntries = new List<InventoryLedgerEntry>();
            var transferAllocations = new List<StockTransferBatchAllocation>();
            var transactionGroupId = Guid.NewGuid();
            var touchedSourceBatches = new HashSet<WarehouseBatch>();
            // Navigation Items của lô nguồn chỉ chứa các dòng mà truy vấn FEFO nạp vào (đúng một SKU
            // còn tồn), nên không đủ để kết luận lô đã cạn. Tổng tồn thật đọc từ database, rồi trừ đi
            // phần lấy ra trong lượt này vì các thay đổi trong bộ nhớ chưa được lưu.
            var takenPerSourceBatch = new Dictionary<Guid, int>();

            foreach (var plan in plans)
            {
                var exportLine = exportSlip.Lines.Single(line => line.SkuId == plan.Line.SkuId);
                var warehouseRunning = plan.WarehouseBefore;
                var shelfRunning = plan.ShelfBefore;

                foreach (var source in plan.Sources)
                {
                    source.Item.QuantityOnHand -= source.Quantity;
                    source.Item.UpdatedAt = now;
                    touchedSourceBatches.Add(source.Batch);
                    takenPerSourceBatch[source.Batch.Id] =
                        takenPerSourceBatch.GetValueOrDefault(source.Batch.Id) + source.Quantity;

                    var allocationId = Guid.NewGuid();
                    var destinationBatch = BuildDestinationBatch(
                        transfer, plan.Line, source, allocationId, actorId, now);
                    var destinationItem = destinationBatch.Items.Single();
                    await _batchRepo.AddAsync(destinationBatch, innerCt);

                    var transferAllocation = new StockTransferBatchAllocation
                    {
                        Id = allocationId,
                        StockTransferId = transfer.Id,
                        StockTransferLineId = plan.Line.Id,
                        SourceWarehouseBatchId = source.Batch.Id,
                        SourceWarehouseBatchItemId = source.Item.Id,
                        DestinationWarehouseBatchId = destinationBatch.Id,
                        DestinationWarehouseBatchItemId = destinationItem.Id,
                        Quantity = source.Quantity,
                    };
                    transferAllocations.Add(transferAllocation);

                    var exportAllocation = new StockExportBatchAllocation
                    {
                        Id = Guid.NewGuid(),
                        StockExportSlipId = exportSlipId,
                        StockExportSlipLineId = exportLine.Id,
                        WarehouseBatchId = source.Batch.Id,
                        WarehouseBatchItemId = source.Item.Id,
                        LotCode = source.Batch.LotCode,
                        SkuCode = plan.Line.SkuCode,
                        Quantity = source.Quantity,
                    };
                    exportSlip.BatchAllocations.Add(exportAllocation);
                    exportLine.BatchAllocations.Add(exportAllocation);

                    importSlip.Lines.Add(new StockImportSlipLine
                    {
                        Id = Guid.NewGuid(),
                        StockImportSlipId = importSlipId,
                        SkuId = plan.Line.SkuId,
                        SkuCode = plan.Line.SkuCode,
                        ProductSnapshotName = plan.Line.SkuNameSnapshot,
                        Quantity = source.Quantity,
                        WarehouseQtyBefore = plan.WarehouseBefore,
                        WarehouseQtyAfter = plan.WarehouseBefore - plan.Line.Quantity,
                        StoreQtyBefore = shelfRunning,
                        StoreQtyAfter = shelfRunning + source.Quantity,
                        DestinationLocation = LocationShelf,
                        WarehouseBatchId = destinationBatch.Id,
                        WarehouseBatchLotCode = destinationBatch.LotCode,
                        Note = $"Điều chuyển từ lô Kho {source.Batch.LotCode}",
                        CreatedAt = now,
                    });

                    ledgerEntries.Add(BuildLedgerEntry(
                        transactionGroupId, plan.Line, LocationWarehouse, warehouseRunning,
                        -source.Quantity, warehouseRunning - source.Quantity, LedgerWarehouseOut,
                        transfer, source.Batch.Id, source.Batch.LotCode, actorId, actor, now));
                    ledgerEntries.Add(BuildLedgerEntry(
                        transactionGroupId, plan.Line, LocationShelf, shelfRunning,
                        source.Quantity, shelfRunning + source.Quantity, LedgerShelfIn,
                        transfer, destinationBatch.Id, destinationBatch.LotCode, actorId, actor, now));
                    warehouseRunning -= source.Quantity;
                    shelfRunning += source.Quantity;
                }

                plan.Stock.WarehouseQuantityOnHand = plan.WarehouseBefore - plan.Line.Quantity;
                plan.Stock.QuantityOnHand = plan.ShelfBefore + plan.Line.Quantity;
                plan.Stock.UpdatedAt = now;
            }

            var storedBatchTotals = await _batchRepo.GetQuantitySumsByBatchAsync(
                touchedSourceBatches.Select(batch => batch.Id), innerCt);

            foreach (var sourceBatch in touchedSourceBatches)
            {
                var batchId = sourceBatch.Id;
                var storedTotal = storedBatchTotals.TryGetValue(batchId, out var total) ? total : 0;
                takenPerSourceBatch.TryGetValue(batchId, out var taken);
                sourceBatch.Status = storedTotal - taken > 0 ? "active" : "depleted";
                sourceBatch.UpdatedAt = now;
            }

            // Khóa chính của allocation do tầng ứng dụng sinh. Nếu chỉ thêm vào navigation của
            // aggregate đang được theo dõi, EF Core coi bản ghi là Modified và sinh UPDATE trên
            // dòng chưa tồn tại, dẫn tới DbUpdateConcurrencyException. Add tường minh vào DbSet.
            await _transferRepo.AddBatchAllocationsAsync(transferAllocations, innerCt);
            await _exportSlipRepo.AddAsync(exportSlip, innerCt);
            await _importSlipRepo.AddAsync(importSlip, innerCt);
            await _ledgerRepo.AddRangeAsync(ledgerEntries, innerCt);

            transfer.ExportSlipId = exportSlipId;
            transfer.ImportSlipId = importSlipId;
            transfer.CompletedBy = actorId;
            transfer.CompletedByName = NormalizeText(actor?.CreatedByName);
            transfer.CompletedByRoleName = NormalizeText(actor?.CreatedByRoleName);
            transfer.CompletedAt = now;
            transfer.UpdatedAt = now;

            // Chỉ luồng đã claim được Draft mới tới đây, nên FulfilledQuantity không bị cộng hai lần.
            var sourceRequest = await ApplyFulfillmentToSourceRequestAsync(transfer, innerCt);

            // One SaveChanges and the surrounding Inventory transaction commit the claim, both
            // stock locations, batches, lineage, slips, ledger and terminal status together.
            await _transferRepo.SaveChangesAsync(innerCt);
            transfer.ExportSlip = exportSlip;
            transfer.ImportSlip = importSlip;
            transfer.SourceRequest = sourceRequest ?? transfer.SourceRequest;
            return Map(transfer, transferAllocations);
        }, ct);
    }

    /// <summary>
    /// Ghi nhận số lượng đã điều chuyển vào dòng Yêu cầu bổ sung Kệ Hàng nguồn và tính lại trạng thái.
    /// </summary>
    private async Task<StockAdjustmentRequest?> ApplyFulfillmentToSourceRequestAsync(
        StockTransfer transfer,
        CancellationToken ct)
    {
        if (transfer.SourceRequestId is not { } requestId || requestId == Guid.Empty)
            return null;

        var request = await _adjustmentRequestRepo.GetByIdAsync(requestId, ct)
            ?? throw new InventoryNotFoundException("Không tìm thấy Yêu cầu bổ sung Kệ Hàng nguồn.");

        foreach (var line in transfer.Lines)
        {
            if (line.SourceRequestLineId is not { } requestLineId)
                continue;

            var requestLine = request.Items.FirstOrDefault(item => item.Id == requestLineId)
                ?? throw new InventoryValidationException(
                    $"Dòng yêu cầu của SKU {line.SkuCode} không thuộc Yêu cầu bổ sung Kệ Hàng này.");

            if (line.Quantity > requestLine.RemainingQuantity)
            {
                throw new InventoryValidationException(
                    $"Số lượng điều chuyển của SKU {line.SkuCode} vượt quá số lượng còn lại của yêu cầu " +
                    $"(còn lại {requestLine.RemainingQuantity}).");
            }

            requestLine.FulfilledQuantity += line.Quantity;
            StockAdjustmentFulfillment.RecalculateLineStatus(requestLine);
        }

        StockAdjustmentFulfillment.RecalculateRequestStatus(request);
        return request;
    }

    private async Task<List<NormalizedTransferLine>> ValidateAndNormalizeLinesAsync(
        List<UpsertStockTransferLineRequest>? lines,
        CancellationToken ct)
    {
        if (lines is null || lines.Count == 0)
            throw new InventoryValidationException("Phiếu điều chuyển phải có ít nhất một dòng SKU.");
        if (lines.Any(line => line.SkuId == Guid.Empty))
            throw new InventoryValidationException("SKU là bắt buộc.");
        if (lines.Any(line => line.Quantity <= 0))
            throw new InventoryValidationException("Số lượng điều chuyển phải là số nguyên dương.");
        if (lines.Select(line => line.SkuId).Distinct().Count() != lines.Count)
            throw new InventoryValidationException("Mỗi SKU chỉ được xuất hiện một lần trong Phiếu điều chuyển.");

        var catalog = await _productCatalogClient.GetCatalogForVariantIdsAsync(
            lines.Select(line => line.SkuId), ct);
        var result = new List<NormalizedTransferLine>();
        foreach (var line in lines)
        {
            var product = catalog.FindProductByVariant(line.SkuId);
            var variant = catalog.FindVariant(line.SkuId);
            EnsureFinishedProductIsEligible(line.SkuId, line.SkuCode, product, variant);
            result.Add(new NormalizedTransferLine(
                line.SkuId,
                variant.SkuCode,
                NormalizeText(variant.VariantName) ?? NormalizeText(product.Name) ?? variant.SkuCode,
                NormalizeText(product.InventoryUnit),
                line.Quantity,
                line.SourceRequestLineId == Guid.Empty ? null : line.SourceRequestLineId));
        }
        return result;
    }

    private async Task ValidateExistingLinesAsync(
        IEnumerable<StockTransferLine> lines,
        CancellationToken ct)
    {
        var lineList = lines.ToList();
        if (lineList.Count == 0)
            throw new InventoryValidationException("Phiếu điều chuyển phải có ít nhất một dòng SKU.");
        if (lineList.Any(line => line.Quantity <= 0)
            || lineList.Select(line => line.SkuId).Distinct().Count() != lineList.Count)
            throw new InventoryValidationException("Dữ liệu dòng Phiếu điều chuyển không hợp lệ.");

        var catalog = await _productCatalogClient.GetCatalogForVariantIdsAsync(
            lineList.Select(line => line.SkuId), ct);
        foreach (var line in lineList)
        {
            EnsureFinishedProductIsEligible(
                line.SkuId,
                line.SkuCode,
                catalog.FindProductByVariant(line.SkuId),
                catalog.FindVariant(line.SkuId));
        }
    }

    private static void EnsureFinishedProductIsEligible(
        Guid skuId,
        string? skuCode,
        [NotNull] CatalogProduct? product,
        [NotNull] CatalogVariant? variant)
    {
        var displayCode = NormalizeText(skuCode) ?? skuId.ToString();
        if (product is null || variant is null)
            throw new InventoryValidationException($"SKU {displayCode} không tồn tại trong Product catalog.");
        if (!product.IsActive || !variant.IsActive)
            throw new InventoryValidationException($"SKU {variant.SkuCode} đang ngừng hoạt động.");
        if (!string.Equals(product.ProductType, "THANH_PHAM", StringComparison.OrdinalIgnoreCase))
            throw new InventoryValidationException(
                $"SKU {variant.SkuCode} không được phép điều chuyển lên Kệ. Chỉ THANH_PHAM được hỗ trợ.");
        if (!variant.IsSellable)
            throw new InventoryValidationException(
                $"SKU {variant.SkuCode} không được phép bán trên Kệ Hàng nên không thể điều chuyển lên Kệ.");
    }

    private static List<StockTransferLine> AddLines(
        StockTransfer transfer,
        IEnumerable<NormalizedTransferLine> lines,
        DateTime createdAt)
    {
        var created = new List<StockTransferLine>();
        foreach (var line in lines)
        {
            var entity = new StockTransferLine
            {
                Id = Guid.NewGuid(),
                StockTransferId = transfer.Id,
                SkuId = line.SkuId,
                SkuCode = line.SkuCode,
                SkuNameSnapshot = line.SkuName,
                UnitNameSnapshot = line.UnitName,
                Quantity = line.Quantity,
                SourceRequestLineId = line.SourceRequestLineId,
                CreatedAt = createdAt,
            };
            transfer.Lines.Add(entity);
            created.Add(entity);
        }
        return created;
    }

    private static StockExportSlip BuildExportSlip(
        StockTransfer transfer,
        IReadOnlyCollection<TransferLinePlan> plans,
        Guid slipId,
        Guid actorId,
        CreatorSnapshot? actor,
        DateTime now)
    {
        var first = plans.First();
        var slip = new StockExportSlip
        {
            Id = slipId,
            ExportCode = $"PX-{transfer.TransferCode}",
            ExportType = TransferType,
            ReferenceType = ReferenceType,
            ReferenceId = transfer.Id,
            ReferenceCode = transfer.TransferCode,
            SkuId = first.Line.SkuId,
            SkuCode = plans.Count == 1 ? first.Line.SkuCode : "MULTI",
            SkuSnapshotName = plans.Count == 1 ? first.Line.SkuNameSnapshot : $"{plans.Count} dòng điều chuyển",
            Quantity = plans.Sum(plan => plan.Line.Quantity),
            WarehouseQtyBefore = plans.Sum(plan => plan.WarehouseBefore),
            WarehouseQtyAfter = plans.Sum(plan => plan.WarehouseBefore - plan.Line.Quantity),
            StoreQtyBefore = plans.Sum(plan => plan.ShelfBefore),
            StoreQtyAfter = plans.Sum(plan => plan.ShelfBefore + plan.Line.Quantity),
            Note = transfer.Note,
            CreatedBy = actorId,
            CreatedById = actorId,
            CreatedByName = NormalizeText(actor?.CreatedByName),
            CreatedByRoleName = NormalizeText(actor?.CreatedByRoleName),
            CreatedAt = now,
        };
        foreach (var plan in plans)
        {
            slip.Lines.Add(new StockExportSlipLine
            {
                Id = Guid.NewGuid(),
                StockExportSlipId = slipId,
                SkuId = plan.Line.SkuId,
                SkuCode = plan.Line.SkuCode,
                ProductSnapshotName = plan.Line.SkuNameSnapshot,
                Quantity = plan.Line.Quantity,
                WarehouseQtyBefore = plan.WarehouseBefore,
                WarehouseQtyAfter = plan.WarehouseBefore - plan.Line.Quantity,
                StoreQtyBefore = plan.ShelfBefore,
                StoreQtyAfter = plan.ShelfBefore + plan.Line.Quantity,
                Note = transfer.Note,
                CreatedAt = now,
            });
        }
        return slip;
    }

    private static StockImportSlip BuildImportSlip(
        StockTransfer transfer,
        IReadOnlyCollection<TransferLinePlan> plans,
        Guid slipId,
        Guid actorId,
        CreatorSnapshot? actor,
        DateTime now)
    {
        var first = plans.First();
        return new StockImportSlip
        {
            Id = slipId,
            ImportCode = $"PN-{transfer.TransferCode}",
            ImportType = TransferType,
            ReferenceType = ReferenceType,
            ReferenceId = transfer.Id,
            ReferenceCode = transfer.TransferCode,
            SkuId = first.Line.SkuId,
            SkuCode = plans.Count == 1 ? first.Line.SkuCode : "MULTI",
            ProductSnapshotName = plans.Count == 1 ? first.Line.SkuNameSnapshot : $"{plans.Count} dòng điều chuyển",
            Quantity = plans.Sum(plan => plan.Line.Quantity),
            WarehouseQtyBefore = plans.Sum(plan => plan.WarehouseBefore),
            WarehouseQtyAfter = plans.Sum(plan => plan.WarehouseBefore - plan.Line.Quantity),
            StoreQtyBefore = plans.Sum(plan => plan.ShelfBefore),
            StoreQtyAfter = plans.Sum(plan => plan.ShelfBefore + plan.Line.Quantity),
            Note = transfer.Note,
            CreatedBy = actorId,
            CreatedById = actorId,
            CreatedByName = NormalizeText(actor?.CreatedByName),
            CreatedByRoleName = NormalizeText(actor?.CreatedByRoleName),
            CreatedAt = now,
        };
    }

    private static WarehouseBatch BuildDestinationBatch(
        StockTransfer transfer,
        StockTransferLine line,
        TransferSourcePlan source,
        Guid allocationId,
        Guid actorId,
        DateTime now)
    {
        var batchId = Guid.NewGuid();
        var derivedLotCode = BuildDerivedLotCode(source.Batch.LotCode, transfer.TransferCode, allocationId);
        var batch = new WarehouseBatch
        {
            Id = batchId,
            // BatchCode có backing field riêng và EF Core đọc thẳng field, không đi qua getter.
            // Bỏ trống sẽ ghi chuỗi rỗng vào cột UNIQUE IX_WarehouseBatches_BatchCode và làm
            // hỏng toàn bộ luồng hoàn tất ngay khi có lô đích thứ hai. Luôn gán tường minh.
            BatchCode = derivedLotCode,
            LotCode = derivedLotCode,
            Supplier = source.Batch.Supplier,
            ExpiresAt = source.Batch.ExpiresAt,
            Note = $"Điều chuyển Kho → Kệ từ lô {source.Batch.LotCode} theo {transfer.TransferCode}",
            SourceType = "stock_transfer",
            SourceReferenceId = transfer.Id,
            SourceReferenceCode = transfer.TransferCode,
            Location = LocationShelf,
            ParentBatchId = source.Batch.ParentBatchId ?? source.Batch.Id,
            SourceBatchId = source.Batch.Id,
            Status = "active",
            CreatedBy = actorId,
            CreatedAt = now,
            UpdatedAt = now,
        };
        batch.Items.Add(new WarehouseBatchItem
        {
            Id = Guid.NewGuid(),
            WarehouseBatchId = batchId,
            SkuId = line.SkuId,
            SkuCode = line.SkuCode,
            ProductSnapshotName = line.SkuNameSnapshot,
            QuantityOnHand = source.Quantity,
            InitialQuantity = source.Quantity,
            UnitCost = null,
            CreatedAt = now,
            UpdatedAt = now,
        });
        return batch;
    }

    private static InventoryLedgerEntry BuildLedgerEntry(
        Guid transactionGroupId,
        StockTransferLine line,
        string location,
        int before,
        int delta,
        int after,
        string transactionType,
        StockTransfer transfer,
        Guid batchId,
        string lotCode,
        Guid actorId,
        CreatorSnapshot? actor,
        DateTime now) => new()
        {
            Id = Guid.NewGuid(),
            TransactionGroupId = transactionGroupId,
            OccurredAtUtc = now,
            SkuId = line.SkuId,
            SkuCode = line.SkuCode,
            SkuNameSnapshot = line.SkuNameSnapshot,
            ProductTypeSnapshot = "THANH_PHAM",
            InventoryUnitSnapshot = line.UnitNameSnapshot,
            Location = location,
            QuantityBefore = before,
            QuantityDelta = delta,
            QuantityAfter = after,
            TransactionType = transactionType,
            SourceLocation = LocationWarehouse,
            DestinationLocation = LocationShelf,
            ReferenceType = ReferenceType,
            ReferenceId = transfer.Id,
            ReferenceCode = transfer.TransferCode,
            BatchId = batchId,
            LotCode = lotCode,
            ActorId = actorId,
            ActorName = NormalizeText(actor?.CreatedByName),
            ActorRole = NormalizeText(actor?.CreatedByRoleName),
            Reason = transfer.Note,
            CorrelationId = transfer.Id.ToString(),
        };

    private static StockTransferResponse Map(
        StockTransfer transfer,
        IEnumerable<StockTransferBatchAllocation>? allocationOverride = null)
    {
        var allocations = (allocationOverride ?? transfer.BatchAllocations).ToList();
        var lines = transfer.Lines
            .OrderBy(line => line.SkuCode)
            .Select(line => new StockTransferLineResponse(
                line.Id,
                line.SkuId,
                line.SkuCode,
                line.SkuNameSnapshot,
                line.UnitNameSnapshot,
                line.Quantity,
                line.CreatedAt,
                allocations
                    .Where(allocation => allocation.StockTransferLineId == line.Id)
                    .Select(allocation => new StockTransferBatchAllocationResponse(
                        allocation.Id,
                        allocation.StockTransferLineId,
                        allocation.SourceWarehouseBatchId,
                        allocation.SourceWarehouseBatchItemId,
                        allocation.DestinationWarehouseBatchId,
                        allocation.DestinationWarehouseBatchItemId,
                        allocation.Quantity))
                    .ToList(),
                line.SourceRequestLineId))
            .ToList();
        return new StockTransferResponse(
            transfer.Id,
            transfer.TransferCode,
            transfer.Status.ToString().ToLowerInvariant(),
            transfer.SourceLocation,
            transfer.DestinationLocation,
            transfer.Note,
            transfer.CreatedBy,
            transfer.CreatedByName,
            transfer.CreatedByRoleName,
            transfer.CreatedAt,
            transfer.UpdatedAt,
            transfer.CompletedBy,
            transfer.CompletedByName,
            transfer.CompletedByRoleName,
            transfer.CompletedAt,
            transfer.CancelledBy,
            transfer.CancelledAt,
            transfer.CancellationReason,
            transfer.ExportSlipId,
            transfer.ExportSlip?.ExportCode,
            transfer.ImportSlipId,
            transfer.ImportSlip?.ImportCode,
            lines.Count,
            lines.Sum(line => line.Quantity),
            lines,
            transfer.SourceRequestId,
            transfer.SourceRequest?.RequestCode);
    }

    private static void EnsureActor(Guid actorId)
    {
        if (actorId == Guid.Empty)
            throw new InventoryValidationException("Không xác định được Warehouse thực hiện Phiếu điều chuyển.");
    }

    private static string? NormalizeText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string BuildDerivedLotCode(string sourceLotCode, string transferCode, Guid seed)
    {
        var suffix = seed.ToString("N")[..8].ToUpperInvariant();
        var source = (sourceLotCode ?? string.Empty).Trim().ToUpperInvariant();
        var reference = transferCode.Replace("-", string.Empty, StringComparison.Ordinal).ToUpperInvariant();
        var fixedPart = $"-SH-{reference}-{suffix}";
        var maxSourceLength = Math.Max(1, 50 - fixedPart.Length);
        if (source.Length > maxSourceLength)
            source = source[..maxSourceLength];
        return $"{source}{fixedPart}";
    }

    private sealed record NormalizedTransferLine(
        Guid SkuId,
        string SkuCode,
        string SkuName,
        string? UnitName,
        int Quantity,
        Guid? SourceRequestLineId);

    private sealed record TransferSourcePlan(
        WarehouseBatch Batch,
        WarehouseBatchItem Item,
        int Quantity);

    private sealed record TransferLinePlan(
        StockTransferLine Line,
        SkuStock Stock,
        int WarehouseBefore,
        int ShelfBefore,
        List<TransferSourcePlan> Sources);
}
