using System;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

/// <summary>
/// Liên kết ngược từ Phiếu điều chuyển Kho → Kệ về Yêu cầu bổ sung Kệ Hàng:
/// - StockTransfers.SourceRequestId → StockAdjustmentRequests.Id
/// - StockTransferLines.SourceRequestLineId → StockAdjustmentRequestItems.Id
///
/// Cả hai đều nullable và KHÔNG unique: một yêu cầu có thể được đáp ứng bằng nhiều phiếu,
/// và phiếu điều chuyển tạo trực tiếp (không xuất phát từ yêu cầu) vẫn hợp lệ.
/// Delete behavior Restrict để không xóa mất dấu vết đáp ứng.
///
/// Migration nền 20260729120000_AddStockTransfers đã tạo ba bảng StockTransfer, nên migration này
/// chỉ là delta additive: chạy được cả trên database sạch lẫn database local đang có sẵn ba bảng.
/// </summary>
[DbContext(typeof(InventoryDbContext))]
[Migration("20260731093000_AddStockTransferRequestLinks")]
public partial class AddStockTransferRequestLinks : Migration
{
    private const string TransferForeignKey =
        "FK_StockTransfers_StockAdjustmentRequests_SourceRequestId";

    // EF/Pomelo cắt tên constraint ở 64 ký tự; giữ đúng tên đã cắt để Down khớp với DB.
    private const string TransferLineForeignKey =
        "FK_StockTransferLines_StockAdjustmentRequestItems_SourceRequestL";

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "SourceRequestId",
            table: "StockTransfers",
            type: "char(36)",
            nullable: true,
            collation: "ascii_general_ci");

        migrationBuilder.AddColumn<Guid>(
            name: "SourceRequestLineId",
            table: "StockTransferLines",
            type: "char(36)",
            nullable: true,
            collation: "ascii_general_ci");

        migrationBuilder.CreateIndex(
            name: "IX_StockTransfers_SourceRequestId",
            table: "StockTransfers",
            column: "SourceRequestId");

        migrationBuilder.CreateIndex(
            name: "IX_StockTransferLines_SourceRequestLineId",
            table: "StockTransferLines",
            column: "SourceRequestLineId");

        migrationBuilder.AddForeignKey(
            name: TransferForeignKey,
            table: "StockTransfers",
            column: "SourceRequestId",
            principalTable: "StockAdjustmentRequests",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: TransferLineForeignKey,
            table: "StockTransferLines",
            column: "SourceRequestLineId",
            principalTable: "StockAdjustmentRequestItems",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(name: TransferLineForeignKey, table: "StockTransferLines");
        migrationBuilder.DropForeignKey(name: TransferForeignKey, table: "StockTransfers");

        migrationBuilder.DropIndex(
            name: "IX_StockTransferLines_SourceRequestLineId",
            table: "StockTransferLines");

        migrationBuilder.DropIndex(
            name: "IX_StockTransfers_SourceRequestId",
            table: "StockTransfers");

        migrationBuilder.DropColumn(name: "SourceRequestLineId", table: "StockTransferLines");
        migrationBuilder.DropColumn(name: "SourceRequestId", table: "StockTransfers");
    }
}
