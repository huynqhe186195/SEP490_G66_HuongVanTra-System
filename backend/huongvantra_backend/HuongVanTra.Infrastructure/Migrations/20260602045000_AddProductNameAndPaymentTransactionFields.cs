using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HuongVanTra.Infrastructure.Migrations
{
    public partial class AddProductNameAndPaymentTransactionFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "products",
                type: "varchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "payment_transactions",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "pending")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ReferenceCode",
                table: "payment_transactions",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "payment_transactions",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "ConfirmedById",
                table: "payment_transactions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ConfirmedAt",
                table: "payment_transactions",
                type: "datetime(6)",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Name",
                table: "products");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "payment_transactions");

            migrationBuilder.DropColumn(
                name: "ReferenceCode",
                table: "payment_transactions");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "payment_transactions");

            migrationBuilder.DropColumn(
                name: "ConfirmedById",
                table: "payment_transactions");

            migrationBuilder.DropColumn(
                name: "ConfirmedAt",
                table: "payment_transactions");
        }
    }
}
