using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HuongVanTra.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "employees",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "employees",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_employees_StoreId",
                table: "employees",
                column: "StoreId");

            migrationBuilder.AddForeignKey(
                name: "FK_employees_stores_StoreId",
                table: "employees",
                column: "StoreId",
                principalTable: "stores",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddColumn<decimal>(
                name: "CouponDiscount",
                table: "orders",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "DeductAmount",
                table: "orders",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ManualDiscount",
                table: "orders",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "orders",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "SubTotal",
                table: "orders",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "orders",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_orders_CreatedAt",
                table: "orders",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_orders_OrderCode",
                table: "orders",
                column: "OrderCode");

            migrationBuilder.CreateIndex(
                name: "IX_orders_OrderStatus",
                table: "orders",
                column: "OrderStatus");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_employees_stores_StoreId",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_employees_StoreId",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_orders_CreatedAt",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_orders_OrderCode",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_orders_OrderStatus",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "CouponDiscount",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "DeductAmount",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "ManualDiscount",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "SubTotal",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "orders");
        }
    }
}
