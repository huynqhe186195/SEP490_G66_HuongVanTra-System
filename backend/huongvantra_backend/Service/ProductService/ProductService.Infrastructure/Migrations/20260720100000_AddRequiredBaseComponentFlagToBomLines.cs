using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductService.Infrastructure.Data;

#nullable disable

namespace ProductService.Infrastructure.Migrations
{
    [DbContext(typeof(ProductDbContext))]
    [Migration("20260720100000_AddRequiredBaseComponentFlagToBomLines")]
    public partial class AddRequiredBaseComponentFlagToBomLines : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsRequiredBaseComponent",
                table: "ProductVariantBomLines",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsRequiredBaseComponent",
                table: "ProductVariantBomLines");
        }
    }
}
