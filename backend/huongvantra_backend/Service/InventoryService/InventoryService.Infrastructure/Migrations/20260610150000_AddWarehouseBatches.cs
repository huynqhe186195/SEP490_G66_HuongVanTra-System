using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddWarehouseBatches : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WarehouseBatches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    LotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    ProductSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    QuantityOnHand = table.Column<int>(type: "int", nullable: false),
                    InitialQuantity = table.Column<int>(type: "int", nullable: false),
                    Supplier = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    UnitCost = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WarehouseBatches", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "StockExportBatchAllocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    StockExportSlipId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    WarehouseBatchId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    LotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockExportBatchAllocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockExportBatchAllocations_StockExportSlips_StockExportSlipId",
                        column: x => x.StockExportSlipId,
                        principalTable: "StockExportSlips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StockExportBatchAllocations_WarehouseBatches_WarehouseBatchId",
                        column: x => x.WarehouseBatchId,
                        principalTable: "WarehouseBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(name: "IX_WarehouseBatches_SkuId", table: "WarehouseBatches", column: "SkuId");
            migrationBuilder.CreateIndex(name: "IX_WarehouseBatches_SkuId_LotCode", table: "WarehouseBatches", columns: new[] { "SkuId", "LotCode" }, unique: true);
            migrationBuilder.CreateIndex(name: "IX_WarehouseBatches_ExpiresAt", table: "WarehouseBatches", column: "ExpiresAt");
            migrationBuilder.CreateIndex(name: "IX_WarehouseBatches_CreatedAt", table: "WarehouseBatches", column: "CreatedAt");
            migrationBuilder.CreateIndex(name: "IX_StockExportBatchAllocations_StockExportSlipId", table: "StockExportBatchAllocations", column: "StockExportSlipId");
            migrationBuilder.CreateIndex(name: "IX_StockExportBatchAllocations_WarehouseBatchId", table: "StockExportBatchAllocations", column: "WarehouseBatchId");

            migrationBuilder.Sql("""
                INSERT INTO `WarehouseBatches` (`Id`, `LotCode`, `SkuId`, `SkuCode`, `QuantityOnHand`, `InitialQuantity`, `Status`, `CreatedBy`, `CreatedAt`, `UpdatedAt`)
                SELECT UUID(), CONCAT('LEGACY-', s.`SkuCode`), s.`SkuId`, s.`SkuCode`, s.`WarehouseQuantityOnHand`, s.`WarehouseQuantityOnHand`, 'active',
                       '00000000-0000-0000-0000-000000000000', UTC_TIMESTAMP(), UTC_TIMESTAMP()
                FROM `SkuStocks` s
                WHERE s.`WarehouseQuantityOnHand` > 0;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "StockExportBatchAllocations");
            migrationBuilder.DropTable(name: "WarehouseBatches");
        }
    }
}
