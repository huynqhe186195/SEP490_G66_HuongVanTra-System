using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductService.Infrastructure.Data;

#nullable disable

namespace ProductService.Infrastructure.Migrations
{
    [DbContext(typeof(ProductDbContext))]
    [Migration("20260728110000_AddProductVariantCapabilities")]
    public partial class AddProductVariantCapabilities : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPurchasable",
                table: "ProductVariants",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanBeBomComponent",
                table: "ProductVariants",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanUseInCustom",
                table: "ProductVariants",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanHaveBom",
                table: "ProductVariants",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(@"
                UPDATE ProductVariants v
                INNER JOIN Products p ON p.Id = v.ProductId
                SET
                    v.IsPurchasable = CASE
                        WHEN p.ProductType IN ('THANH_PHAM', 'NGUYEN_LIEU', 'BAO_BI') THEN 1
                        ELSE 0
                    END,
                    v.CanBeBomComponent = CASE
                        WHEN p.ProductType IN ('NGUYEN_LIEU', 'BAO_BI') THEN 1
                        ELSE 0
                    END,
                    v.CanUseInCustom = 0,
                    v.CanHaveBom = CASE
                        WHEN p.ProductType = 'THANH_PHAM' THEN 1
                        ELSE 0
                    END;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "IsPurchasable", table: "ProductVariants");
            migrationBuilder.DropColumn(name: "CanBeBomComponent", table: "ProductVariants");
            migrationBuilder.DropColumn(name: "CanUseInCustom", table: "ProductVariants");
            migrationBuilder.DropColumn(name: "CanHaveBom", table: "ProductVariants");
        }
    }
}
