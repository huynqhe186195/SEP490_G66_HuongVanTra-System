using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HuongVanTra.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerCurrentDebt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CurrentDebt",
                table: "customers",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            // Tính lại CurrentDebt cho data hiện có từ orders chưa thanh toán
            migrationBuilder.Sql(@"
                UPDATE customers c
                SET CurrentDebt = COALESCE((
                    SELECT SUM(o.TotalAmount)
                    FROM orders o
                    WHERE o.CustomerId = c.Id
                      AND o.PaymentStatus IN ('pending_payment', 'unpaid')
                      AND o.OrderStatus != 'cancelled'
                ), 0)
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CurrentDebt",
                table: "customers");
        }
    }
}
