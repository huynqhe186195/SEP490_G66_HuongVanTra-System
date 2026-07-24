using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    /// <summary>
    /// G6 — thêm cột EventId (khoá chống trùng có thẩm quyền do OrderService Outbox sinh)
    /// vào ProcessedIntegrationEvents, kèm unique index để chống ghi trùng khi broker
    /// giao lại cùng một event. Cột nullable để tương thích event nguồn chưa gắn EventId.
    /// </summary>
    public partial class AddEventIdToProcessedIntegrationEvents : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EventId",
                table: "ProcessedIntegrationEvents",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessedIntegrationEvents_EventId",
                table: "ProcessedIntegrationEvents",
                column: "EventId",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProcessedIntegrationEvents_EventId",
                table: "ProcessedIntegrationEvents");

            migrationBuilder.DropColumn(
                name: "EventId",
                table: "ProcessedIntegrationEvents");
        }
    }
}
