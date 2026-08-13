using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OrderService.Infrastructure.Data;

#nullable disable

namespace OrderService.Infrastructure.Migrations;

[DbContext(typeof(OrderDbContext))]
[Migration("20260813183000_AddReturnOrderPolicyEvidence")]
public partial class AddReturnOrderPolicyEvidence : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "PolicyId",
            table: "ReturnOrders",
            type: "char(36)",
            nullable: true,
            collation: "ascii_general_ci");

        migrationBuilder.AddColumn<string>(
            name: "PolicyCode",
            table: "ReturnOrders",
            type: "varchar(50)",
            maxLength: 50,
            nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.AddColumn<int>(
            name: "PolicyVersion",
            table: "ReturnOrders",
            type: "int",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ChecklistAnswersJson",
            table: "ReturnOrders",
            type: "longtext",
            nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.AddColumn<string>(
            name: "PolicyEvaluationNote",
            table: "ReturnOrders",
            type: "longtext",
            nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.AddColumn<bool>(
            name: "AcceptedBySystem",
            table: "ReturnOrders",
            type: "tinyint(1)",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<bool>(
            name: "ManagerOverride",
            table: "ReturnOrders",
            type: "tinyint(1)",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<DateTime>(
            name: "PolicyAcceptedAt",
            table: "ReturnOrders",
            type: "datetime(6)",
            nullable: true);

        migrationBuilder.CreateTable(
            name: "ReturnOrderEvidenceImages",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                ReturnOrderId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                ImageUrl = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                SortOrder = table.Column<int>(type: "int", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ReturnOrderEvidenceImages", x => x.Id);
                table.ForeignKey(
                    name: "FK_ReturnOrderEvidenceImages_ReturnOrders_ReturnOrderId",
                    column: x => x.ReturnOrderId,
                    principalTable: "ReturnOrders",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            })
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.CreateIndex(
            name: "IX_ReturnOrderEvidenceImages_ReturnOrderId",
            table: "ReturnOrderEvidenceImages",
            column: "ReturnOrderId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "ReturnOrderEvidenceImages");
        migrationBuilder.DropColumn(name: "PolicyId", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "PolicyCode", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "PolicyVersion", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "ChecklistAnswersJson", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "PolicyEvaluationNote", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "AcceptedBySystem", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "ManagerOverride", table: "ReturnOrders");
        migrationBuilder.DropColumn(name: "PolicyAcceptedAt", table: "ReturnOrders");
    }
}
