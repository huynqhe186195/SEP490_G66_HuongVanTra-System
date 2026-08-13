using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OrderService.Infrastructure.Data;

#nullable disable

namespace OrderService.Infrastructure.Migrations;

[DbContext(typeof(OrderDbContext))]
[Migration("20260813180000_AddReturnPolicies")]
public partial class AddReturnPolicies : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ReturnPolicies",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                Code = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                Name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                Version = table.Column<int>(type: "int", nullable: false),
                IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                ReturnWindowDays = table.Column<int>(type: "int", nullable: false),
                AllowedReasonCodesJson = table.Column<string>(type: "longtext", nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                ChecklistJson = table.Column<string>(type: "longtext", nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                MinEvidenceImages = table.Column<int>(type: "int", nullable: false),
                AllowPosChannel = table.Column<bool>(type: "tinyint(1)", nullable: false),
                AllowCodChannel = table.Column<bool>(type: "tinyint(1)", nullable: false),
                AllowCustomBundleReturns = table.Column<bool>(type: "tinyint(1)", nullable: false),
                AutoAcceptOnPolicyPass = table.Column<bool>(type: "tinyint(1)", nullable: false),
                PendingRefundUntilAccept = table.Column<bool>(type: "tinyint(1)", nullable: false),
                SummaryText = table.Column<string>(type: "longtext", nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ReturnPolicies", x => x.Id);
            })
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.CreateIndex(
            name: "IX_ReturnPolicies_Code",
            table: "ReturnPolicies",
            column: "Code",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_ReturnPolicies_IsActive_Version",
            table: "ReturnPolicies",
            columns: new[] { "IsActive", "Version" });

        // Seed DEFAULT v1 — khớp mặc định đã chốt (Phase 1).
        migrationBuilder.Sql("""
INSERT INTO `ReturnPolicies`
(`Id`, `Code`, `Name`, `Version`, `IsActive`, `ReturnWindowDays`,
 `AllowedReasonCodesJson`, `ChecklistJson`, `MinEvidenceImages`,
 `AllowPosChannel`, `AllowCodChannel`, `AllowCustomBundleReturns`,
 `AutoAcceptOnPolicyPass`, `PendingRefundUntilAccept`, `SummaryText`,
 `CreatedAt`, `UpdatedAt`, `IsDeleted`)
VALUES
('a1000000-0000-4000-8000-000000000001', 'DEFAULT', 'Chính sách trả/đổi hàng mặc định', 1, 1, 7,
 '["DAMAGED","NOT_AS_DESCRIBED","WRONG_ITEM","SHIPPING_DAMAGE","NEAR_EXPIRY","CUSTOMER_CHANGED_MIND","CUSTOMER_ORDERED_WRONG","OTHER"]',
 '[{"id":"SealIntact","label":"Tem / seal còn nguyên","required":true},{"id":"BoxDry","label":"Hộp/bao không ướt, không móp nặng","required":true},{"id":"Unused","label":"Chưa sử dụng / còn đủ số lượng","required":true},{"id":"OriginalPackaging","label":"Còn bao bì gốc (nếu sản phẩm có kèm)","required":false}]',
 1, 1, 1, 0, 1, 1,
 'Trả/đổi trong 7 ngày kể từ ngày giao (COD) hoặc hoàn tất (quầy). Hàng phải còn tem/seal, chưa dùng. Đơn chỉ gói custom không áp dụng trả. Hệ thống chỉ nhận trả khi đủ điều kiện; hoàn tiền sau khi chấp nhận. Ảnh minh chứng sẽ bắt buộc ở bước tiếp theo.',
 UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 0);
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "ReturnPolicies");
    }
}
