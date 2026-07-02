using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddStockExportSlipLines : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "StockExportSlipLineId",
                table: "StockExportBatchAllocations",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateTable(
                name: "StockExportSlipLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    StockExportSlipId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ProductSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    WarehouseQtyBefore = table.Column<int>(type: "int", nullable: false),
                    WarehouseQtyAfter = table.Column<int>(type: "int", nullable: false),
                    StoreQtyBefore = table.Column<int>(type: "int", nullable: false),
                    StoreQtyAfter = table.Column<int>(type: "int", nullable: false),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockExportSlipLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockExportSlipLines_StockExportSlips_StockExportSlipId",
                        column: x => x.StockExportSlipId,
                        principalTable: "StockExportSlips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_StockExportBatchAllocations_StockExportSlipLineId",
                table: "StockExportBatchAllocations",
                column: "StockExportSlipLineId");

            migrationBuilder.CreateIndex(
                name: "IX_StockExportSlipLines_SkuId",
                table: "StockExportSlipLines",
                column: "SkuId");

            migrationBuilder.CreateIndex(
                name: "IX_StockExportSlipLines_StockExportSlipId",
                table: "StockExportSlipLines",
                column: "StockExportSlipId");

            migrationBuilder.AddForeignKey(
                name: "FK_StockExportBatchAllocations_StockExportSlipLines_StockExportSlipLineId",
                table: "StockExportBatchAllocations",
                column: "StockExportSlipLineId",
                principalTable: "StockExportSlipLines",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StockExportBatchAllocations_StockExportSlipLines_StockExportSlipLineId",
                table: "StockExportBatchAllocations");

            migrationBuilder.DropTable(
                name: "StockExportSlipLines");

            migrationBuilder.DropIndex(
                name: "IX_StockExportBatchAllocations_StockExportSlipLineId",
                table: "StockExportBatchAllocations");

            migrationBuilder.DropColumn(
                name: "StockExportSlipLineId",
                table: "StockExportBatchAllocations");
        }
    }
}
