using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class RefactorProductionOrdersToMultiOutput : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Quantity",
                table: "ProductionOrderOutputLines",
                newName: "PlannedQuantity");

            migrationBuilder.Sql("""
                INSERT INTO `ProductionOrderOutputLines`
                    (`Id`, `ProductionOrderId`, `FinishedSkuId`, `FinishedSkuCode`, `FinishedSkuSnapshotName`,
                     `PlannedQuantity`, `WarehouseBatchId`, `WarehouseBatchLotCode`, `CreatedAt`)
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

            migrationBuilder.CreateIndex(
                name: "IX_ProductionOrderOutputLines_ProductionOrderId_FinishedSkuId",
                table: "ProductionOrderOutputLines",
                columns: new[] { "ProductionOrderId", "FinishedSkuId" },
                unique: true);

            migrationBuilder.DropColumn(
                name: "FinishedSkuCode",
                table: "ProductionOrders");

            migrationBuilder.DropColumn(
                name: "FinishedSkuId",
                table: "ProductionOrders");

            migrationBuilder.DropColumn(
                name: "FinishedSkuSnapshotName",
                table: "ProductionOrders");

            migrationBuilder.DropColumn(
                name: "Quantity",
                table: "ProductionOrders");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FinishedSkuCode",
                table: "ProductionOrders",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "FinishedSkuId",
                table: "ProductionOrders",
                type: "char(36)",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "FinishedSkuSnapshotName",
                table: "ProductionOrders",
                type: "varchar(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "Quantity",
                table: "ProductionOrders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("""
                UPDATE `ProductionOrders` p
                SET
                    p.`FinishedSkuId` = COALESCE((
                        SELECT l.`FinishedSkuId`
                        FROM `ProductionOrderOutputLines` l
                        WHERE l.`ProductionOrderId` = p.`Id`
                        ORDER BY l.`CreatedAt`, l.`FinishedSkuCode`
                        LIMIT 1
                    ), '00000000-0000-0000-0000-000000000000'),
                    p.`FinishedSkuCode` = COALESCE((
                        SELECT l.`FinishedSkuCode`
                        FROM `ProductionOrderOutputLines` l
                        WHERE l.`ProductionOrderId` = p.`Id`
                        ORDER BY l.`CreatedAt`, l.`FinishedSkuCode`
                        LIMIT 1
                    ), ''),
                    p.`FinishedSkuSnapshotName` = COALESCE((
                        SELECT l.`FinishedSkuSnapshotName`
                        FROM `ProductionOrderOutputLines` l
                        WHERE l.`ProductionOrderId` = p.`Id`
                        ORDER BY l.`CreatedAt`, l.`FinishedSkuCode`
                        LIMIT 1
                    ), ''),
                    p.`Quantity` = COALESCE((
                        SELECT l.`PlannedQuantity`
                        FROM `ProductionOrderOutputLines` l
                        WHERE l.`ProductionOrderId` = p.`Id`
                        ORDER BY l.`CreatedAt`, l.`FinishedSkuCode`
                        LIMIT 1
                    ), 0);
                """);

            migrationBuilder.DropIndex(
                name: "IX_ProductionOrderOutputLines_ProductionOrderId_FinishedSkuId",
                table: "ProductionOrderOutputLines");

            migrationBuilder.RenameColumn(
                name: "PlannedQuantity",
                table: "ProductionOrderOutputLines",
                newName: "Quantity");
        }
    }
}
