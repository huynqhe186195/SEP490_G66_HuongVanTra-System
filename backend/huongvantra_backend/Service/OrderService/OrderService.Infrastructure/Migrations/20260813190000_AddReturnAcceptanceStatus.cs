using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OrderService.Infrastructure.Data;

#nullable disable

namespace OrderService.Infrastructure.Migrations;

[DbContext(typeof(OrderDbContext))]
[Migration("20260813190000_AddReturnAcceptanceStatus")]
public partial class AddReturnAcceptanceStatus : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "AcceptanceStatus",
            table: "ReturnOrders",
            type: "varchar(20)",
            maxLength: 20,
            nullable: false,
            defaultValue: "Accepted")
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.AddColumn<DateTime>(
            name: "AcceptedAt",
            table: "ReturnOrders",
            type: "datetime(6)",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "RejectedAt",
            table: "ReturnOrders",
            type: "datetime(6)",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "RejectionReason",
            table: "ReturnOrders",
            type: "varchar(500)",
            maxLength: 500,
            nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.AddColumn<string>(
            name: "ExchangeDraftJson",
            table: "ReturnOrders",
            type: "longtext",
            nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.AddColumn<decimal>(
            name: "ExchangeManualDiscount",
            table: "ReturnOrders",
            type: "decimal(18,2)",
            nullable: false,
            defaultValue: 0m);

        // Phiếu lịch sử coi như đã Accept (đã publish event / hoàn tiền trước Phase 4).
        migrationBuilder.Sql("""
UPDATE `ReturnOrders`
SET `AcceptedAt` = COALESCE(`PolicyAcceptedAt`, `CreatedAt`),
    `AcceptanceStatus` = 'Accepted'
WHERE `AcceptanceStatus` = 'Accepted' OR `AcceptanceStatus` IS NULL OR `AcceptanceStatus` = '';
""");

        migrationBuilder.CreateIndex(
            name: "IX_ReturnOrders_AcceptanceStatus",
            table: "ReturnOrders",
            column: "AcceptanceStatus");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_ReturnOrders_AcceptanceStatus", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "AcceptanceStatus", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "AcceptedAt", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "RejectedAt", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "RejectionReason", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "ExchangeDraftJson", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "ExchangeManualDiscount", table: "ReturnOrders");
    }
}
