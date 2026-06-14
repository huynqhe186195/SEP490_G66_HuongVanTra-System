using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    public partial class AddPromotionCategoryScopes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                table: "PromotionScopes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CategorySnapshotName",
                table: "PromotionScopes",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_PromotionScopes_CategoryId",
                table: "PromotionScopes",
                column: "CategoryId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PromotionScopes_CategoryId",
                table: "PromotionScopes");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "PromotionScopes");

            migrationBuilder.DropColumn(
                name: "CategorySnapshotName",
                table: "PromotionScopes");
        }
    }
}
