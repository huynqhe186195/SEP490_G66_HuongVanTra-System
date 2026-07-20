using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductService.Infrastructure.Data;

#nullable disable

namespace ProductService.Infrastructure.Migrations
{
    [DbContext(typeof(ProductDbContext))]
    [Migration("20260717100000_AddInventoryUnitToProducts")]
    public partial class AddInventoryUnitToProducts : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InventoryUnit",
                table: "Products",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Piece")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("""
                UPDATE `Products`
                SET `InventoryUnit` = CASE
                    WHEN LOWER(TRIM(COALESCE(`BaseUnit`, ''))) IN ('g', 'gram', 'grams', 'kg')
                        OR LOWER(TRIM(COALESCE(`WeightUnit`, ''))) IN ('g', 'gram', 'grams', 'kg')
                    THEN 'Gram'
                    ELSE 'Piece'
                END;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InventoryUnit",
                table: "Products");
        }
    }
}
