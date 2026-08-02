using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

/// <summary>
/// Additive migration cho Yêu cầu bổ sung Kệ Hàng đáp ứng từng phần:
/// - StockAdjustmentRequestItems: ApprovedQuantity, FulfilledQuantity, RejectedQuantity,
///   Status, ReviewNote, RejectionReason, ClosedReason.
/// - RemainingQuantity KHÔNG lưu DB (suy ra từ QuantityDelta - Fulfilled - Rejected).
///
/// Backfill trạng thái dòng theo trạng thái yêu cầu cha để dữ liệu cũ vẫn đọc được.
/// KHÔNG xóa cột cũ. KHÔNG đổi trạng thái yêu cầu cha.
/// </summary>
[DbContext(typeof(InventoryDbContext))]
[Migration("20260731090000_AddStockAdjustmentRequestFulfillment")]
public partial class AddStockAdjustmentRequestFulfillment : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "ApprovedQuantity",
            table: "StockAdjustmentRequestItems",
            type: "int",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.AddColumn<int>(
            name: "FulfilledQuantity",
            table: "StockAdjustmentRequestItems",
            type: "int",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.AddColumn<int>(
            name: "RejectedQuantity",
            table: "StockAdjustmentRequestItems",
            type: "int",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.AddColumn<string>(
            name: "Status",
            table: "StockAdjustmentRequestItems",
            type: "varchar(20)",
            maxLength: 20,
            nullable: false,
            defaultValue: "Pending");

        migrationBuilder.AddColumn<string>(
            name: "ReviewNote",
            table: "StockAdjustmentRequestItems",
            type: "varchar(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "RejectionReason",
            table: "StockAdjustmentRequestItems",
            type: "varchar(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ClosedReason",
            table: "StockAdjustmentRequestItems",
            type: "varchar(500)",
            maxLength: 500,
            nullable: true);

        // Yêu cầu cũ đã hoàn tất: coi như đã cấp đủ số lượng yêu cầu.
        migrationBuilder.Sql("""
            UPDATE `StockAdjustmentRequestItems` AS i
            JOIN `StockAdjustmentRequests` AS r ON r.`Id` = i.`RequestId`
            SET i.`ApprovedQuantity` = i.`QuantityDelta`,
                i.`FulfilledQuantity` = i.`QuantityDelta`,
                i.`Status` = 'Fulfilled'
            WHERE r.`Status` IN ('Completed', 'Approved', 'Fulfilled');
            """);

        migrationBuilder.Sql("""
            UPDATE `StockAdjustmentRequestItems` AS i
            JOIN `StockAdjustmentRequests` AS r ON r.`Id` = i.`RequestId`
            SET i.`RejectedQuantity` = i.`QuantityDelta`,
                i.`Status` = 'Rejected'
            WHERE r.`Status` = 'Rejected';
            """);

        migrationBuilder.Sql("""
            UPDATE `StockAdjustmentRequestItems` AS i
            JOIN `StockAdjustmentRequests` AS r ON r.`Id` = i.`RequestId`
            SET i.`Status` = 'Cancelled'
            WHERE r.`Status` = 'Cancelled';
            """);

        migrationBuilder.CreateIndex(
            name: "IX_StockAdjustmentRequestItems_Status",
            table: "StockAdjustmentRequestItems",
            column: "Status");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_StockAdjustmentRequestItems_Status",
            table: "StockAdjustmentRequestItems");

        migrationBuilder.DropColumn(name: "ClosedReason", table: "StockAdjustmentRequestItems");
        migrationBuilder.DropColumn(name: "RejectionReason", table: "StockAdjustmentRequestItems");
        migrationBuilder.DropColumn(name: "ReviewNote", table: "StockAdjustmentRequestItems");
        migrationBuilder.DropColumn(name: "Status", table: "StockAdjustmentRequestItems");
        migrationBuilder.DropColumn(name: "RejectedQuantity", table: "StockAdjustmentRequestItems");
        migrationBuilder.DropColumn(name: "FulfilledQuantity", table: "StockAdjustmentRequestItems");
        migrationBuilder.DropColumn(name: "ApprovedQuantity", table: "StockAdjustmentRequestItems");
    }
}
