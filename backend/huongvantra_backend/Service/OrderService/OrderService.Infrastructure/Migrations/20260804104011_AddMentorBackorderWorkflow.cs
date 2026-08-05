using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMentorBackorderWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "OrderStatus",
                table: "Orders",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(20)",
                oldMaxLength: 20)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "BackorderAcceptedAt",
                table: "Orders",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BackorderMaxLeadDaysSnapshot",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BackorderMinLeadDaysSnapshot",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "Orders",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "CancellationRequestedAt",
                table: "Orders",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CancellationRequestedBy",
                table: "Orders",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "CancellationRequestedByName",
                table: "Orders",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "EstimatedReadyFrom",
                table: "Orders",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EstimatedReadyTo",
                table: "Orders",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FulfillmentPreference",
                table: "Orders",
                type: "varchar(30)",
                maxLength: 30,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "RefundAmount",
                table: "Orders",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RefundApprovedAt",
                table: "Orders",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RefundApprovedBy",
                table: "Orders",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "RefundApprovedByName",
                table: "Orders",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "RefundEvidence",
                table: "Orders",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "RefundMethod",
                table: "Orders",
                type: "varchar(30)",
                maxLength: 30,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "RefundStatus",
                table: "Orders",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "NotRequired")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "RefundedAt",
                table: "Orders",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RefundedBy",
                table: "Orders",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "RefundedByName",
                table: "Orders",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "BackorderQuantity",
                table: "OrderDetails",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ImmediateFulfilledQuantity",
                table: "OrderDetails",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ReservedFinishedQuantity",
                table: "OrderDetails",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BackorderAcceptedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BackorderMaxLeadDaysSnapshot",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BackorderMinLeadDaysSnapshot",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CancellationRequestedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CancellationRequestedBy",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CancellationRequestedByName",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "EstimatedReadyFrom",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "EstimatedReadyTo",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "FulfillmentPreference",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RefundAmount",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RefundApprovedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RefundApprovedBy",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RefundApprovedByName",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RefundEvidence",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RefundMethod",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RefundStatus",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RefundedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RefundedBy",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RefundedByName",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BackorderQuantity",
                table: "OrderDetails");

            migrationBuilder.DropColumn(
                name: "ImmediateFulfilledQuantity",
                table: "OrderDetails");

            migrationBuilder.DropColumn(
                name: "ReservedFinishedQuantity",
                table: "OrderDetails");

            migrationBuilder.AlterColumn<string>(
                name: "OrderStatus",
                table: "Orders",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(30)",
                oldMaxLength: 30)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");
        }
    }
}
