using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddStockImportSlipLines : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StockImportSlipLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    StockImportSlipId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
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
                    ProductionOrderOutputLineId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockImportSlipLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockImportSlipLines_ProductionOrderOutputLines_ProductionOrderOutputLineId",
                        column: x => x.ProductionOrderOutputLineId,
                        principalTable: "ProductionOrderOutputLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StockImportSlipLines_StockImportSlips_StockImportSlipId",
                        column: x => x.StockImportSlipId,
                        principalTable: "StockImportSlips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StockImportSlipLines_WarehouseBatches_WarehouseBatchId",
                        column: x => x.WarehouseBatchId,
                        principalTable: "WarehouseBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_StockImportSlipLines_CreatedAt",
                table: "StockImportSlipLines",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_StockImportSlipLines_ProductionOrderOutputLineId",
                table: "StockImportSlipLines",
                column: "ProductionOrderOutputLineId");

            migrationBuilder.CreateIndex(
                name: "IX_StockImportSlipLines_SkuId",
                table: "StockImportSlipLines",
                column: "SkuId");

            migrationBuilder.CreateIndex(
                name: "IX_StockImportSlipLines_StockImportSlipId",
                table: "StockImportSlipLines",
                column: "StockImportSlipId");

            migrationBuilder.CreateIndex(
                name: "IX_StockImportSlipLines_WarehouseBatchId",
                table: "StockImportSlipLines",
                column: "WarehouseBatchId");

            migrationBuilder.Sql("""
                INSERT INTO `StockImportSlipLines`
                    (`Id`, `StockImportSlipId`, `SkuId`, `SkuCode`, `ProductSnapshotName`, `Quantity`,
                     `WarehouseQtyBefore`, `WarehouseQtyAfter`, `StoreQtyBefore`, `StoreQtyAfter`,
                     `WarehouseBatchId`, `WarehouseBatchLotCode`, `ProductionOrderOutputLineId`, `Note`, `CreatedAt`)
                SELECT
                    UUID(), s.`Id`, s.`SkuId`, s.`SkuCode`, s.`ProductSnapshotName`, s.`Quantity`,
                    s.`WarehouseQtyBefore`, s.`WarehouseQtyAfter`, s.`StoreQtyBefore`, s.`StoreQtyAfter`,
                    s.`WarehouseBatchId`, s.`WarehouseBatchLotCode`,
                    (
                        SELECT o.`Id`
                        FROM `ProductionOrderOutputLines` o
                        WHERE o.`ProductionOrderId` = s.`ProductionOrderId`
                        ORDER BY
                            CASE
                                WHEN s.`WarehouseBatchId` IS NOT NULL AND o.`WarehouseBatchId` = s.`WarehouseBatchId` THEN 0
                                ELSE 1
                            END,
                            o.`CreatedAt`
                        LIMIT 1
                    ),
                    s.`Note`, s.`CreatedAt`
                FROM `StockImportSlips` s
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM `StockImportSlipLines` l
                    WHERE l.`StockImportSlipId` = s.`Id`
                );
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StockImportSlipLines");
        }
    }
}
