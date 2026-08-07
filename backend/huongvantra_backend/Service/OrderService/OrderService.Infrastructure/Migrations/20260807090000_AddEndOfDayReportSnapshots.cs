using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OrderService.Infrastructure.Data;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(OrderDbContext))]
    [Migration("20260807090000_AddEndOfDayReportSnapshots")]
    public partial class AddEndOfDayReportSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UnitSnapshot",
                table: "OrderDetails",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<System.DateTime>(
                name: "CompletedAt",
                table: "Orders",
                type: "datetime(6)",
                nullable: true);

            // Các đơn đã hoàn tất trước migration này không có mốc hoàn tất đáng tin cậy:
            // UpdatedAt bị ghi đè bởi mọi lần sửa đơn sau đó. Để nguyên NULL và để báo cáo
            // lùi về CreatedAt, thay vì backfill một giá trị sai lệch.

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CompletedAt",
                table: "Orders",
                column: "CompletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CreatedAt",
                table: "Orders",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_PaidAt",
                table: "Payments",
                column: "PaidAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Payments_PaidAt", table: "Payments");
            migrationBuilder.DropIndex(name: "IX_Orders_CreatedAt", table: "Orders");
            migrationBuilder.DropIndex(name: "IX_Orders_CompletedAt", table: "Orders");
            migrationBuilder.DropColumn(name: "CompletedAt", table: "Orders");
            migrationBuilder.DropColumn(name: "UnitSnapshot", table: "OrderDetails");
        }
    }
}
