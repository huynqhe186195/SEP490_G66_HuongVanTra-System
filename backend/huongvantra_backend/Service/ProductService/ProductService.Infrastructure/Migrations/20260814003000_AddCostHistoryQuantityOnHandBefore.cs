using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductService.Infrastructure.Data;

#nullable disable

namespace ProductService.Infrastructure.Migrations
{
    /// <summary>
    /// Lưu tồn trước dòng phiếu nhập để seed WAC lần đầu (catalog CostPrice + tồn cũ).
    /// </summary>
    [DbContext(typeof(ProductDbContext))]
    [Migration("20260814003000_AddCostHistoryQuantityOnHandBefore")]
    public partial class AddCostHistoryQuantityOnHandBefore : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "QuantityOnHandBefore",
                table: "ProductCostPriceHistories",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QuantityOnHandBefore",
                table: "ProductCostPriceHistories");
        }
    }
}
