using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OrderService.Infrastructure.Data;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    [DbContext(typeof(OrderDbContext))]
    [Migration("20260809170000_AddPosCashSessionShiftEndsAt")]
    public partial class AddPosCashSessionShiftEndsAt : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ShiftEndsAtUtc",
                table: "PosCashSessions",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PosCashSessions_ShiftEndsAtUtc",
                table: "PosCashSessions",
                column: "ShiftEndsAtUtc");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PosCashSessions_ShiftEndsAtUtc",
                table: "PosCashSessions");

            migrationBuilder.DropColumn(
                name: "ShiftEndsAtUtc",
                table: "PosCashSessions");
        }
    }
}
