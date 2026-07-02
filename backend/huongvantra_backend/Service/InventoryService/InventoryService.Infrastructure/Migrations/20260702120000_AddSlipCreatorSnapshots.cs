using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddSlipCreatorSnapshots : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CreatedById",
                table: "StockImportSlips",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "CreatedByName",
                table: "StockImportSlips",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CreatedByRoleName",
                table: "StockImportSlips",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedById",
                table: "StockExportSlips",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "CreatedByName",
                table: "StockExportSlips",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CreatedByRoleName",
                table: "StockExportSlips",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("""
                UPDATE `StockImportSlips`
                SET `CreatedById` = `CreatedBy`
                WHERE `CreatedById` IS NULL;
                """);

            migrationBuilder.Sql("""
                UPDATE `StockExportSlips`
                SET `CreatedById` = `CreatedBy`
                WHERE `CreatedById` IS NULL;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedById",
                table: "StockImportSlips");

            migrationBuilder.DropColumn(
                name: "CreatedByName",
                table: "StockImportSlips");

            migrationBuilder.DropColumn(
                name: "CreatedByRoleName",
                table: "StockImportSlips");

            migrationBuilder.DropColumn(
                name: "CreatedById",
                table: "StockExportSlips");

            migrationBuilder.DropColumn(
                name: "CreatedByName",
                table: "StockExportSlips");

            migrationBuilder.DropColumn(
                name: "CreatedByRoleName",
                table: "StockExportSlips");
        }
    }
}
