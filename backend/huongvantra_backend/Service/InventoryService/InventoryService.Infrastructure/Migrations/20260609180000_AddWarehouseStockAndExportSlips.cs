using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddWarehouseStockAndExportSlips : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WarehouseQuantityOnHand",
                table: "SkuStocks",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "ExportSlipId",
                table: "StockAdjustmentRequests",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<int>(
                name: "QuantityOnHandAfter",
                table: "StockAdjustmentRequests",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WarehouseQuantityOnHandAfter",
                table: "StockAdjustmentRequests",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "StockExportSlips",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ExportCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ExportType = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StockAdjustmentRequestId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SkuSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    WarehouseQtyBefore = table.Column<int>(type: "int", nullable: false),
                    WarehouseQtyAfter = table.Column<int>(type: "int", nullable: false),
                    StoreQtyBefore = table.Column<int>(type: "int", nullable: false),
                    StoreQtyAfter = table.Column<int>(type: "int", nullable: false),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedBy = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockExportSlips", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_StockAdjustmentRequests_ExportSlipId",
                table: "StockAdjustmentRequests",
                column: "ExportSlipId");

            migrationBuilder.CreateIndex(
                name: "IX_StockExportSlips_CreatedAt",
                table: "StockExportSlips",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_StockExportSlips_ExportCode",
                table: "StockExportSlips",
                column: "ExportCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StockExportSlips_StockAdjustmentRequestId",
                table: "StockExportSlips",
                column: "StockAdjustmentRequestId");

            migrationBuilder.AddForeignKey(
                name: "FK_StockAdjustmentRequests_StockExportSlips_ExportSlipId",
                table: "StockAdjustmentRequests",
                column: "ExportSlipId",
                principalTable: "StockExportSlips",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StockAdjustmentRequests_StockExportSlips_ExportSlipId",
                table: "StockAdjustmentRequests");

            migrationBuilder.DropTable(name: "StockExportSlips");

            migrationBuilder.DropIndex(
                name: "IX_StockAdjustmentRequests_ExportSlipId",
                table: "StockAdjustmentRequests");

            migrationBuilder.DropColumn(name: "WarehouseQuantityOnHand", table: "SkuStocks");
            migrationBuilder.DropColumn(name: "ExportSlipId", table: "StockAdjustmentRequests");
            migrationBuilder.DropColumn(name: "QuantityOnHandAfter", table: "StockAdjustmentRequests");
            migrationBuilder.DropColumn(name: "WarehouseQuantityOnHandAfter", table: "StockAdjustmentRequests");
        }
    }
}
