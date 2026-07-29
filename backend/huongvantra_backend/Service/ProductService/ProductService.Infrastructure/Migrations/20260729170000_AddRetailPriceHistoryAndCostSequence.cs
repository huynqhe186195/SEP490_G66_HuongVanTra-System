using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductService.Infrastructure.Data;

#nullable disable

namespace ProductService.Infrastructure.Migrations;

[DbContext(typeof(ProductDbContext))]
[Migration("20260729170000_AddRetailPriceHistoryAndCostSequence")]
public partial class AddRetailPriceHistoryAndCostSequence : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "ReceiptLineOrder",
            table: "ProductCostPriceHistories",
            type: "int",
            nullable: false,
            defaultValue: 1);

        migrationBuilder.AddColumn<int>(
            name: "ReceiptSkuLineCount",
            table: "ProductCostPriceHistories",
            type: "int",
            nullable: false,
            defaultValue: 1);

        migrationBuilder.CreateTable(
            name: "ProductRetailPriceHistories",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                OldRetailPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                NewRetailPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                ChangedBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                ChangedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                ChangedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                SourceType = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                Note = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4")
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ProductRetailPriceHistories", x => x.Id);
                table.ForeignKey(
                    name: "FK_ProductRetailPriceHistories_ProductVariants_SkuId",
                    column: x => x.SkuId,
                    principalTable: "ProductVariants",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            })
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.CreateIndex(
            name: "IX_ProductCostPriceHistories_SkuId_SourceApprovedAt_ReceiptLineOrder",
            table: "ProductCostPriceHistories",
            columns: new[] { "SkuId", "SourceApprovedAt", "ReceiptLineOrder" });

        migrationBuilder.CreateIndex(
            name: "IX_ProductRetailPriceHistories_SkuId_ChangedAt",
            table: "ProductRetailPriceHistories",
            columns: new[] { "SkuId", "ChangedAt" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "ProductRetailPriceHistories");

        migrationBuilder.DropIndex(
            name: "IX_ProductCostPriceHistories_SkuId_SourceApprovedAt_ReceiptLineOrder",
            table: "ProductCostPriceHistories");

        migrationBuilder.DropColumn(
            name: "ReceiptLineOrder",
            table: "ProductCostPriceHistories");

        migrationBuilder.DropColumn(
            name: "ReceiptSkuLineCount",
            table: "ProductCostPriceHistories");
    }
}
