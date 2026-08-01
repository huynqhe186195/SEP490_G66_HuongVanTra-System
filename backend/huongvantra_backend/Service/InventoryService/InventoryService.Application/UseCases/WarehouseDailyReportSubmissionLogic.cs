using System.Text.Json;
using System.Text.Json.Serialization;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Exceptions;

namespace InventoryService.Application.UseCases;

public sealed class WarehouseDailyReportSubmissionLogic(
    WarehouseDailyReportLogic reportLogic,
    IWarehouseDailyReportSubmissionRepository repo)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
    };

    public async Task<WarehouseDailyReportSubmissionDetail> CreateAsync(
        CreateWarehouseDailyReportSubmissionRequest? request,
        CreatorSnapshot actor,
        CancellationToken ct = default)
    {
        if (actor.CreatedById == Guid.Empty)
            throw new InventoryValidationException("Không xác định được người gửi báo cáo.");

        var report = await reportLogic.GetAsync(request?.Date, ct);
        if (await repo.ExistsByBusinessDateAsync(report.BusinessDate, ct))
        {
            throw new InventoryValidationException(
                $"Báo cáo ngày {report.BusinessDate:dd/MM/yyyy} đã được gửi. Mỗi ngày chỉ gửi một lần.");
        }

        var doneTotal =
            report.Summary.SupplierReceiptsCompleted
            + report.Summary.ProductionOrdersCompleted
            + report.Summary.StockTransfersCompleted
            + report.Summary.StockAdjustmentReviews
            + report.Summary.StockDeductQueuesConfirmed
            + report.Summary.WarehouseStocktakesCompleted;

        var entity = new WarehouseDailyReportSubmission
        {
            Id = Guid.NewGuid(),
            BusinessDate = report.BusinessDate,
            SentAtUtc = DateTime.UtcNow,
            SentBy = actor.CreatedById,
            SentByName = string.IsNullOrWhiteSpace(actor.CreatedByName) ? "Thủ kho" : actor.CreatedByName.Trim(),
            SentByRoleName = string.IsNullOrWhiteSpace(actor.CreatedByRoleName) ? null : actor.CreatedByRoleName.Trim(),
            DoneTotal = doneTotal,
            OpenCarryCount = report.Summary.OpenCarryCount,
            TotalWarehouseQuantity = report.EndingSnapshot.TotalWarehouseQuantity,
            LowStockSkuCount = report.EndingSnapshot.LowStockSkuCount,
            ExpiringBatchCount30Days = report.EndingSnapshot.ExpiringBatchCount30Days,
            SnapshotJson = JsonSerializer.Serialize(report, JsonOptions),
        };

        await repo.AddAsync(entity, ct);
        return MapDetail(entity, report);
    }

    public async Task<PagedResponse<WarehouseDailyReportSubmissionListItem>> GetPagedAsync(
        DateOnly? date,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (items, total) = await repo.GetPagedAsync(date, page, pageSize, ct);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var mapped = items.Select(x => new WarehouseDailyReportSubmissionListItem(
            x.Id,
            x.BusinessDate,
            x.SentAtUtc,
            x.SentByName,
            x.SentByRoleName,
            x.DoneTotal,
            x.OpenCarryCount,
            x.TotalWarehouseQuantity,
            x.LowStockSkuCount,
            x.ExpiringBatchCount30Days)).ToList();

        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
        return new PagedResponse<WarehouseDailyReportSubmissionListItem>(mapped, page, pageSize, total, totalPages);
    }

    public async Task<WarehouseDailyReportSubmissionDetail> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await repo.GetByIdAsync(id, ct)
            ?? throw new InventoryValidationException("Không tìm thấy lần gửi báo cáo.");

        WarehouseDailyReportResponse report;
        try
        {
            report = JsonSerializer.Deserialize<WarehouseDailyReportResponse>(entity.SnapshotJson, JsonOptions)
                ?? throw new InventoryValidationException("Snapshot báo cáo bị lỗi.");
        }
        catch (JsonException)
        {
            throw new InventoryValidationException("Snapshot báo cáo bị lỗi.");
        }

        return MapDetail(entity, report);
    }

    private static WarehouseDailyReportSubmissionDetail MapDetail(
        WarehouseDailyReportSubmission entity,
        WarehouseDailyReportResponse report) =>
        new(
            entity.Id,
            entity.BusinessDate,
            entity.SentAtUtc,
            entity.SentBy,
            entity.SentByName,
            entity.SentByRoleName,
            entity.DoneTotal,
            entity.OpenCarryCount,
            entity.TotalWarehouseQuantity,
            entity.LowStockSkuCount,
            entity.ExpiringBatchCount30Days,
            report);
}
