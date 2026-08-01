using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

/// <summary>
/// Additive migration phục vụ màn hình audit của Admin cho Yêu cầu bổ sung Kệ Hàng:
/// - RequestedByName, RequestedByRoleName: ảnh chụp người tạo và vai trò người tạo.
/// - ReviewedByName, ReviewedByRoleName: ảnh chụp người xử lý gần nhất.
///
/// Lưu snapshot thay vì gọi UserService khi đọc để không tạo phụ thuộc chéo service và để
/// dữ liệu audit không đổi khi người dùng bị đổi tên hoặc đổi vai trò sau này.
/// Tất cả cột đều nullable nên dữ liệu cũ vẫn hợp lệ; KHÔNG xóa hay đổi cột nào đang có.
/// </summary>
[DbContext(typeof(InventoryDbContext))]
[Migration("20260731110000_AddStockAdjustmentRequestActorSnapshot")]
public partial class AddStockAdjustmentRequestActorSnapshot : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "RequestedByName",
            table: "StockAdjustmentRequests",
            type: "varchar(255)",
            maxLength: 255,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "RequestedByRoleName",
            table: "StockAdjustmentRequests",
            type: "varchar(100)",
            maxLength: 100,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ReviewedByName",
            table: "StockAdjustmentRequests",
            type: "varchar(255)",
            maxLength: 255,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ReviewedByRoleName",
            table: "StockAdjustmentRequests",
            type: "varchar(100)",
            maxLength: 100,
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_StockAdjustmentRequests_RequestedByRoleName",
            table: "StockAdjustmentRequests",
            column: "RequestedByRoleName");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_StockAdjustmentRequests_RequestedByRoleName",
            table: "StockAdjustmentRequests");

        migrationBuilder.DropColumn(name: "ReviewedByRoleName", table: "StockAdjustmentRequests");
        migrationBuilder.DropColumn(name: "ReviewedByName", table: "StockAdjustmentRequests");
        migrationBuilder.DropColumn(name: "RequestedByRoleName", table: "StockAdjustmentRequests");
        migrationBuilder.DropColumn(name: "RequestedByName", table: "StockAdjustmentRequests");
    }
}
