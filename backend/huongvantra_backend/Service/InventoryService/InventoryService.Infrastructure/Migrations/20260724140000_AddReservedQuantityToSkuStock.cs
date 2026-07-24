using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    /// <summary>
    /// POS-04 (H1) — thêm cột ReservedQuantity vào SkuStocks để giữ chỗ tồn Kệ Hàng
    /// cho đơn COD chờ xác nhận. Tồn khả bán = QuantityOnHand - ReservedQuantity.
    /// Kèm cờ IsReserved trên StockDeductQueues để reserve/release idempotent.
    /// Mặc định 0/false để tương thích dữ liệu hiện có.
    /// </summary>
    public partial class AddReservedQuantityToSkuStock : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ReservedQuantity",
                table: "SkuStocks",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsReserved",
                table: "StockDeductQueues",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReservedQuantity",
                table: "SkuStocks");

            migrationBuilder.DropColumn(
                name: "IsReserved",
                table: "StockDeductQueues");
        }
    }
}
