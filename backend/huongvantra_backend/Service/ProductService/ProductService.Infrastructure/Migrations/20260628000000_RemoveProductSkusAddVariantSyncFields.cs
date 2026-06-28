using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductService.Infrastructure.Migrations
{
    public partial class RemoveProductSkusAddVariantSyncFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: Add new columns to ProductVariants (idempotent via information_schema)
            migrationBuilder.Sql(@"SET @s1 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductVariants' AND COLUMN_NAME = 'SyncedToStoreAt'); SET @q1 = IF(@s1 = 0, 'ALTER TABLE `ProductVariants` ADD COLUMN `SyncedToStoreAt` datetime(6) NULL', 'SELECT 1'); PREPARE stmt FROM @q1; EXECUTE stmt; DEALLOCATE PREPARE stmt;");

            migrationBuilder.Sql(@"SET @s2 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductVariants' AND COLUMN_NAME = 'WeightInGrams'); SET @q2 = IF(@s2 = 0, 'ALTER TABLE `ProductVariants` ADD COLUMN `WeightInGrams` int NOT NULL DEFAULT 0', 'SELECT 1'); PREPARE stmt FROM @q2; EXECUTE stmt; DEALLOCATE PREPARE stmt;");

            // Step 2: Drop FK from PriceBookEntries to ProductSKUs
            migrationBuilder.Sql(@"SET @fk1 = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'PriceBookEntries' AND CONSTRAINT_NAME = 'FK_PriceBookEntries_ProductSKUs_SkuId' AND CONSTRAINT_TYPE = 'FOREIGN KEY'); SET @q3 = IF(@fk1 > 0, 'ALTER TABLE `PriceBookEntries` DROP FOREIGN KEY `FK_PriceBookEntries_ProductSKUs_SkuId`', 'SELECT 1'); PREPARE stmt FROM @q3; EXECUTE stmt; DEALLOCATE PREPARE stmt;");

            // Step 3: Create new unique index WITHOUT SkuId FIRST — so PriceBookId FK has an index to use
            migrationBuilder.Sql(@"SET @ix3 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PriceBookEntries' AND INDEX_NAME = 'IX_PriceBookEntries_PriceBookId_VariantId_UnitId'); SET @q7 = IF(@ix3 = 0, 'CREATE UNIQUE INDEX `IX_PriceBookEntries_PriceBookId_VariantId_UnitId` ON `PriceBookEntries` (`PriceBookId`, `VariantId`, `UnitId`)', 'SELECT 1'); PREPARE stmt FROM @q7; EXECUTE stmt; DEALLOCATE PREPARE stmt;");

            // Step 4: Now safe to drop old composite index (PriceBookId FK now uses the new index)
            migrationBuilder.Sql(@"SET @ix1 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PriceBookEntries' AND INDEX_NAME = 'IX_PriceBookEntries_PriceBookId_SkuId_VariantId_UnitId'); SET @q4 = IF(@ix1 > 0, 'ALTER TABLE `PriceBookEntries` DROP INDEX `IX_PriceBookEntries_PriceBookId_SkuId_VariantId_UnitId`', 'SELECT 1'); PREPARE stmt FROM @q4; EXECUTE stmt; DEALLOCATE PREPARE stmt;");

            // Step 5: Drop SkuId standalone index
            migrationBuilder.Sql(@"SET @ix2 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PriceBookEntries' AND INDEX_NAME = 'IX_PriceBookEntries_SkuId'); SET @q5 = IF(@ix2 > 0, 'ALTER TABLE `PriceBookEntries` DROP INDEX `IX_PriceBookEntries_SkuId`', 'SELECT 1'); PREPARE stmt FROM @q5; EXECUTE stmt; DEALLOCATE PREPARE stmt;");

            // Step 6: Drop SkuId column
            migrationBuilder.Sql(@"SET @c1 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PriceBookEntries' AND COLUMN_NAME = 'SkuId'); SET @q6 = IF(@c1 > 0, 'ALTER TABLE `PriceBookEntries` DROP COLUMN `SkuId`', 'SELECT 1'); PREPARE stmt FROM @q6; EXECUTE stmt; DEALLOCATE PREPARE stmt;");

            // Step 7: Drop ProductSKUs table
            migrationBuilder.Sql(@"SET @t1 = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductSKUs'); SET @q8 = IF(@t1 > 0, 'DROP TABLE `ProductSKUs`', 'SELECT 1'); PREPARE stmt FROM @q8; EXECUTE stmt; DEALLOCATE PREPARE stmt;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new InvalidOperationException("Down migration not supported: ProductSKUs table has been permanently removed.");
        }
    }
}
