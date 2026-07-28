using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    /// <summary>
    /// POS-04 (truy vết giữ chỗ hai chiều) — bổ sung dữ liệu truy vết giữ chỗ ở cấp dòng SKU:
    /// ReservationStatus/ReservedQuantity/ReservedAt/ReleasedAt/DeductedAt trên StockDeductQueueItems,
    /// và CustomerSnapshotName trên StockDeductQueues để hiển thị đơn đang giữ chỗ từ màn hình SKU
    /// mà không truy vấn database service khác.
    ///
    /// Backfill: các dòng thuộc queue đang giữ chỗ (IsReserved = 1) được đánh dấu Active với
    /// ReservedQuantity = Quantity để tổng giữ chỗ theo SKU khớp SkuStocks.ReservedQuantity hiện có.
    /// Queue đã trừ tồn → Deducted; queue đã hủy → Released. Không thay đổi số liệu tồn.
    /// </summary>
    public partial class AddCodReservationTraceability : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomerSnapshotName",
                table: "StockDeductQueues",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReservationStatus",
                table: "StockDeductQueueItems",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "None");

            migrationBuilder.AddColumn<int>(
                name: "ReservedQuantity",
                table: "StockDeductQueueItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReservedAt",
                table: "StockDeductQueueItems",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReleasedAt",
                table: "StockDeductQueueItems",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeductedAt",
                table: "StockDeductQueueItems",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_StockDeductQueueItems_SkuId",
                table: "StockDeductQueueItems",
                column: "SkuId");

            migrationBuilder.CreateIndex(
                name: "IX_StockDeductQueueItems_SkuId_ReservationStatus",
                table: "StockDeductQueueItems",
                columns: new[] { "SkuId", "ReservationStatus" });

            // Backfill giữ chỗ đang hoạt động: tổng Active theo SKU phải khớp SkuStocks.ReservedQuantity.
            migrationBuilder.Sql(@"
UPDATE `StockDeductQueueItems` i
JOIN `StockDeductQueues` q ON q.`Id` = i.`QueueId`
SET i.`ReservationStatus` = 'Active',
    i.`ReservedQuantity` = i.`Quantity`,
    i.`ReservedAt` = q.`CreatedAt`
WHERE q.`IsReserved` = 1;");

            // Queue đã trừ tồn vật lý → giữ chỗ đã chuyển thành xuất kho.
            migrationBuilder.Sql(@"
UPDATE `StockDeductQueueItems` i
JOIN `StockDeductQueues` q ON q.`Id` = i.`QueueId`
SET i.`ReservationStatus` = 'Deducted',
    i.`ReservedQuantity` = i.`Quantity`,
    i.`ReservedAt` = q.`CreatedAt`,
    i.`DeductedAt` = COALESCE(q.`ConfirmedAt`, q.`CreatedAt`)
WHERE q.`IsReserved` = 0 AND q.`IsDeducted` = 1 AND q.`OrderStockStatus` = 'deducted';");

            // Queue đã hủy trước khi trừ tồn → giữ chỗ đã giải phóng.
            migrationBuilder.Sql(@"
UPDATE `StockDeductQueueItems` i
JOIN `StockDeductQueues` q ON q.`Id` = i.`QueueId`
SET i.`ReservationStatus` = 'Released',
    i.`ReservedQuantity` = i.`Quantity`,
    i.`ReservedAt` = q.`CreatedAt`,
    i.`ReleasedAt` = COALESCE(q.`CancelledAt`, q.`ConfirmedAt`, q.`CreatedAt`)
WHERE q.`IsReserved` = 0 AND q.`IsDeducted` = 0 AND q.`QueueStatus` = 'Cancelled';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StockDeductQueueItems_SkuId_ReservationStatus",
                table: "StockDeductQueueItems");

            migrationBuilder.DropIndex(
                name: "IX_StockDeductQueueItems_SkuId",
                table: "StockDeductQueueItems");

            migrationBuilder.DropColumn(name: "DeductedAt", table: "StockDeductQueueItems");
            migrationBuilder.DropColumn(name: "ReleasedAt", table: "StockDeductQueueItems");
            migrationBuilder.DropColumn(name: "ReservedAt", table: "StockDeductQueueItems");
            migrationBuilder.DropColumn(name: "ReservedQuantity", table: "StockDeductQueueItems");
            migrationBuilder.DropColumn(name: "ReservationStatus", table: "StockDeductQueueItems");
            migrationBuilder.DropColumn(name: "CustomerSnapshotName", table: "StockDeductQueues");
        }
    }
}
