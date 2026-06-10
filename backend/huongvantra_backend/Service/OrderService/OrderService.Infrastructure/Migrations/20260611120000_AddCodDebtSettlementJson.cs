using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCodDebtSettlementJson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CodDebtSettlementJson",
                table: "Payments",
                type: "varchar(4000)",
                maxLength: 4000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CodDebtSettlementJson",
                table: "Payments");
        }
    }
}
