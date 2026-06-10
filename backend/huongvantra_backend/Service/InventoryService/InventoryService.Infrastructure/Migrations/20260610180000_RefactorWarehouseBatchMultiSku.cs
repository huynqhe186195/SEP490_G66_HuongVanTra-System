using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class RefactorWarehouseBatchMultiSku : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WarehouseBatchItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    WarehouseBatchId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    ProductSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    QuantityOnHand = table.Column<int>(type: "int", nullable: false),
                    InitialQuantity = table.Column<int>(type: "int", nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WarehouseBatchItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WarehouseBatchItems_WarehouseBatches_WarehouseBatchId",
                        column: x => x.WarehouseBatchId,
                        principalTable: "WarehouseBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("""
                INSERT INTO `WarehouseBatchItems`
                    (`Id`, `WarehouseBatchId`, `SkuId`, `SkuCode`, `ProductSnapshotName`, `QuantityOnHand`, `InitialQuantity`, `UnitCost`, `CreatedAt`, `UpdatedAt`)
                SELECT `Id`, `Id`, `SkuId`, `SkuCode`, `ProductSnapshotName`, `QuantityOnHand`, `InitialQuantity`, `UnitCost`, `CreatedAt`, `UpdatedAt`
                FROM `WarehouseBatches`;
                """);

            migrationBuilder.AddColumn<Guid>(
                name: "WarehouseBatchItemId",
                table: "StockExportBatchAllocations",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "SkuCode",
                table: "StockExportBatchAllocations",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("""
                UPDATE `StockExportBatchAllocations` a
                INNER JOIN `WarehouseBatchItems` i ON i.`WarehouseBatchId` = a.`WarehouseBatchId`
                SET a.`WarehouseBatchItemId` = i.`Id`, a.`SkuCode` = i.`SkuCode`;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "WarehouseBatchItemId",
                table: "StockExportBatchAllocations",
                type: "char(36)",
                nullable: false,
                collation: "ascii_general_ci");

            migrationBuilder.AlterColumn<string>(
                name: "SkuCode",
                table: "StockExportBatchAllocations",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_StockExportBatchAllocations_WarehouseBatchItemId",
                table: "StockExportBatchAllocations",
                column: "WarehouseBatchItemId");

            migrationBuilder.AddForeignKey(
                name: "FK_StockExportBatchAllocations_WarehouseBatchItems_WarehouseBatchItemId",
                table: "StockExportBatchAllocations",
                column: "WarehouseBatchItemId",
                principalTable: "WarehouseBatchItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.DropIndex(
                name: "IX_WarehouseBatches_SkuId_LotCode",
                table: "WarehouseBatches");

            migrationBuilder.DropIndex(
                name: "IX_WarehouseBatches_SkuId",
                table: "WarehouseBatches");

            migrationBuilder.DropColumn(name: "SkuId", table: "WarehouseBatches");
            migrationBuilder.DropColumn(name: "SkuCode", table: "WarehouseBatches");
            migrationBuilder.DropColumn(name: "ProductSnapshotName", table: "WarehouseBatches");
            migrationBuilder.DropColumn(name: "QuantityOnHand", table: "WarehouseBatches");
            migrationBuilder.DropColumn(name: "InitialQuantity", table: "WarehouseBatches");
            migrationBuilder.DropColumn(name: "UnitCost", table: "WarehouseBatches");

            migrationBuilder.CreateIndex(
                name: "IX_WarehouseBatches_LotCode",
                table: "WarehouseBatches",
                column: "LotCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WarehouseBatchItems_SkuId",
                table: "WarehouseBatchItems",
                column: "SkuId");

            migrationBuilder.CreateIndex(
                name: "IX_WarehouseBatchItems_WarehouseBatchId",
                table: "WarehouseBatchItems",
                column: "WarehouseBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_WarehouseBatchItems_WarehouseBatchId_SkuId",
                table: "WarehouseBatchItems",
                columns: new[] { "WarehouseBatchId", "SkuId" },
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("Rollback RefactorWarehouseBatchMultiSku is not supported.");
        }
    }
}
