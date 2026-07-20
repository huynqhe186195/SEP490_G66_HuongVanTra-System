using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    public partial class AddStockDeductQueueAuditAndInsufficientStatus : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ConfirmedBy",
                table: "StockDeductQueues",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "ConfirmedByName",
                table: "StockDeductQueues",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ConfirmedByRoleName",
                table: "StockDeductQueues",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                table: "StockDeductQueues",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CancelledBy",
                table: "StockDeductQueues",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "CancelledByName",
                table: "StockDeductQueues",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CancelledByRoleName",
                table: "StockDeductQueues",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CancelReason",
                table: "StockDeductQueues",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "LastAttemptAt",
                table: "StockDeductQueues",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastShortageReason",
                table: "StockDeductQueues",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_StockDeductQueues_CancelledBy",
                table: "StockDeductQueues",
                column: "CancelledBy");

            migrationBuilder.CreateIndex(
                name: "IX_StockDeductQueues_ConfirmedBy",
                table: "StockDeductQueues",
                column: "ConfirmedBy");

            migrationBuilder.CreateIndex(
                name: "IX_StockDeductQueues_QueueStatus",
                table: "StockDeductQueues",
                column: "QueueStatus");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StockDeductQueues_CancelledBy",
                table: "StockDeductQueues");

            migrationBuilder.DropIndex(
                name: "IX_StockDeductQueues_ConfirmedBy",
                table: "StockDeductQueues");

            migrationBuilder.DropIndex(
                name: "IX_StockDeductQueues_QueueStatus",
                table: "StockDeductQueues");

            migrationBuilder.DropColumn(
                name: "ConfirmedBy",
                table: "StockDeductQueues");

            migrationBuilder.DropColumn(
                name: "ConfirmedByName",
                table: "StockDeductQueues");

            migrationBuilder.DropColumn(
                name: "ConfirmedByRoleName",
                table: "StockDeductQueues");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "StockDeductQueues");

            migrationBuilder.DropColumn(
                name: "CancelledBy",
                table: "StockDeductQueues");

            migrationBuilder.DropColumn(
                name: "CancelledByName",
                table: "StockDeductQueues");

            migrationBuilder.DropColumn(
                name: "CancelledByRoleName",
                table: "StockDeductQueues");

            migrationBuilder.DropColumn(
                name: "CancelReason",
                table: "StockDeductQueues");

            migrationBuilder.DropColumn(
                name: "LastAttemptAt",
                table: "StockDeductQueues");

            migrationBuilder.DropColumn(
                name: "LastShortageReason",
                table: "StockDeductQueues");
        }
    }
}
