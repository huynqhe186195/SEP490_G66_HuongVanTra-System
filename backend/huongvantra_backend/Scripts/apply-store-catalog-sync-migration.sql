-- Áp dụng migration AddStoreCatalogSync nếu EF chưa chạy
USE `hvt_product_db`;

SET @migration_id = '20260610120000_AddStoreCatalogSync';

-- Categories.SyncedToStoreAt
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'hvt_product_db' AND TABLE_NAME = 'Categories' AND COLUMN_NAME = 'SyncedToStoreAt') = 0,
  'ALTER TABLE `Categories` ADD `SyncedToStoreAt` datetime(6) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Products.SyncedToStoreAt
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'hvt_product_db' AND TABLE_NAME = 'Products' AND COLUMN_NAME = 'SyncedToStoreAt') = 0,
  'ALTER TABLE `Products` ADD `SyncedToStoreAt` datetime(6) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductSKUs.SyncedToStoreAt
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'hvt_product_db' AND TABLE_NAME = 'ProductSKUs' AND COLUMN_NAME = 'SyncedToStoreAt') = 0,
  'ALTER TABLE `ProductSKUs` ADD `SyncedToStoreAt` datetime(6) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `Categories` SET `SyncedToStoreAt` = `CreatedAt` WHERE `SyncedToStoreAt` IS NULL;
UPDATE `Products` SET `SyncedToStoreAt` = `CreatedAt` WHERE `SyncedToStoreAt` IS NULL;
UPDATE `ProductSKUs` SET `SyncedToStoreAt` = `CreatedAt` WHERE `SyncedToStoreAt` IS NULL;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT @migration_id, '8.0.0'
WHERE NOT EXISTS (
  SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = @migration_id
);
