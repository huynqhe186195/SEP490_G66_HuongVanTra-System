using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    public partial class AddPromotionUsageLimits : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UsageLimitPerCustomer",
                table: "Promotions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UsageLimitTotal",
                table: "Promotions",
                type: "int",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UsageLimitPerCustomer",
                table: "Promotions");

            migrationBuilder.DropColumn(
                name: "UsageLimitTotal",
                table: "Promotions");
        }
    }
}
