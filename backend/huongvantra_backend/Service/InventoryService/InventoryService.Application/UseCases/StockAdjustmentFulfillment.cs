using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.UseCases;

/// <summary>
/// Tính lại trạng thái dòng và trạng thái tổng của Yêu cầu bổ sung Kệ Hàng.
/// Backend luôn tự tính, không nhận trạng thái từ client.
/// </summary>
public static class StockAdjustmentFulfillment
{
    public static void RecalculateLineStatus(StockAdjustmentRequestItem line)
    {
        if (line.Status is StockAdjustmentRequestItemStatus.Cancelled
            or StockAdjustmentRequestItemStatus.Rejected
            or StockAdjustmentRequestItemStatus.ClosedPartial)
        {
            return;
        }

        if (line.RemainingQuantity == 0)
        {
            line.Status = line.FulfilledQuantity > 0
                ? StockAdjustmentRequestItemStatus.Fulfilled
                : StockAdjustmentRequestItemStatus.Rejected;
            return;
        }

        if (line.FulfilledQuantity > 0)
        {
            line.Status = StockAdjustmentRequestItemStatus.PartiallyFulfilled;
            return;
        }

        line.Status = line.ApprovedQuantity > 0
            ? StockAdjustmentRequestItemStatus.WaitingForStock
            : StockAdjustmentRequestItemStatus.Pending;
    }

    public static void RecalculateRequestStatus(StockAdjustmentRequest request)
    {
        if (request.Status is StockAdjustmentRequestStatus.Cancelled
            or StockAdjustmentRequestStatus.Draft)
        {
            return;
        }

        var lines = request.Items;
        if (lines.Count == 0)
        {
            request.Status = StockAdjustmentRequestStatus.Pending;
            return;
        }

        var activeLines = lines
            .Where(l => l.Status != StockAdjustmentRequestItemStatus.Cancelled)
            .ToList();

        if (activeLines.Count == 0)
        {
            request.Status = StockAdjustmentRequestStatus.Cancelled;
            return;
        }

        if (activeLines.All(l => l.Status == StockAdjustmentRequestItemStatus.Rejected))
        {
            request.Status = StockAdjustmentRequestStatus.Rejected;
            return;
        }

        if (activeLines.Any(l => l.Status == StockAdjustmentRequestItemStatus.ClosedPartial))
        {
            request.Status = StockAdjustmentRequestStatus.ClosedPartial;
            return;
        }

        var totalFulfilled = activeLines.Sum(l => l.FulfilledQuantity);
        var totalRemaining = activeLines.Sum(l => l.RemainingQuantity);

        if (totalRemaining == 0)
        {
            request.Status = totalFulfilled > 0
                ? StockAdjustmentRequestStatus.Fulfilled
                : StockAdjustmentRequestStatus.Rejected;
            return;
        }

        if (totalFulfilled > 0)
        {
            request.Status = StockAdjustmentRequestStatus.PartiallyFulfilled;
            return;
        }

        request.Status = activeLines.Any(l => l.ApprovedQuantity > 0)
            ? StockAdjustmentRequestStatus.Approved
            : StockAdjustmentRequestStatus.Pending;
    }

    /// <summary>Yêu cầu đã chốt hoàn toàn, không thể xử lý bổ sung thêm.</summary>
    public static bool IsClosed(StockAdjustmentRequestStatus status) =>
        status is StockAdjustmentRequestStatus.Cancelled
            or StockAdjustmentRequestStatus.Rejected
            or StockAdjustmentRequestStatus.Fulfilled
            or StockAdjustmentRequestStatus.ClosedPartial
            or StockAdjustmentRequestStatus.Completed;

    public static bool IsLineClosed(StockAdjustmentRequestItemStatus status) =>
        status is StockAdjustmentRequestItemStatus.Cancelled
            or StockAdjustmentRequestItemStatus.Rejected
            or StockAdjustmentRequestItemStatus.Fulfilled
            or StockAdjustmentRequestItemStatus.ClosedPartial;
}
