using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddStockImportSlips : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StockImportSlips",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ImportCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ImportType = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
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
                    WarehouseBatchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    WarehouseBatchLotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ProductionOrderId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    ProductionCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedBy = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockImportSlips", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockImportSlips_ProductionOrders_ProductionOrderId",
                        column: x => x.ProductionOrderId,
                        principalTable: "ProductionOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StockImportSlips_WarehouseBatches_WarehouseBatchId",
                        column: x => x.WarehouseBatchId,
                        principalTable: "WarehouseBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_StockImportSlips_CreatedAt",
                table: "StockImportSlips",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_StockImportSlips_ImportCode",
                table: "StockImportSlips",
                column: "ImportCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StockImportSlips_ImportType",
                table: "StockImportSlips",
                column: "ImportType");

            migrationBuilder.CreateIndex(
                name: "IX_StockImportSlips_ProductionCode",
                table: "StockImportSlips",
                column: "ProductionCode");

            migrationBuilder.CreateIndex(
                name: "IX_StockImportSlips_ProductionOrderId",
                table: "StockImportSlips",
                column: "ProductionOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_StockImportSlips_SkuId",
                table: "StockImportSlips",
                column: "SkuId");

            migrationBuilder.CreateIndex(
                name: "IX_StockImportSlips_WarehouseBatchId",
                table: "StockImportSlips",
                column: "WarehouseBatchId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StockImportSlips");
        }
    }
}
