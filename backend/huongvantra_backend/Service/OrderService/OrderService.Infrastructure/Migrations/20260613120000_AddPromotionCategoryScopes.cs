using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    public partial class AddPromotionCategoryScopes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: DB cũ có thể đã có cột từ migration 20260613100000 (bootstrap).
            migrationBuilder.Sql("""
                SET @db := DATABASE();
                SET @exists := (
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'PromotionScopes' AND COLUMN_NAME = 'CategoryId');
                SET @sql := IF(@exists = 0,
                    'ALTER TABLE `PromotionScopes` ADD COLUMN `CategoryId` int NULL, ADD COLUMN `CategorySnapshotName` varchar(255) CHARACTER SET utf8mb4 NULL',
                    'SELECT 1');
                PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
                """);

            migrationBuilder.Sql("""
                SET @db := DATABASE();
                SET @exists := (
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'PromotionScopes' AND INDEX_NAME = 'IX_PromotionScopes_CategoryId');
                SET @sql := IF(@exists = 0,
                    'CREATE INDEX `IX_PromotionScopes_CategoryId` ON `PromotionScopes` (`CategoryId`)',
                    'SELECT 1');
                PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PromotionScopes_CategoryId",
                table: "PromotionScopes");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "PromotionScopes");

            migrationBuilder.DropColumn(
                name: "CategorySnapshotName",
                table: "PromotionScopes");
        }
    }
}
