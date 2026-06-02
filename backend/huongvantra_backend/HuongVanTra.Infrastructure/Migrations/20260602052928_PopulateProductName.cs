using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HuongVanTra.Infrastructure.Migrations
{
    public partial class PopulateProductName : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE products SET Name = Sku WHERE Name = '' OR Name IS NULL;");
        }
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE products SET Name = '';");
        }
    }
}
