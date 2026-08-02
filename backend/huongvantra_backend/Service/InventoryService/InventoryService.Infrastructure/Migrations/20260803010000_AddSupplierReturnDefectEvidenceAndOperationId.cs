using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierReturnDefectEvidenceAndOperationId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DefectReasonCode",
                table: "SupplierReturnRequests",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EvidenceImageUrl",
                table: "SupplierReturnRequests",
                type: "varchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "OperationId",
                table: "SupplierReturnRequests",
                type: "char(36)",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                collation: "ascii_general_ci");

            // Phiếu cũ tạo trước khi có idempotency key đều mang Guid.Empty; gán lại giá trị duy nhất
            // để unique index bên dưới không đụng nhau.
            migrationBuilder.Sql("UPDATE `SupplierReturnRequests` SET `OperationId` = `Id` WHERE `OperationId` = '00000000-0000-0000-0000-000000000000';");

            migrationBuilder.CreateIndex(
                name: "IX_SupplierReturnRequests_OperationId",
                table: "SupplierReturnRequests",
                column: "OperationId",
                unique: true);

            migrationBuilder.DropIndex(
                name: "IX_SupplierReturnRequests_ReturnMode",
                table: "SupplierReturnRequests");

            migrationBuilder.DropColumn(
                name: "ReturnMode",
                table: "SupplierReturnRequests");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReturnMode",
                table: "SupplierReturnRequests",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "PHYSICAL_RETURN")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_SupplierReturnRequests_ReturnMode",
                table: "SupplierReturnRequests",
                column: "ReturnMode");

            migrationBuilder.DropIndex(
                name: "IX_SupplierReturnRequests_OperationId",
                table: "SupplierReturnRequests");

            migrationBuilder.DropColumn(
                name: "DefectReasonCode",
                table: "SupplierReturnRequests");

            migrationBuilder.DropColumn(
                name: "EvidenceImageUrl",
                table: "SupplierReturnRequests");

            migrationBuilder.DropColumn(
                name: "OperationId",
                table: "SupplierReturnRequests");
        }
    }
}
