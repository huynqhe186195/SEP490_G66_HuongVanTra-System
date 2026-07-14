using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddPartialFinishedAndBomPendingFieldsToStockDeductQueue : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OrderedQuantity",
                table: "StockDeductQueueItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FinishedDeductedQuantity",
                table: "StockDeductQueueItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PendingBomQuantity",
                table: "StockDeductQueueItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MaterialRequirementSnapshotJson",
                table: "StockDeductQueueItems",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "StockHandlingMode",
                table: "StockDeductQueueItems",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OrderedQuantity",
                table: "StockDeductQueueItems");

            migrationBuilder.DropColumn(
                name: "FinishedDeductedQuantity",
                table: "StockDeductQueueItems");

            migrationBuilder.DropColumn(
                name: "PendingBomQuantity",
                table: "StockDeductQueueItems");

            migrationBuilder.DropColumn(
                name: "MaterialRequirementSnapshotJson",
                table: "StockDeductQueueItems");

            migrationBuilder.DropColumn(
                name: "StockHandlingMode",
                table: "StockDeductQueueItems");
        }
    }
}
