using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class StockAdjustmentRequestItems : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StockAdjustmentRequestItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    RequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SkuSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    QuantityDelta = table.Column<int>(type: "int", nullable: false),
                    QuantityOnHandSnapshot = table.Column<int>(type: "int", nullable: false),
                    QuantityOnHandAfter = table.Column<int>(type: "int", nullable: true),
                    WarehouseQuantityOnHandAfter = table.Column<int>(type: "int", nullable: true),
                    ExportSlipId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockAdjustmentRequestItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockAdjustmentRequestItems_StockAdjustmentRequests_RequestId",
                        column: x => x.RequestId,
                        principalTable: "StockAdjustmentRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StockAdjustmentRequestItems_StockExportSlips_ExportSlipId",
                        column: x => x.ExportSlipId,
                        principalTable: "StockExportSlips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql(@"
INSERT INTO StockAdjustmentRequestItems (
    Id, RequestId, SkuId, SkuCode, SkuSnapshotName,
    QuantityDelta, QuantityOnHandSnapshot, QuantityOnHandAfter,
    WarehouseQuantityOnHandAfter, ExportSlipId)
SELECT
    UUID(), Id, SkuId, SkuCode, SkuSnapshotName,
    QuantityDelta, QuantityOnHandSnapshot, QuantityOnHandAfter,
    WarehouseQuantityOnHandAfter, ExportSlipId
FROM StockAdjustmentRequests
WHERE SkuId <> '00000000-0000-0000-0000-000000000000';
");

            migrationBuilder.DropForeignKey(
                name: "FK_StockAdjustmentRequests_StockExportSlips_ExportSlipId",
                table: "StockAdjustmentRequests");

            migrationBuilder.DropIndex(
                name: "IX_StockAdjustmentRequests_ExportSlipId",
                table: "StockAdjustmentRequests");

            migrationBuilder.DropColumn(name: "SkuId", table: "StockAdjustmentRequests");
            migrationBuilder.DropColumn(name: "SkuCode", table: "StockAdjustmentRequests");
            migrationBuilder.DropColumn(name: "SkuSnapshotName", table: "StockAdjustmentRequests");
            migrationBuilder.DropColumn(name: "QuantityDelta", table: "StockAdjustmentRequests");
            migrationBuilder.DropColumn(name: "QuantityOnHandSnapshot", table: "StockAdjustmentRequests");
            migrationBuilder.DropColumn(name: "QuantityOnHandAfter", table: "StockAdjustmentRequests");
            migrationBuilder.DropColumn(name: "WarehouseQuantityOnHandAfter", table: "StockAdjustmentRequests");
            migrationBuilder.DropColumn(name: "ExportSlipId", table: "StockAdjustmentRequests");

            migrationBuilder.CreateIndex(
                name: "IX_StockAdjustmentRequestItems_ExportSlipId",
                table: "StockAdjustmentRequestItems",
                column: "ExportSlipId");

            migrationBuilder.CreateIndex(
                name: "IX_StockAdjustmentRequestItems_RequestId",
                table: "StockAdjustmentRequestItems",
                column: "RequestId");

            migrationBuilder.CreateIndex(
                name: "IX_StockAdjustmentRequestItems_SkuId",
                table: "StockAdjustmentRequestItems",
                column: "SkuId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SkuId",
                table: "StockAdjustmentRequests",
                type: "char(36)",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "SkuCode",
                table: "StockAdjustmentRequests",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SkuSnapshotName",
                table: "StockAdjustmentRequests",
                type: "varchar(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "QuantityDelta",
                table: "StockAdjustmentRequests",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "QuantityOnHandSnapshot",
                table: "StockAdjustmentRequests",
                type: "int",
                nullable: false,
                defaultValue: 0);

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

            migrationBuilder.AddColumn<Guid>(
                name: "ExportSlipId",
                table: "StockAdjustmentRequests",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.Sql(@"
UPDATE StockAdjustmentRequests r
INNER JOIN (
    SELECT RequestId, SkuId, SkuCode, SkuSnapshotName, QuantityDelta,
           QuantityOnHandSnapshot, QuantityOnHandAfter, WarehouseQuantityOnHandAfter, ExportSlipId
    FROM StockAdjustmentRequestItems i
    WHERE i.Id = (
        SELECT i2.Id FROM StockAdjustmentRequestItems i2
        WHERE i2.RequestId = i.RequestId
        ORDER BY i2.Id LIMIT 1
    )
) x ON r.Id = x.RequestId
SET
    r.SkuId = x.SkuId,
    r.SkuCode = x.SkuCode,
    r.SkuSnapshotName = x.SkuSnapshotName,
    r.QuantityDelta = x.QuantityDelta,
    r.QuantityOnHandSnapshot = x.QuantityOnHandSnapshot,
    r.QuantityOnHandAfter = x.QuantityOnHandAfter,
    r.WarehouseQuantityOnHandAfter = x.WarehouseQuantityOnHandAfter,
    r.ExportSlipId = x.ExportSlipId;
");

            migrationBuilder.DropTable(name: "StockAdjustmentRequestItems");

            migrationBuilder.CreateIndex(
                name: "IX_StockAdjustmentRequests_ExportSlipId",
                table: "StockAdjustmentRequests",
                column: "ExportSlipId");

            migrationBuilder.AddForeignKey(
                name: "FK_StockAdjustmentRequests_StockExportSlips_ExportSlipId",
                table: "StockAdjustmentRequests",
                column: "ExportSlipId",
                principalTable: "StockExportSlips",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
