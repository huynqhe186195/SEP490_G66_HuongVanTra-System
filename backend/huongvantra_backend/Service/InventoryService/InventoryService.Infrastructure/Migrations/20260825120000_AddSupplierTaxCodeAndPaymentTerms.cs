using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

[DbContext(typeof(InventoryDbContext))]
[Migration("20260825120000_AddSupplierTaxCodeAndPaymentTerms")]
public partial class AddSupplierTaxCodeAndPaymentTerms : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "TaxCode",
            table: "Suppliers",
            type: "varchar(20)",
            maxLength: 20,
            nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.AddColumn<string>(
            name: "PaymentTerms",
            table: "Suppliers",
            type: "varchar(255)",
            maxLength: 255,
            nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "TaxCode",
            table: "Suppliers");

        migrationBuilder.DropColumn(
            name: "PaymentTerms",
            table: "Suppliers");
    }
}
