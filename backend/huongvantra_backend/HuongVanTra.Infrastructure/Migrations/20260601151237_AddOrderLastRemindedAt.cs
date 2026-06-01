using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HuongVanTra.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderLastRemindedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastRemindedAt",
                table: "orders",
                type: "datetime(6)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastRemindedAt",
                table: "orders");
        }
    }
}
