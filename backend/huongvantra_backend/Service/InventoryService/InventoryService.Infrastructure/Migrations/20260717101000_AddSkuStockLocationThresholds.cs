using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddSkuStockLocationThresholds : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WarehouseLowStockThreshold",
                table: "SkuStocks",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ShelfLowStockThreshold",
                table: "SkuStocks",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("""
                UPDATE `SkuStocks`
                SET `ShelfLowStockThreshold` = `LowStockThreshold`,
                    `WarehouseLowStockThreshold` = 0;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WarehouseLowStockThreshold",
                table: "SkuStocks");

            migrationBuilder.DropColumn(
                name: "ShelfLowStockThreshold",
                table: "SkuStocks");
        }
    }
}
