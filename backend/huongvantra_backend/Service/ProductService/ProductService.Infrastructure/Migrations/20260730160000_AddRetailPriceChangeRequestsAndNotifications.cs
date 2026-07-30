using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductService.Infrastructure.Data;

#nullable disable

namespace ProductService.Infrastructure.Migrations;

[DbContext(typeof(ProductDbContext))]
[Migration("20260730160000_AddRetailPriceChangeRequestsAndNotifications")]
public partial class AddRetailPriceChangeRequestsAndNotifications : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "RetailPriceChangeRequests",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                RequestCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                Status = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SkuCode = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                ProductName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                VariantName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                CurrentRetailPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                RequestedRetailPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                AverageCostPriceAtRequest = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                Reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                CreatedBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                CreatedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                CreatedByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                ReviewedBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                ReviewedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                ReviewedByRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                ReviewedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                AdminNote = table.Column<string>(type: "TEXT", nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                RejectReason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                AppliedRetailPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                AppliedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_RetailPriceChangeRequests", x => x.Id);
            })
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.CreateTable(
            name: "Notifications",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                RecipientRoleName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                RecipientUserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                Type = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                Title = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                Body = table.Column<string>(type: "TEXT", nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                Link = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                ReferenceId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                ReferenceType = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                IsRead = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                ReadAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                ReadBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Notifications", x => x.Id);
            })
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.CreateIndex(
            name: "IX_RetailPriceChangeRequests_RequestCode",
            table: "RetailPriceChangeRequests",
            column: "RequestCode",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_RetailPriceChangeRequests_Status",
            table: "RetailPriceChangeRequests",
            column: "Status");

        migrationBuilder.CreateIndex(
            name: "IX_RetailPriceChangeRequests_SkuId_Status",
            table: "RetailPriceChangeRequests",
            columns: new[] { "SkuId", "Status" });

        migrationBuilder.CreateIndex(
            name: "IX_Notifications_RecipientRoleName_IsRead_CreatedAt",
            table: "Notifications",
            columns: new[] { "RecipientRoleName", "IsRead", "CreatedAt" });

        migrationBuilder.CreateIndex(
            name: "IX_Notifications_RecipientUserId_IsRead_CreatedAt",
            table: "Notifications",
            columns: new[] { "RecipientUserId", "IsRead", "CreatedAt" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "Notifications");
        migrationBuilder.DropTable(name: "RetailPriceChangeRequests");
    }
}
