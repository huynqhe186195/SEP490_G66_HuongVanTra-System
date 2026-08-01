using System;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

/// <summary>
/// Gợi ý bổ sung Kệ Hàng sinh tự động khi duyệt phiếu kiểm kệ (Location = Shelf).
///
/// Gợi ý KHÔNG chứa số lượng cần bổ sung — chỉ chụp lại hiện trạng tồn Kệ / ngưỡng / tồn Kho
/// tại thời điểm duyệt; Warehouse tự quyết định số lượng khi tạo phiếu điều chuyển.
///
/// IX_ShelfReplenishmentSuggestions_SourceStocktakeRequestId là UNIQUE để duyệt lại
/// cùng một phiếu kiểm kệ không sinh gợi ý trùng (idempotency).
///
/// StockTransfers.SourceSuggestionId là liên kết ngược nullable, KHÔNG unique:
/// một gợi ý có thể được xử lý bằng nhiều phiếu điều chuyển, và phiếu tạo trực tiếp vẫn hợp lệ.
/// </summary>
[DbContext(typeof(InventoryDbContext))]
[Migration("20260801090000_AddShelfReplenishmentSuggestions")]
public partial class AddShelfReplenishmentSuggestions : Migration
{
    private const string TransferSuggestionForeignKey =
        "FK_StockTransfers_ShelfReplenishmentSuggestions_SourceSuggestionI";

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ShelfReplenishmentSuggestions",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SuggestionCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                SourceStocktakeRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SourceStocktakeCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                HandledBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                HandledByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                HandledByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                HandledAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                HandledNote = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ShelfReplenishmentSuggestions", x => x.Id);
                table.ForeignKey(
                    name: "FK_ShelfReplenishmentSuggestions_StocktakeRequests_SourceStockta",
                    column: x => x.SourceStocktakeRequestId,
                    principalTable: "StocktakeRequests",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "ShelfReplenishmentSuggestionItems",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SuggestionId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                SkuSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                InventoryUnitSnapshot = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                ShelfQuantityAtStocktake = table.Column<int>(type: "int", nullable: false),
                ShelfReservedAtStocktake = table.Column<int>(type: "int", nullable: false),
                ShelfLowStockThreshold = table.Column<int>(type: "int", nullable: false),
                WarehouseQuantityAtStocktake = table.Column<int>(type: "int", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ShelfReplenishmentSuggestionItems", x => x.Id);
                table.ForeignKey(
                    name: "FK_ShelfReplenishmentSuggestionItems_ShelfReplenishmentSuggestio",
                    column: x => x.SuggestionId,
                    principalTable: "ShelfReplenishmentSuggestions",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ShelfReplenishmentSuggestions_SuggestionCode",
            table: "ShelfReplenishmentSuggestions",
            column: "SuggestionCode",
            unique: true);

        // Idempotency: một phiếu kiểm kệ chỉ sinh tối đa một gợi ý.
        migrationBuilder.CreateIndex(
            name: "IX_ShelfReplenishmentSuggestions_SourceStocktakeRequestId",
            table: "ShelfReplenishmentSuggestions",
            column: "SourceStocktakeRequestId",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_ShelfReplenishmentSuggestions_Status",
            table: "ShelfReplenishmentSuggestions",
            column: "Status");

        migrationBuilder.CreateIndex(
            name: "IX_ShelfReplenishmentSuggestions_CreatedAt",
            table: "ShelfReplenishmentSuggestions",
            column: "CreatedAt");

        migrationBuilder.CreateIndex(
            name: "IX_ShelfReplenishmentSuggestionItems_SuggestionId",
            table: "ShelfReplenishmentSuggestionItems",
            column: "SuggestionId");

        migrationBuilder.CreateIndex(
            name: "IX_ShelfReplenishmentSuggestionItems_SkuId",
            table: "ShelfReplenishmentSuggestionItems",
            column: "SkuId");

        migrationBuilder.CreateIndex(
            name: "IX_ShelfReplenishmentSuggestionItems_SuggestionId_SkuId",
            table: "ShelfReplenishmentSuggestionItems",
            columns: ["SuggestionId", "SkuId"],
            unique: true);

        migrationBuilder.AddColumn<Guid>(
            name: "SourceSuggestionId",
            table: "StockTransfers",
            type: "char(36)",
            nullable: true,
            collation: "ascii_general_ci");

        migrationBuilder.CreateIndex(
            name: "IX_StockTransfers_SourceSuggestionId",
            table: "StockTransfers",
            column: "SourceSuggestionId");

        migrationBuilder.AddForeignKey(
            name: TransferSuggestionForeignKey,
            table: "StockTransfers",
            column: "SourceSuggestionId",
            principalTable: "ShelfReplenishmentSuggestions",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(name: TransferSuggestionForeignKey, table: "StockTransfers");

        migrationBuilder.DropIndex(
            name: "IX_StockTransfers_SourceSuggestionId",
            table: "StockTransfers");

        migrationBuilder.DropColumn(name: "SourceSuggestionId", table: "StockTransfers");

        migrationBuilder.DropTable(name: "ShelfReplenishmentSuggestionItems");
        migrationBuilder.DropTable(name: "ShelfReplenishmentSuggestions");
    }
}
