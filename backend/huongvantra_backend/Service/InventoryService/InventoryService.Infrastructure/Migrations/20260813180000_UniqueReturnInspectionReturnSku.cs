using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using InventoryService.Infrastructure.Data;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

/// <summary>
/// Chống duplicate ReturnInspection khi backfill/hủy-sau-giao chạy song song.
/// Giữ 1 dòng / (ReturnId, SkuId); xóa bản thừa trước khi tạo unique index.
/// </summary>
[DbContext(typeof(InventoryDbContext))]
[Migration("20260813180000_UniqueReturnInspectionReturnSku")]
public partial class UniqueReturnInspectionReturnSku : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DELETE ri
            FROM ReturnInspections ri
            INNER JOIN (
                SELECT ReturnId, SkuId, MIN(Id) AS KeepId
                FROM ReturnInspections
                GROUP BY ReturnId, SkuId
                HAVING COUNT(*) > 1
            ) d ON ri.ReturnId = d.ReturnId AND ri.SkuId = d.SkuId
            WHERE ri.Id <> d.KeepId;
            """);

        migrationBuilder.DropIndex(
            name: "IX_ReturnInspections_ReturnId_SkuId",
            table: "ReturnInspections");

        migrationBuilder.CreateIndex(
            name: "IX_ReturnInspections_ReturnId_SkuId",
            table: "ReturnInspections",
            columns: new[] { "ReturnId", "SkuId" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_ReturnInspections_ReturnId_SkuId",
            table: "ReturnInspections");

        migrationBuilder.CreateIndex(
            name: "IX_ReturnInspections_ReturnId_SkuId",
            table: "ReturnInspections",
            columns: new[] { "ReturnId", "SkuId" });
    }
}
