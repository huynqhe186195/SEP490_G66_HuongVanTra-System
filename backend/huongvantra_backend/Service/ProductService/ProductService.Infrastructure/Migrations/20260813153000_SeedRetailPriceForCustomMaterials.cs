using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductService.Infrastructure.Data;

#nullable disable

namespace ProductService.Infrastructure.Migrations
{
    /// <summary>
    /// POS Custom lấy RetailPrice của NL/BAO_BI làm đơn giá bán.
    /// Seed demo thường để RetailPrice=0 (chỉ có CostPrice) → gói custom = 0đ
    /// và bị chặn bởi rule đơn 0 đồng.
    /// Gán giá bán = ROUND(CostPrice * 2) khi chưa có giá (markup ~ thành phẩm).
    /// </summary>
    [DbContext(typeof(ProductDbContext))]
    [Migration("20260813153000_SeedRetailPriceForCustomMaterials")]
    public partial class SeedRetailPriceForCustomMaterials : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE ProductVariants v
                INNER JOIN Products p ON p.Id = v.ProductId
                SET v.CanUseInCustom = 1
                WHERE p.ProductType IN ('NGUYEN_LIEU', 'BAO_BI')
                  AND v.IsActive = 1
                  AND v.CanUseInCustom = 0;

                UPDATE ProductVariants v
                INNER JOIN Products p ON p.Id = v.ProductId
                SET v.RetailPrice = ROUND(v.CostPrice * 2, 0)
                WHERE p.ProductType IN ('NGUYEN_LIEU', 'BAO_BI')
                  AND v.IsActive = 1
                  AND v.CanUseInCustom = 1
                  AND v.RetailPrice <= 0
                  AND v.CostPrice > 0;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Không rollback giá đã seed — tránh xoá giá vận hành đã chỉnh tay.
        }
    }
}
