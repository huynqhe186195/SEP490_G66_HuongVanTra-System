using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierReturnEvidenceImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SupplierReturnEvidenceImages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SupplierReturnRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ImageUrl = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupplierReturnEvidenceImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupplierReturnEvidenceImages_SupplierReturnRequests_Supplier~",
                        column: x => x.SupplierReturnRequestId,
                        principalTable: "SupplierReturnRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_SupplierReturnEvidenceImages_SupplierReturnRequestId",
                table: "SupplierReturnEvidenceImages",
                column: "SupplierReturnRequestId");

            // Chuyển ảnh bằng chứng của phiếu cũ sang bảng con trước khi bỏ cột scalar.
            migrationBuilder.Sql(@"
INSERT INTO `SupplierReturnEvidenceImages` (`Id`, `SupplierReturnRequestId`, `ImageUrl`, `SortOrder`, `CreatedAt`)
SELECT UUID(), `Id`, `EvidenceImageUrl`, 0, `CreatedAt`
FROM `SupplierReturnRequests`
WHERE `EvidenceImageUrl` IS NOT NULL AND `EvidenceImageUrl` <> '';");

            migrationBuilder.DropColumn(
                name: "EvidenceImageUrl",
                table: "SupplierReturnRequests");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EvidenceImageUrl",
                table: "SupplierReturnRequests",
                type: "varchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql(@"
UPDATE `SupplierReturnRequests` r
JOIN (
    SELECT `SupplierReturnRequestId`, MIN(`ImageUrl`) AS `ImageUrl`
    FROM `SupplierReturnEvidenceImages`
    WHERE `SortOrder` = 0
    GROUP BY `SupplierReturnRequestId`
) e ON e.`SupplierReturnRequestId` = r.`Id`
SET r.`EvidenceImageUrl` = e.`ImageUrl`;");

            migrationBuilder.DropTable(
                name: "SupplierReturnEvidenceImages");
        }
    }
}
