using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OrderKind",
                table: "Orders",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Sale");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_OrderKind",
                table: "Orders",
                column: "OrderKind");

            migrationBuilder.Sql("""
                UPDATE Orders o
                INNER JOIN ReturnOrders r ON r.ExchangeOrderId = o.Id
                SET o.OrderKind = 'Exchange'
                WHERE r.ExchangeOrderId IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_OrderKind",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OrderKind",
                table: "Orders");
        }
    }
}
