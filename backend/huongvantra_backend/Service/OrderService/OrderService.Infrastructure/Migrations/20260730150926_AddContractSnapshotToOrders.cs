using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddContractSnapshotToOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContractCodeSnapshot",
                table: "Orders",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "ContractDiscountPercentSnapshot",
                table: "Orders",
                type: "decimal(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ContractId",
                table: "Orders",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<int>(
                name: "ContractPaymentTermDaysSnapshot",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DueDate",
                table: "Orders",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_ContractId",
                table: "Orders",
                column: "ContractId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_DueDate",
                table: "Orders",
                column: "DueDate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_ContractId",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_DueDate",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ContractCodeSnapshot",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ContractDiscountPercentSnapshot",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ContractId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ContractPaymentTermDaysSnapshot",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "Orders");
        }
    }
}
