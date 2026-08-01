using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

[DbContext(typeof(InventoryDbContext))]
[Migration("20260802010000_AddWarehouseDailyReportSubmissions")]
public partial class AddWarehouseDailyReportSubmissions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "WarehouseDailyReportSubmissions",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false),
                BusinessDate = table.Column<DateOnly>(type: "date", nullable: false),
                SentAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                SentBy = table.Column<Guid>(type: "char(36)", nullable: false),
                SentByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                SentByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                DoneTotal = table.Column<int>(type: "int", nullable: false),
                OpenCarryCount = table.Column<int>(type: "int", nullable: false),
                TotalWarehouseQuantity = table.Column<int>(type: "int", nullable: false),
                LowStockSkuCount = table.Column<int>(type: "int", nullable: false),
                ExpiringBatchCount30Days = table.Column<int>(type: "int", nullable: false),
                SnapshotJson = table.Column<string>(type: "longtext", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_WarehouseDailyReportSubmissions", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_WarehouseDailyReportSubmissions_SentAtUtc",
            table: "WarehouseDailyReportSubmissions",
            column: "SentAtUtc");

        migrationBuilder.CreateIndex(
            name: "IX_WarehouseDailyReportSubmissions_BusinessDate_SentAtUtc",
            table: "WarehouseDailyReportSubmissions",
            columns: new[] { "BusinessDate", "SentAtUtc" });

        migrationBuilder.CreateIndex(
            name: "IX_WarehouseDailyReportSubmissions_SentBy",
            table: "WarehouseDailyReportSubmissions",
            column: "SentBy");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "WarehouseDailyReportSubmissions");
    }
}
