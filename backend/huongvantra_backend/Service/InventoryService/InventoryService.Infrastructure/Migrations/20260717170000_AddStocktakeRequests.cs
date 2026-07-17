using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddStocktakeRequests : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StocktakeRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    RequestCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    Location = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    CountDate = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    Reason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
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
                    ReviewNote = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StocktakeRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StocktakeRequestItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    StocktakeRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    SkuSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    ProductTypeSnapshot = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    InventoryUnitSnapshot = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    SystemQuantitySnapshot = table.Column<int>(type: "int", nullable: false),
                    ActualQuantity = table.Column<int>(type: "int", nullable: false),
                    Variance = table.Column<int>(type: "int", nullable: false),
                    ReasonCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    WarehouseQtyBefore = table.Column<int>(type: "int", nullable: true),
                    WarehouseQtyAfter = table.Column<int>(type: "int", nullable: true),
                    ShelfQtyBefore = table.Column<int>(type: "int", nullable: true),
                    ShelfQtyAfter = table.Column<int>(type: "int", nullable: true),
                    StockExportSlipId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    StockExportSlipCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    StockImportSlipId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    StockImportSlipCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    WarehouseBatchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    WarehouseBatchLotCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StocktakeRequestItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StocktakeRequestItems_StockExportSlips_StockExportSlipId",
                        column: x => x.StockExportSlipId,
                        principalTable: "StockExportSlips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StocktakeRequestItems_StockImportSlips_StockImportSlipId",
                        column: x => x.StockImportSlipId,
                        principalTable: "StockImportSlips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StocktakeRequestItems_StocktakeRequests_StocktakeRequestId",
                        column: x => x.StocktakeRequestId,
                        principalTable: "StocktakeRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StocktakeRequestItems_WarehouseBatches_WarehouseBatchId",
                        column: x => x.WarehouseBatchId,
                        principalTable: "WarehouseBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequestItems_SkuId",
                table: "StocktakeRequestItems",
                column: "SkuId");

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequestItems_StockExportSlipId",
                table: "StocktakeRequestItems",
                column: "StockExportSlipId");

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequestItems_StockImportSlipId",
                table: "StocktakeRequestItems",
                column: "StockImportSlipId");

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequestItems_StocktakeRequestId",
                table: "StocktakeRequestItems",
                column: "StocktakeRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequestItems_WarehouseBatchId",
                table: "StocktakeRequestItems",
                column: "WarehouseBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequests_CountDate",
                table: "StocktakeRequests",
                column: "CountDate");

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequests_CreatedAt",
                table: "StocktakeRequests",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequests_CreatedBy",
                table: "StocktakeRequests",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequests_Location",
                table: "StocktakeRequests",
                column: "Location");

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequests_RequestCode",
                table: "StocktakeRequests",
                column: "RequestCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequests_ReviewedAt",
                table: "StocktakeRequests",
                column: "ReviewedAt");

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequests_Status",
                table: "StocktakeRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_StocktakeRequests_SubmittedAt",
                table: "StocktakeRequests",
                column: "SubmittedAt");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StocktakeRequestItems");

            migrationBuilder.DropTable(
                name: "StocktakeRequests");
        }
    }
}
