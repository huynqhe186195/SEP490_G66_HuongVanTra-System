using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddProductionTraceFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProductionOrderId",
                table: "StockExportSlips",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "ProductionCode",
                table: "StockExportSlips",
                type: "varchar(30)",
                maxLength: 30,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SourceType",
                table: "WarehouseBatches",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "SourceReferenceId",
                table: "WarehouseBatches",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "SourceReferenceCode",
                table: "WarehouseBatches",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_StockExportSlips_ProductionOrderId",
                table: "StockExportSlips",
                column: "ProductionOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_StockExportSlips_ProductionCode",
                table: "StockExportSlips",
                column: "ProductionCode");

            migrationBuilder.CreateIndex(
                name: "IX_WarehouseBatches_SourceReferenceId",
                table: "WarehouseBatches",
                column: "SourceReferenceId");

            migrationBuilder.CreateIndex(
                name: "IX_WarehouseBatches_SourceReferenceCode",
                table: "WarehouseBatches",
                column: "SourceReferenceCode");

            migrationBuilder.AddForeignKey(
                name: "FK_StockExportSlips_ProductionOrders_ProductionOrderId",
                table: "StockExportSlips",
                column: "ProductionOrderId",
                principalTable: "ProductionOrders",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StockExportSlips_ProductionOrders_ProductionOrderId",
                table: "StockExportSlips");

            migrationBuilder.DropIndex(
                name: "IX_StockExportSlips_ProductionOrderId",
                table: "StockExportSlips");

            migrationBuilder.DropIndex(
                name: "IX_StockExportSlips_ProductionCode",
                table: "StockExportSlips");

            migrationBuilder.DropIndex(
                name: "IX_WarehouseBatches_SourceReferenceId",
                table: "WarehouseBatches");

            migrationBuilder.DropIndex(
                name: "IX_WarehouseBatches_SourceReferenceCode",
                table: "WarehouseBatches");

            migrationBuilder.DropColumn(
                name: "ProductionOrderId",
                table: "StockExportSlips");

            migrationBuilder.DropColumn(
                name: "ProductionCode",
                table: "StockExportSlips");

            migrationBuilder.DropColumn(
                name: "SourceType",
                table: "WarehouseBatches");

            migrationBuilder.DropColumn(
                name: "SourceReferenceId",
                table: "WarehouseBatches");

            migrationBuilder.DropColumn(
                name: "SourceReferenceCode",
                table: "WarehouseBatches");
        }
    }
}
