using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductService.Infrastructure.Data;

#nullable disable

namespace ProductService.Infrastructure.Migrations;

/// <summary>
/// Additive migration cho Weighted Average Cost:
/// - ProductVariant giữ cumulative state TotalApprovedInboundQuantity/Value và CostBasisReconciledAt.
/// - ProductCostPriceHistory ghi chi tiết từng lần nhập và tổng trước/sau.
///
/// Không backfill giá trị giả. Cumulative state được dựng lại bằng
/// CostBasisReconciliationService (chạy thủ công, không chạy trong migration).
/// </summary>
[DbContext(typeof(ProductDbContext))]
[Migration("20260730110000_AddWeightedAverageCostBasis")]
public partial class AddWeightedAverageCostBasis : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "TotalApprovedInboundQuantity",
            table: "ProductVariants",
            type: "decimal(18,4)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "TotalApprovedInboundValue",
            table: "ProductVariants",
            type: "decimal(20,4)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<DateTime>(
            name: "CostBasisReconciledAt",
            table: "ProductVariants",
            type: "datetime(6)",
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "IncomingQuantity",
            table: "ProductCostPriceHistories",
            type: "decimal(18,4)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "IncomingValue",
            table: "ProductCostPriceHistories",
            type: "decimal(20,4)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "TotalQuantityBefore",
            table: "ProductCostPriceHistories",
            type: "decimal(18,4)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "TotalQuantityAfter",
            table: "ProductCostPriceHistories",
            type: "decimal(18,4)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "TotalValueBefore",
            table: "ProductCostPriceHistories",
            type: "decimal(20,4)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "TotalValueAfter",
            table: "ProductCostPriceHistories",
            type: "decimal(20,4)",
            nullable: false,
            defaultValue: 0m);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "TotalValueAfter", table: "ProductCostPriceHistories");
        migrationBuilder.DropColumn(name: "TotalValueBefore", table: "ProductCostPriceHistories");
        migrationBuilder.DropColumn(name: "TotalQuantityAfter", table: "ProductCostPriceHistories");
        migrationBuilder.DropColumn(name: "TotalQuantityBefore", table: "ProductCostPriceHistories");
        migrationBuilder.DropColumn(name: "IncomingValue", table: "ProductCostPriceHistories");
        migrationBuilder.DropColumn(name: "IncomingQuantity", table: "ProductCostPriceHistories");

        migrationBuilder.DropColumn(name: "CostBasisReconciledAt", table: "ProductVariants");
        migrationBuilder.DropColumn(name: "TotalApprovedInboundValue", table: "ProductVariants");
        migrationBuilder.DropColumn(name: "TotalApprovedInboundQuantity", table: "ProductVariants");
    }
}
