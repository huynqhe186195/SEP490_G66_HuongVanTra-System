-- Chạy khi OrderDetails thiếu cột báo cáo (lỗi Unknown column CategorySnapshotName / CostPrice / IsGift).
USE `hvt_order_db`;

SET @has_category := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'hvt_order_db'
    AND TABLE_NAME = 'OrderDetails'
    AND COLUMN_NAME = 'CategorySnapshotName'
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
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'hvt_order_db'
    AND TABLE_NAME = 'OrderDetails'
    AND COLUMN_NAME = 'CostPrice'
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
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'hvt_order_db'
    AND TABLE_NAME = 'OrderDetails'
    AND COLUMN_NAME = 'IsGift'
);
SET @sql_gift := IF(
  @has_gift = 0,
  'ALTER TABLE `OrderDetails` ADD `IsGift` tinyint(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql_gift;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ghi nhận migration để EF không chạy lại InitialCreate trên DB đã có bảng.
INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260613101635_InitialCreate', '8.0.11'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = 'hvt_order_db' AND TABLE_NAME = 'Orders'
)
AND NOT EXISTS (
  SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260613101635_InitialCreate'
);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260612101916_AddOrderKind', '8.0.11'
WHERE NOT EXISTS (
  SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260612101916_AddOrderKind'
);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260613163000_AddOrderDetailIsGift', '8.0.11'
WHERE NOT EXISTS (
  SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260613163000_AddOrderDetailIsGift'
);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260613170000_AddOrderDetailReportingColumns', '8.0.11'
WHERE NOT EXISTS (
  SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260613170000_AddOrderDetailReportingColumns'
);
