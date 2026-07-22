using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddSuppliers : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Suppliers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    Phone = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    Email = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    Address = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    Note = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Suppliers", x => x.Id);
                });

            migrationBuilder.AddColumn<Guid>(
                name: "SupplierId",
                table: "SupplierReceipts",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateIndex(
                name: "IX_Suppliers_IsDeleted",
                table: "Suppliers",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_Suppliers_Name",
                table: "Suppliers",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_SupplierReceipts_SupplierId",
                table: "SupplierReceipts",
                column: "SupplierId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SupplierReceipts_SupplierId",
                table: "SupplierReceipts");

            migrationBuilder.DropColumn(
                name: "SupplierId",
                table: "SupplierReceipts");

            migrationBuilder.DropTable(
                name: "Suppliers");
        }
    }
}
