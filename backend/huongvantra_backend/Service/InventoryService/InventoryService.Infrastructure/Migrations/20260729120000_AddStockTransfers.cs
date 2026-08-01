using System;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

/// <summary>
/// Phiếu điều chuyển Kho → Kệ (bản nền): StockTransfers, StockTransferLines,
/// StockTransferBatchAllocations. Migration này đã được áp dụng trên database local
/// nên phải giữ nguyên trong source để EF không cố tạo lại ba bảng.
/// Liên kết ngược về Yêu cầu bổ sung Kệ Hàng được bổ sung ở migration
/// 20260731093000_AddStockTransferRequestLinks.
/// </summary>
[DbContext(typeof(InventoryDbContext))]
[Migration("20260729120000_AddStockTransfers")]
public partial class AddStockTransfers : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "StockTransfers",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                TransferCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                SourceLocation = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                DestinationLocation = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                CreatedBy = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                CreatedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                CreatedByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                CompletedBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                CompletedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                CompletedByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                CompletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                CancelledBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                CancelledAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                CancellationReason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                ExportSlipId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                ImportSlipId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_StockTransfers", x => x.Id);
                table.ForeignKey(
                    name: "FK_StockTransfers_StockExportSlips_ExportSlipId",
                    column: x => x.ExportSlipId,
                    principalTable: "StockExportSlips",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.SetNull);
                table.ForeignKey(
                    name: "FK_StockTransfers_StockImportSlips_ImportSlipId",
                    column: x => x.ImportSlipId,
                    principalTable: "StockImportSlips",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateTable(
            name: "StockTransferLines",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                StockTransferId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                SkuNameSnapshot = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                UnitNameSnapshot = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                Quantity = table.Column<int>(type: "int", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_StockTransferLines", x => x.Id);
                table.ForeignKey(
                    name: "FK_StockTransferLines_StockTransfers_StockTransferId",
                    column: x => x.StockTransferId,
                    principalTable: "StockTransfers",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "StockTransferBatchAllocations",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                StockTransferId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                StockTransferLineId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SourceWarehouseBatchId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SourceWarehouseBatchItemId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                DestinationWarehouseBatchId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                DestinationWarehouseBatchItemId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                Quantity = table.Column<int>(type: "int", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_StockTransferBatchAllocations", x => x.Id);
                table.ForeignKey(
                    name: "FK_StockTransferBatchAllocations_StockTransferLines_StockTransfe",
                    column: x => x.StockTransferLineId,
                    principalTable: "StockTransferLines",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_StockTransferBatchAllocations_StockTransfers_StockTransferId",
                    column: x => x.StockTransferId,
                    principalTable: "StockTransfers",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_StockTransferBatchAllocations_WarehouseBatchItems_Destination",
                    column: x => x.DestinationWarehouseBatchItemId,
                    principalTable: "WarehouseBatchItems",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_StockTransferBatchAllocations_WarehouseBatchItems_SourceWareh",
                    column: x => x.SourceWarehouseBatchItemId,
                    principalTable: "WarehouseBatchItems",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_StockTransferBatchAllocations_WarehouseBatches_DestinationWar",
                    column: x => x.DestinationWarehouseBatchId,
                    principalTable: "WarehouseBatches",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_StockTransferBatchAllocations_WarehouseBatches_SourceWarehous",
                    column: x => x.SourceWarehouseBatchId,
                    principalTable: "WarehouseBatches",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(name: "IX_StockTransfers_CompletedAt", table: "StockTransfers", column: "CompletedAt");
        migrationBuilder.CreateIndex(name: "IX_StockTransfers_CreatedAt", table: "StockTransfers", column: "CreatedAt");
        migrationBuilder.CreateIndex(name: "IX_StockTransfers_CreatedBy", table: "StockTransfers", column: "CreatedBy");
        migrationBuilder.CreateIndex(name: "IX_StockTransfers_ExportSlipId", table: "StockTransfers", column: "ExportSlipId");
        migrationBuilder.CreateIndex(name: "IX_StockTransfers_ImportSlipId", table: "StockTransfers", column: "ImportSlipId");
        migrationBuilder.CreateIndex(name: "IX_StockTransfers_Status", table: "StockTransfers", column: "Status");
        migrationBuilder.CreateIndex(name: "IX_StockTransfers_TransferCode", table: "StockTransfers", column: "TransferCode", unique: true);
        migrationBuilder.CreateIndex(name: "IX_StockTransferLines_SkuId", table: "StockTransferLines", column: "SkuId");
        migrationBuilder.CreateIndex(name: "IX_StockTransferLines_StockTransferId", table: "StockTransferLines", column: "StockTransferId");
        migrationBuilder.CreateIndex(
            name: "IX_StockTransferLines_StockTransferId_SkuId",
            table: "StockTransferLines",
            columns: ["StockTransferId", "SkuId"],
            unique: true);
        migrationBuilder.CreateIndex(name: "IX_StockTransferBatchAllocations_DestinationWarehouseBatchId", table: "StockTransferBatchAllocations", column: "DestinationWarehouseBatchId");
        migrationBuilder.CreateIndex(name: "IX_StockTransferBatchAllocations_DestinationWarehouseBatchItemId", table: "StockTransferBatchAllocations", column: "DestinationWarehouseBatchItemId");
        migrationBuilder.CreateIndex(name: "IX_StockTransferBatchAllocations_SourceWarehouseBatchId", table: "StockTransferBatchAllocations", column: "SourceWarehouseBatchId");
        migrationBuilder.CreateIndex(name: "IX_StockTransferBatchAllocations_SourceWarehouseBatchItemId", table: "StockTransferBatchAllocations", column: "SourceWarehouseBatchItemId");
        migrationBuilder.CreateIndex(name: "IX_StockTransferBatchAllocations_StockTransferId", table: "StockTransferBatchAllocations", column: "StockTransferId");
        migrationBuilder.CreateIndex(name: "IX_StockTransferBatchAllocations_StockTransferLineId", table: "StockTransferBatchAllocations", column: "StockTransferLineId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "StockTransferBatchAllocations");
        migrationBuilder.DropTable(name: "StockTransferLines");
        migrationBuilder.DropTable(name: "StockTransfers");
    }
}
