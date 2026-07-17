using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddInventoryLedgerAndSupplierReceipts : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "InventoryLedgerEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    TransactionGroupId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    OccurredAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    SkuNameSnapshot = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    ProductTypeSnapshot = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    InventoryUnitSnapshot = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    Location = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    QuantityBefore = table.Column<int>(type: "int", nullable: false),
                    QuantityDelta = table.Column<int>(type: "int", nullable: false),
                    QuantityAfter = table.Column<int>(type: "int", nullable: false),
                    TransactionType = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    SourceLocation = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    DestinationLocation = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    ReferenceType = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    ReferenceId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    ReferenceCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    BatchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    LotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    ActorId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    ActorName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    ActorRole = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    Reason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    CorrelationId = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryLedgerEntries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SupplierReceipts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ReceiptCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    SupplierName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    SupplierReference = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    SupplierDocumentNumber = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    SupplierDocumentDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ReceivedDate = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CreatedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    CreatedByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    SubmittedBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    SubmittedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ReviewedBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    ReviewedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    ReviewedByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ReviewNote = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    StockImportSlipId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    StockImportSlipCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupplierReceipts", x => x.Id);
                });

            migrationBuilder.AddColumn<Guid>(
                name: "SupplierReceiptId",
                table: "StockImportSlips",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "SupplierReceiptCode",
                table: "StockImportSlips",
                type: "varchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SupplierReceiptItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SupplierReceiptId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    SkuNameSnapshot = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    ProductTypeSnapshot = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    InventoryUnitSnapshot = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    SubmittedUnit = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    SubmittedQuantity = table.Column<decimal>(type: "decimal(18,3)", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    LotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    ManufacturedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ActualReceivedQuantity = table.Column<int>(type: "int", nullable: false),
                    QualityNote = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    WarehouseBatchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    WarehouseBatchLotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    WarehouseQtyBefore = table.Column<int>(type: "int", nullable: true),
                    WarehouseQtyAfter = table.Column<int>(type: "int", nullable: true),
                    ShelfQtyBefore = table.Column<int>(type: "int", nullable: true),
                    ShelfQtyAfter = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupplierReceiptItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupplierReceiptItems_SupplierReceipts_SupplierReceiptId",
                        column: x => x.SupplierReceiptId,
                        principalTable: "SupplierReceipts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SupplierReceiptItems_WarehouseBatches_WarehouseBatchId",
                        column: x => x.WarehouseBatchId,
                        principalTable: "WarehouseBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(name: "IX_InventoryLedgerEntries_ActorId", table: "InventoryLedgerEntries", column: "ActorId");
            migrationBuilder.CreateIndex(name: "IX_InventoryLedgerEntries_BatchId", table: "InventoryLedgerEntries", column: "BatchId");
            migrationBuilder.CreateIndex(name: "IX_InventoryLedgerEntries_CorrelationId", table: "InventoryLedgerEntries", column: "CorrelationId");
            migrationBuilder.CreateIndex(name: "IX_InventoryLedgerEntries_Location", table: "InventoryLedgerEntries", column: "Location");
            migrationBuilder.CreateIndex(name: "IX_InventoryLedgerEntries_OccurredAtUtc", table: "InventoryLedgerEntries", column: "OccurredAtUtc");
            migrationBuilder.CreateIndex(name: "IX_InventoryLedgerEntries_ReferenceCode", table: "InventoryLedgerEntries", column: "ReferenceCode");
            migrationBuilder.CreateIndex(name: "IX_InventoryLedgerEntries_SkuCode", table: "InventoryLedgerEntries", column: "SkuCode");
            migrationBuilder.CreateIndex(name: "IX_InventoryLedgerEntries_SkuId", table: "InventoryLedgerEntries", column: "SkuId");
            migrationBuilder.CreateIndex(name: "IX_InventoryLedgerEntries_TransactionGroupId", table: "InventoryLedgerEntries", column: "TransactionGroupId");
            migrationBuilder.CreateIndex(name: "IX_InventoryLedgerEntries_TransactionType", table: "InventoryLedgerEntries", column: "TransactionType");

            migrationBuilder.CreateIndex(name: "IX_StockImportSlips_SupplierReceiptCode", table: "StockImportSlips", column: "SupplierReceiptCode");
            migrationBuilder.CreateIndex(name: "IX_StockImportSlips_SupplierReceiptId", table: "StockImportSlips", column: "SupplierReceiptId");

            migrationBuilder.CreateIndex(name: "IX_SupplierReceiptItems_LotCode", table: "SupplierReceiptItems", column: "LotCode");
            migrationBuilder.CreateIndex(name: "IX_SupplierReceiptItems_SkuId", table: "SupplierReceiptItems", column: "SkuId");
            migrationBuilder.CreateIndex(name: "IX_SupplierReceiptItems_SupplierReceiptId", table: "SupplierReceiptItems", column: "SupplierReceiptId");
            migrationBuilder.CreateIndex(name: "IX_SupplierReceiptItems_WarehouseBatchId", table: "SupplierReceiptItems", column: "WarehouseBatchId");

            migrationBuilder.CreateIndex(name: "IX_SupplierReceipts_CreatedAt", table: "SupplierReceipts", column: "CreatedAt");
            migrationBuilder.CreateIndex(name: "IX_SupplierReceipts_CreatedBy", table: "SupplierReceipts", column: "CreatedBy");
            migrationBuilder.CreateIndex(name: "IX_SupplierReceipts_ReceiptCode", table: "SupplierReceipts", column: "ReceiptCode", unique: true);
            migrationBuilder.CreateIndex(name: "IX_SupplierReceipts_ReceivedDate", table: "SupplierReceipts", column: "ReceivedDate");
            migrationBuilder.CreateIndex(name: "IX_SupplierReceipts_Status", table: "SupplierReceipts", column: "Status");
            migrationBuilder.CreateIndex(name: "IX_SupplierReceipts_StockImportSlipId", table: "SupplierReceipts", column: "StockImportSlipId");
            migrationBuilder.CreateIndex(name: "IX_SupplierReceipts_SupplierName", table: "SupplierReceipts", column: "SupplierName");

            migrationBuilder.AddForeignKey(
                name: "FK_StockImportSlips_SupplierReceipts_SupplierReceiptId",
                table: "StockImportSlips",
                column: "SupplierReceiptId",
                principalTable: "SupplierReceipts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_StockImportSlips_SupplierReceipts_SupplierReceiptId", table: "StockImportSlips");
            migrationBuilder.DropTable(name: "InventoryLedgerEntries");
            migrationBuilder.DropTable(name: "SupplierReceiptItems");
            migrationBuilder.DropTable(name: "SupplierReceipts");
            migrationBuilder.DropIndex(name: "IX_StockImportSlips_SupplierReceiptCode", table: "StockImportSlips");
            migrationBuilder.DropIndex(name: "IX_StockImportSlips_SupplierReceiptId", table: "StockImportSlips");
            migrationBuilder.DropColumn(name: "SupplierReceiptCode", table: "StockImportSlips");
            migrationBuilder.DropColumn(name: "SupplierReceiptId", table: "StockImportSlips");
        }
    }
}
