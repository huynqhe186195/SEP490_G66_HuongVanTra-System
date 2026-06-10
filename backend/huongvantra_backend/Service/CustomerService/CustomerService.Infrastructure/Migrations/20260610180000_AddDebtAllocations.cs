using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CustomerService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDebtAllocations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RelatedOrderCode",
                table: "CustomerDebtTransactions",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "CustomerDebtAllocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    DebtTransactionId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CustomerId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    OrderId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    OrderCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomerDebtAllocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DebtAlloc_DebtTxn",
                        column: x => x.DebtTransactionId,
                        principalTable: "CustomerDebtTransactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerDebtAllocations_CustomerId",
                table: "CustomerDebtAllocations",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerDebtAllocations_DebtTransactionId",
                table: "CustomerDebtAllocations",
                column: "DebtTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerDebtAllocations_OrderId",
                table: "CustomerDebtAllocations",
                column: "OrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CustomerDebtAllocations");

            migrationBuilder.DropColumn(
                name: "RelatedOrderCode",
                table: "CustomerDebtTransactions");
        }
    }
}
