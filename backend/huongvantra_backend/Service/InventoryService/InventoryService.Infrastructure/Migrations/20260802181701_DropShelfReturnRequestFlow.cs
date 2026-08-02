using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropShelfReturnRequestFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShelfReturnRequestItems");

            migrationBuilder.DropTable(
                name: "ShelfReturnRequests");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ShelfReturnRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CreatedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OriginalStockAdjustmentRequestCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OriginalStockAdjustmentRequestId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    Reason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ReturnCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ReturnMode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ReviewNote = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ReviewedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ReviewedBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    ReviewedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ReviewedByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Status = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShelfReturnRequests", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "ShelfReturnRequestItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ShelfBatchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    ShelfReturnRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    WarehouseBatchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    ShelfLotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ShelfQtyAfter = table.Column<int>(type: "int", nullable: true),
                    ShelfQtyBefore = table.Column<int>(type: "int", nullable: true),
                    SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StockExportSlipCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StockExportSlipId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    StockImportSlipCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StockImportSlipId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    WarehouseBatchLotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    WarehouseQtyAfter = table.Column<int>(type: "int", nullable: true),
                    WarehouseQtyBefore = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShelfReturnRequestItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShelfReturnRequestItems_ShelfReturnRequests_ShelfReturnReque~",
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
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequestItems_ShelfBatchId",
                table: "ShelfReturnRequestItems",
                column: "ShelfBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequestItems_ShelfReturnRequestId",
                table: "ShelfReturnRequestItems",
                column: "ShelfReturnRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequestItems_SkuId",
                table: "ShelfReturnRequestItems",
                column: "SkuId");

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequestItems_StockExportSlipId",
                table: "ShelfReturnRequestItems",
                column: "StockExportSlipId");

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequestItems_StockImportSlipId",
                table: "ShelfReturnRequestItems",
                column: "StockImportSlipId");

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequestItems_WarehouseBatchId",
                table: "ShelfReturnRequestItems",
                column: "WarehouseBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequests_CreatedAt",
                table: "ShelfReturnRequests",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequests_CreatedBy",
                table: "ShelfReturnRequests",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequests_OriginalStockAdjustmentRequestCode",
                table: "ShelfReturnRequests",
                column: "OriginalStockAdjustmentRequestCode");

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequests_OriginalStockAdjustmentRequestId",
                table: "ShelfReturnRequests",
                column: "OriginalStockAdjustmentRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequests_ReturnCode",
                table: "ShelfReturnRequests",
                column: "ReturnCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequests_ReturnMode",
                table: "ShelfReturnRequests",
                column: "ReturnMode");

            migrationBuilder.CreateIndex(
                name: "IX_ShelfReturnRequests_Status",
                table: "ShelfReturnRequests",
                column: "Status");
        }
    }
}
