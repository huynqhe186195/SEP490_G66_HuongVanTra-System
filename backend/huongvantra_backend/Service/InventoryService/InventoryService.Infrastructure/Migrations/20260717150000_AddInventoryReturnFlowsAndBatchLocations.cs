using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddInventoryReturnFlowsAndBatchLocations : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "WarehouseBatches",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Warehouse");

            migrationBuilder.AddColumn<Guid>(
                name: "ParentBatchId",
                table: "WarehouseBatches",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "SourceBatchId",
                table: "WarehouseBatches",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "ReferenceId",
                table: "StockImportSlips",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "ReferenceType",
                table: "StockImportSlips",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferenceCode",
                table: "StockImportSlips",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReferenceId",
                table: "StockExportSlips",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "ReferenceType",
                table: "StockExportSlips",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferenceCode",
                table: "StockExportSlips",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ShelfReturnRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ReturnCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    ReturnMode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    OriginalStockAdjustmentRequestId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    OriginalStockAdjustmentRequestCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    Reason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CreatedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    CreatedByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    ReviewedBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    ReviewedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    ReviewedByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ReviewNote = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShelfReturnRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SupplierReturnRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ReturnCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    ReturnMode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    SupplierReceiptId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    SupplierReceiptCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    SupplierName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    SupplierReference = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    Reason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CreatedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    CreatedByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    ReviewedBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    ReviewedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    ReviewedByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ReviewNote = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupplierReturnRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ShelfReturnRequestItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ShelfReturnRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    SkuSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    ShelfBatchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    ShelfLotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    ShelfQtyBefore = table.Column<int>(type: "int", nullable: true),
                    ShelfQtyAfter = table.Column<int>(type: "int", nullable: true),
                    WarehouseQtyBefore = table.Column<int>(type: "int", nullable: true),
                    WarehouseQtyAfter = table.Column<int>(type: "int", nullable: true),
                    StockExportSlipId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    StockExportSlipCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    StockImportSlipId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    StockImportSlipCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    WarehouseBatchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    WarehouseBatchLotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShelfReturnRequestItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShelfReturnRequestItems_ShelfReturnRequests_ShelfReturnRequestId",
                        column: x => x.ShelfReturnRequestId,
                        principalTable: "ShelfReturnRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ShelfReturnRequestItems_WarehouseBatches_ShelfBatchId",
                        column: x => x.ShelfBatchId,
                        principalTable: "WarehouseBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ShelfReturnRequestItems_WarehouseBatches_WarehouseBatchId",
                        column: x => x.WarehouseBatchId,
                        principalTable: "WarehouseBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "SupplierReturnRequestItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SupplierReturnRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    SkuSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    WarehouseBatchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    WarehouseBatchLotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    WarehouseQtyBefore = table.Column<int>(type: "int", nullable: true),
                    WarehouseQtyAfter = table.Column<int>(type: "int", nullable: true),
                    ShelfQtyBefore = table.Column<int>(type: "int", nullable: true),
                    ShelfQtyAfter = table.Column<int>(type: "int", nullable: true),
                    StockExportSlipId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    StockExportSlipCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupplierReturnRequestItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupplierReturnRequestItems_SupplierReturnRequests_SupplierReturnRequestId",
                        column: x => x.SupplierReturnRequestId,
                        principalTable: "SupplierReturnRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SupplierReturnRequestItems_WarehouseBatches_WarehouseBatchId",
                        column: x => x.WarehouseBatchId,
                        principalTable: "WarehouseBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(name: "IX_WarehouseBatches_Location", table: "WarehouseBatches", column: "Location");
            migrationBuilder.CreateIndex(name: "IX_WarehouseBatches_ParentBatchId", table: "WarehouseBatches", column: "ParentBatchId");
            migrationBuilder.CreateIndex(name: "IX_WarehouseBatches_SourceBatchId", table: "WarehouseBatches", column: "SourceBatchId");
            migrationBuilder.CreateIndex(name: "IX_StockImportSlips_ReferenceCode", table: "StockImportSlips", column: "ReferenceCode");
            migrationBuilder.CreateIndex(name: "IX_StockImportSlips_ReferenceId", table: "StockImportSlips", column: "ReferenceId");
            migrationBuilder.CreateIndex(name: "IX_StockExportSlips_ReferenceCode", table: "StockExportSlips", column: "ReferenceCode");
            migrationBuilder.CreateIndex(name: "IX_StockExportSlips_ReferenceId", table: "StockExportSlips", column: "ReferenceId");
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequestItems_ShelfBatchId", table: "ShelfReturnRequestItems", column: "ShelfBatchId");
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequestItems_ShelfReturnRequestId", table: "ShelfReturnRequestItems", column: "ShelfReturnRequestId");
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequestItems_SkuId", table: "ShelfReturnRequestItems", column: "SkuId");
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequestItems_StockExportSlipId", table: "ShelfReturnRequestItems", column: "StockExportSlipId");
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequestItems_StockImportSlipId", table: "ShelfReturnRequestItems", column: "StockImportSlipId");
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequestItems_WarehouseBatchId", table: "ShelfReturnRequestItems", column: "WarehouseBatchId");
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequests_CreatedAt", table: "ShelfReturnRequests", column: "CreatedAt");
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequests_CreatedBy", table: "ShelfReturnRequests", column: "CreatedBy");
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequests_OriginalStockAdjustmentRequestCode", table: "ShelfReturnRequests", column: "OriginalStockAdjustmentRequestCode");
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequests_OriginalStockAdjustmentRequestId", table: "ShelfReturnRequests", column: "OriginalStockAdjustmentRequestId");
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequests_ReturnCode", table: "ShelfReturnRequests", column: "ReturnCode", unique: true);
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequests_ReturnMode", table: "ShelfReturnRequests", column: "ReturnMode");
            migrationBuilder.CreateIndex(name: "IX_ShelfReturnRequests_Status", table: "ShelfReturnRequests", column: "Status");
            migrationBuilder.CreateIndex(name: "IX_SupplierReturnRequestItems_SkuId", table: "SupplierReturnRequestItems", column: "SkuId");
            migrationBuilder.CreateIndex(name: "IX_SupplierReturnRequestItems_StockExportSlipId", table: "SupplierReturnRequestItems", column: "StockExportSlipId");
            migrationBuilder.CreateIndex(name: "IX_SupplierReturnRequestItems_SupplierReturnRequestId", table: "SupplierReturnRequestItems", column: "SupplierReturnRequestId");
            migrationBuilder.CreateIndex(name: "IX_SupplierReturnRequestItems_WarehouseBatchId", table: "SupplierReturnRequestItems", column: "WarehouseBatchId");
            migrationBuilder.CreateIndex(name: "IX_SupplierReturnRequests_CreatedAt", table: "SupplierReturnRequests", column: "CreatedAt");
            migrationBuilder.CreateIndex(name: "IX_SupplierReturnRequests_CreatedBy", table: "SupplierReturnRequests", column: "CreatedBy");
            migrationBuilder.CreateIndex(name: "IX_SupplierReturnRequests_ReturnCode", table: "SupplierReturnRequests", column: "ReturnCode", unique: true);
            migrationBuilder.CreateIndex(name: "IX_SupplierReturnRequests_ReturnMode", table: "SupplierReturnRequests", column: "ReturnMode");
            migrationBuilder.CreateIndex(name: "IX_SupplierReturnRequests_Status", table: "SupplierReturnRequests", column: "Status");
            migrationBuilder.CreateIndex(name: "IX_SupplierReturnRequests_SupplierReceiptCode", table: "SupplierReturnRequests", column: "SupplierReceiptCode");
            migrationBuilder.CreateIndex(name: "IX_SupplierReturnRequests_SupplierReceiptId", table: "SupplierReturnRequests", column: "SupplierReceiptId");

            migrationBuilder.AddForeignKey(
                name: "FK_WarehouseBatches_WarehouseBatches_ParentBatchId",
                table: "WarehouseBatches",
                column: "ParentBatchId",
                principalTable: "WarehouseBatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_WarehouseBatches_WarehouseBatches_SourceBatchId",
                table: "WarehouseBatches",
                column: "SourceBatchId",
                principalTable: "WarehouseBatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_WarehouseBatches_WarehouseBatches_ParentBatchId", table: "WarehouseBatches");
            migrationBuilder.DropForeignKey(name: "FK_WarehouseBatches_WarehouseBatches_SourceBatchId", table: "WarehouseBatches");
            migrationBuilder.DropTable(name: "ShelfReturnRequestItems");
            migrationBuilder.DropTable(name: "SupplierReturnRequestItems");
            migrationBuilder.DropTable(name: "ShelfReturnRequests");
            migrationBuilder.DropTable(name: "SupplierReturnRequests");
            migrationBuilder.DropIndex(name: "IX_WarehouseBatches_Location", table: "WarehouseBatches");
            migrationBuilder.DropIndex(name: "IX_WarehouseBatches_ParentBatchId", table: "WarehouseBatches");
            migrationBuilder.DropIndex(name: "IX_WarehouseBatches_SourceBatchId", table: "WarehouseBatches");
            migrationBuilder.DropIndex(name: "IX_StockImportSlips_ReferenceCode", table: "StockImportSlips");
            migrationBuilder.DropIndex(name: "IX_StockImportSlips_ReferenceId", table: "StockImportSlips");
            migrationBuilder.DropIndex(name: "IX_StockExportSlips_ReferenceCode", table: "StockExportSlips");
            migrationBuilder.DropIndex(name: "IX_StockExportSlips_ReferenceId", table: "StockExportSlips");
            migrationBuilder.DropColumn(name: "Location", table: "WarehouseBatches");
            migrationBuilder.DropColumn(name: "ParentBatchId", table: "WarehouseBatches");
            migrationBuilder.DropColumn(name: "SourceBatchId", table: "WarehouseBatches");
            migrationBuilder.DropColumn(name: "ReferenceCode", table: "StockImportSlips");
            migrationBuilder.DropColumn(name: "ReferenceId", table: "StockImportSlips");
            migrationBuilder.DropColumn(name: "ReferenceType", table: "StockImportSlips");
            migrationBuilder.DropColumn(name: "ReferenceCode", table: "StockExportSlips");
            migrationBuilder.DropColumn(name: "ReferenceId", table: "StockExportSlips");
            migrationBuilder.DropColumn(name: "ReferenceType", table: "StockExportSlips");
        }
    }
}
