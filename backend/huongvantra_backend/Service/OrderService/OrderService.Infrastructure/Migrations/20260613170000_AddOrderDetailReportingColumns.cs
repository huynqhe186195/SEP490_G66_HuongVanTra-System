using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrderService.Infrastructure.Migrations;

/// <summary>
/// Bổ sung cột báo cáo cho OrderDetails trên DB tạo từ migration cũ (trước merge HoangNL-2).
/// </summary>
public partial class AddOrderDetailReportingColumns : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            SET @db := DATABASE();

            SET @has_category := (
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'OrderDetails' AND COLUMN_NAME = 'CategorySnapshotName'
            );
            SET @sql_category := IF(
                @has_category = 0,
                'ALTER TABLE `OrderDetails` ADD `CategorySnapshotName` longtext CHARACTER SET utf8mb4 NULL',
                'SELECT 1'
            );
            PREPARE stmt FROM @sql_category;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;

            SET @has_cost := (
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'OrderDetails' AND COLUMN_NAME = 'CostPrice'
            );
            SET @sql_cost := IF(
                @has_cost = 0,
                'ALTER TABLE `OrderDetails` ADD `CostPrice` decimal(65,30) NOT NULL DEFAULT 0',
                'SELECT 1'
            );
            PREPARE stmt FROM @sql_cost;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;

            SET @has_gift := (
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'OrderDetails' AND COLUMN_NAME = 'IsGift'
            );
            SET @sql_gift := IF(
                @has_gift = 0,
                'ALTER TABLE `OrderDetails` ADD `IsGift` tinyint(1) NOT NULL DEFAULT 0',
                'SELECT 1'
            );
            PREPARE stmt FROM @sql_gift;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "CategorySnapshotName",
            table: "OrderDetails");

        migrationBuilder.DropColumn(
            name: "CostPrice",
            table: "OrderDetails");

        migrationBuilder.DropColumn(
            name: "IsGift",
            table: "OrderDetails");
    }
}
