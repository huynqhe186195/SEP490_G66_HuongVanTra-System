using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPromotionMaxDiscountAmount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "MaxDiscountAmount",
                table: "Promotions",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE `Promotions` SET `MaxDiscountAmount` = 10000000 WHERE `DiscountType` = 'PERCENTAGE' AND `MaxDiscountAmount` IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxDiscountAmount",
                table: "Promotions");
        }
    }
}
