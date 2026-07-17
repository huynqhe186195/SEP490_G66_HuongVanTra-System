using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddProductionApprovalAndOutputDestination : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DestinationLocation",
                table: "StockImportSlipLines",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByName",
                table: "ProductionOrders",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByRoleName",
                table: "ProductionOrders",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SubmittedBy",
                table: "ProductionOrders",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedAt",
                table: "ProductionOrders",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewedBy",
                table: "ProductionOrders",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "ReviewedByName",
                table: "ProductionOrders",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewedByRoleName",
                table: "ProductionOrders",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAt",
                table: "ProductionOrders",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewNote",
                table: "ProductionOrders",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DestinationLocation",
                table: "ProductionOrderOutputLines",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Warehouse");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionOrders_SubmittedAt",
                table: "ProductionOrders",
                column: "SubmittedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionOrders_ReviewedBy",
                table: "ProductionOrders",
                column: "ReviewedBy");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionOrders_ReviewedAt",
                table: "ProductionOrders",
                column: "ReviewedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionOrderOutputLines_DestinationLocation",
                table: "ProductionOrderOutputLines",
                column: "DestinationLocation");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProductionOrders_SubmittedAt",
                table: "ProductionOrders");

            migrationBuilder.DropIndex(
                name: "IX_ProductionOrders_ReviewedBy",
                table: "ProductionOrders");

            migrationBuilder.DropIndex(
                name: "IX_ProductionOrders_ReviewedAt",
                table: "ProductionOrders");

            migrationBuilder.DropIndex(
                name: "IX_ProductionOrderOutputLines_DestinationLocation",
                table: "ProductionOrderOutputLines");

            migrationBuilder.DropColumn(
                name: "DestinationLocation",
                table: "StockImportSlipLines");

            migrationBuilder.DropColumn(
                name: "CreatedByName",
                table: "ProductionOrders");

            migrationBuilder.DropColumn(
                name: "CreatedByRoleName",
                table: "ProductionOrders");

            migrationBuilder.DropColumn(
                name: "SubmittedBy",
                table: "ProductionOrders");

            migrationBuilder.DropColumn(
                name: "SubmittedAt",
                table: "ProductionOrders");

            migrationBuilder.DropColumn(
                name: "ReviewedBy",
                table: "ProductionOrders");

            migrationBuilder.DropColumn(
                name: "ReviewedByName",
                table: "ProductionOrders");

            migrationBuilder.DropColumn(
                name: "ReviewedByRoleName",
                table: "ProductionOrders");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                table: "ProductionOrders");

            migrationBuilder.DropColumn(
                name: "ReviewNote",
                table: "ProductionOrders");

            migrationBuilder.DropColumn(
                name: "DestinationLocation",
                table: "ProductionOrderOutputLines");
        }
    }
}
