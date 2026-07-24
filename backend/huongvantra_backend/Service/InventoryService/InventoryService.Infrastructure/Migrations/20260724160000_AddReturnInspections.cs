using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations
{
    /// <summary>
    /// Phase J1 — bảng ReturnInspections giữ hàng trả chờ kiểm tra.
    /// Hàng trả KHÔNG tự tăng tồn bán; phải qua InspectReturn (Restock/Quarantine/Dispose).
    /// </summary>
    public partial class AddReturnInspections : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ReturnInspections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ReturnId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ReturnCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    OrderId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    OrderCode = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SkuCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    SkuSnapshotName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    Disposition = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    QuarantineBatchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    RestockBatchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    InspectedBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    InspectedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    InspectionNote = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReturnInspections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReturnInspections_WarehouseBatches_QuarantineBatchId",
                        column: x => x.QuarantineBatchId,
                        principalTable: "WarehouseBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReturnInspections_CreatedAt",
                table: "ReturnInspections",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ReturnInspections_Disposition",
                table: "ReturnInspections",
                column: "Disposition");

            migrationBuilder.CreateIndex(
                name: "IX_ReturnInspections_OrderId",
                table: "ReturnInspections",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_ReturnInspections_QuarantineBatchId",
                table: "ReturnInspections",
                column: "QuarantineBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ReturnInspections_ReturnId",
                table: "ReturnInspections",
                column: "ReturnId");

            migrationBuilder.CreateIndex(
                name: "IX_ReturnInspections_ReturnId_SkuId",
                table: "ReturnInspections",
                columns: new[] { "ReturnId", "SkuId" });

            migrationBuilder.CreateIndex(
                name: "IX_ReturnInspections_SkuId",
                table: "ReturnInspections",
                column: "SkuId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ReturnInspections");
        }
    }
}
