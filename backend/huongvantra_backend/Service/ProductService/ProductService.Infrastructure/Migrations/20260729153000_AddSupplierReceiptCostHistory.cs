using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductService.Infrastructure.Data;

#nullable disable

namespace ProductService.Infrastructure.Migrations;

[DbContext(typeof(ProductDbContext))]
[Migration("20260729153000_AddSupplierReceiptCostHistory")]
public partial class AddSupplierReceiptCostHistory : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ProductCostPriceHistories",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                EventId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                OldCostPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                IncomingUnitCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                NewCostPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                SourceType = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                SourceReceiptId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SourceReceiptLineId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SourceReceiptCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                SourceApprovedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                WasApplied = table.Column<bool>(type: "tinyint(1)", nullable: false),
                ProcessingResult = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                UpdatedBy = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ProductCostPriceHistories", x => x.Id);
                table.ForeignKey(
                    name: "FK_ProductCostPriceHistories_ProductVariants_SkuId",
                    column: x => x.SkuId,
                    principalTable: "ProductVariants",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ProductCostPriceHistories_EventId",
            table: "ProductCostPriceHistories",
            column: "EventId",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_ProductCostPriceHistories_SkuId_SourceApprovedAt",
            table: "ProductCostPriceHistories",
            columns: new[] { "SkuId", "SourceApprovedAt" });

        migrationBuilder.CreateIndex(
            name: "IX_ProductCostPriceHistories_SourceReceiptLineId",
            table: "ProductCostPriceHistories",
            column: "SourceReceiptLineId",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "ProductCostPriceHistories");
    }
}
