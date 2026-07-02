using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddProductionOrderOutputLines : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductionOrderOutputLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProductionOrderId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    FinishedSkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    FinishedSkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    FinishedSkuSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    WarehouseBatchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    WarehouseBatchLotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionOrderOutputLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductionOrderOutputLines_ProductionOrders_ProductionOrderId",
                        column: x => x.ProductionOrderId,
                        principalTable: "ProductionOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionOrderOutputLines_WarehouseBatches_WarehouseBatchId",
                        column: x => x.WarehouseBatchId,
                        principalTable: "WarehouseBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionOrderOutputLines_FinishedSkuId",
                table: "ProductionOrderOutputLines",
                column: "FinishedSkuId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionOrderOutputLines_ProductionOrderId",
                table: "ProductionOrderOutputLines",
                column: "ProductionOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionOrderOutputLines_WarehouseBatchId",
                table: "ProductionOrderOutputLines",
                column: "WarehouseBatchId");

            migrationBuilder.Sql("""
                INSERT INTO `ProductionOrderOutputLines`
                    (`Id`, `ProductionOrderId`, `FinishedSkuId`, `FinishedSkuCode`, `FinishedSkuSnapshotName`,
                     `Quantity`, `WarehouseBatchId`, `WarehouseBatchLotCode`, `CreatedAt`)
                SELECT
                    UUID(), p.`Id`, p.`FinishedSkuId`, p.`FinishedSkuCode`, p.`FinishedSkuSnapshotName`,
                    p.`Quantity`, NULL, NULL, p.`CreatedAt`
                FROM `ProductionOrders` p
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM `ProductionOrderOutputLines` l
                    WHERE l.`ProductionOrderId` = p.`Id`
                );
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductionOrderOutputLines");
        }
    }
}
