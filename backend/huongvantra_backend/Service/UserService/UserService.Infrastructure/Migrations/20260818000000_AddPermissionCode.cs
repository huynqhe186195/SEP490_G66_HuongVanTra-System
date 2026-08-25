using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using UserService.Infrastructure.Data;

#nullable disable

namespace UserService.Infrastructure.Migrations
{
    [DbContext(typeof(UserDbContext))]
    [Migration("20260818000000_AddPermissionCode")]
    public partial class AddPermissionCode : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Some existing databases already received this column outside EF's
            // migration history. Keep startup migration safe for both states.
            migrationBuilder.Sql(@"
                SET @permission_code_exists := (
                    SELECT COUNT(*)
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'Permissions'
                      AND COLUMN_NAME = 'PermissionCode');
                SET @permission_code_sql := IF(
                    @permission_code_exists = 0,
                    'ALTER TABLE `Permissions` ADD COLUMN `PermissionCode` varchar(100) CHARACTER SET utf8mb4 NULL',
                    'SELECT 1');
                PREPARE permission_code_statement FROM @permission_code_sql;
                EXECUTE permission_code_statement;
                DEALLOCATE PREPARE permission_code_statement;");

            migrationBuilder.Sql(
                "UPDATE Permissions SET PermissionCode = PermissionName WHERE PermissionCode IS NULL OR PermissionCode = ''");

            migrationBuilder.AlterColumn<string>(
                name: "PermissionCode",
                table: "Permissions",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            // An earlier non-EF seed could leave an unassigned duplicate row
            // (same semantic name/code) behind. Remove only duplicates that
            // have no role assignment; assigned permissions are never deleted.
            migrationBuilder.Sql(@"
                DELETE duplicate_permission
                FROM `Permissions` AS duplicate_permission
                INNER JOIN `Permissions` AS retained_permission
                    ON retained_permission.`PermissionCode` = duplicate_permission.`PermissionCode`
                   AND retained_permission.`PermissionName` = duplicate_permission.`PermissionName`
                   AND retained_permission.`Id` > duplicate_permission.`Id`
                LEFT JOIN `RolePermissions` AS role_permission
                    ON role_permission.`PermissionId` = duplicate_permission.`Id`
                WHERE role_permission.`PermissionId` IS NULL;");

            migrationBuilder.Sql(@"
                SET @permission_code_index_exists := (
                    SELECT COUNT(*)
                    FROM INFORMATION_SCHEMA.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'Permissions'
                      AND INDEX_NAME = 'IX_Permissions_PermissionCode');
                SET @permission_code_index_sql := IF(
                    @permission_code_index_exists = 0,
                    'CREATE UNIQUE INDEX `IX_Permissions_PermissionCode` ON `Permissions` (`PermissionCode`)',
                    'SELECT 1');
                PREPARE permission_code_index_statement FROM @permission_code_index_sql;
                EXECUTE permission_code_index_statement;
                DEALLOCATE PREPARE permission_code_index_statement;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Permissions_PermissionCode",
                table: "Permissions");

            migrationBuilder.DropColumn(
                name: "PermissionCode",
                table: "Permissions");
        }
    }
}
