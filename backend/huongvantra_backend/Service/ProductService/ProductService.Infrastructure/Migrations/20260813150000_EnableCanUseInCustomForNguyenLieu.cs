using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductService.Infrastructure.Data;

#nullable disable

namespace ProductService.Infrastructure.Migrations
{
    /// <summary>
    /// POS Custom (tab Nguyên liệu) chỉ hiện SKU có CanUseInCustom=1.
    /// Seed/migration capabilities trước đó để CanUseInCustom=0 cho mọi loại,
    /// khiến danh sách nguyên liệu trống dù đã có NGUYEN_LIEU.
    /// </summary>
    [DbContext(typeof(ProductDbContext))]
    [Migration("20260813150000_EnableCanUseInCustomForNguyenLieu")]
    public partial class EnableCanUseInCustomForNguyenLieu : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE ProductVariants v
                INNER JOIN Products p ON p.Id = v.ProductId
                SET v.CanUseInCustom = 1
                WHERE p.ProductType = 'NGUYEN_LIEU'
                  AND v.IsActive = 1;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE ProductVariants v
                INNER JOIN Products p ON p.Id = v.ProductId
                SET v.CanUseInCustom = 0
                WHERE p.ProductType = 'NGUYEN_LIEU';");
        }
    }
}
