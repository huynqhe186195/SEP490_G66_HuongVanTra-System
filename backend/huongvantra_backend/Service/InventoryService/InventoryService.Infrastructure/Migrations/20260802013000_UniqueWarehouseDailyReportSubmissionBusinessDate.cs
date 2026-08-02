using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

[DbContext(typeof(InventoryDbContext))]
[Migration("20260802013000_UniqueWarehouseDailyReportSubmissionBusinessDate")]
public partial class UniqueWarehouseDailyReportSubmissionBusinessDate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Giữ bản gửi sớm nhất mỗi ngày nếu đã spam trước khi có unique.
        migrationBuilder.Sql(
            """
            DELETE t1 FROM WarehouseDailyReportSubmissions t1
            INNER JOIN WarehouseDailyReportSubmissions t2
              ON t1.BusinessDate = t2.BusinessDate
             AND t1.SentAtUtc > t2.SentAtUtc;
            """);

        migrationBuilder.CreateIndex(
            name: "IX_WarehouseDailyReportSubmissions_BusinessDate",
            table: "WarehouseDailyReportSubmissions",
            column: "BusinessDate",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_WarehouseDailyReportSubmissions_BusinessDate",
            table: "WarehouseDailyReportSubmissions");
    }
}
