using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    public partial class AddPromotionCustomerTierScopes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PromotionCustomerTierScopes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    PromotionId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    TierId = table.Column<int>(type: "int", nullable: false),
                    TierSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PromotionCustomerTierScopes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PromotionCustomerTierScopes_Promotions_PromotionId",
                        column: x => x.PromotionId,
                        principalTable: "Promotions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_PromotionCustomerTierScopes_PromotionId",
                table: "PromotionCustomerTierScopes",
                column: "PromotionId");

            migrationBuilder.CreateIndex(
                name: "IX_PromotionCustomerTierScopes_TierId",
                table: "PromotionCustomerTierScopes",
                column: "TierId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "PromotionCustomerTierScopes");
        }
    }
}
