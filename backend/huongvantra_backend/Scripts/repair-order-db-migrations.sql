-- Sửa lịch sử migration Order DB khi schema đã có sẵn nhưng EF chưa ghi nhận.
-- Chạy: docker exec -i hvt-mysql mysql -uhvtuser -phvtpass123 hvt_order_db < Scripts/repair-order-db-migrations.sql

USE hvt_order_db;

INSERT IGNORE INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES
  ('20260613120000_AddPromotionCategoryScopes', '8.0.0'),
  ('20260613130000_AddPromotionCustomerTierScopes', '8.0.0');

-- IdempotencyKey (Orders)
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Orders' AND COLUMN_NAME = 'IdempotencyKey'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `Orders` ADD COLUMN `IdempotencyKey` varchar(100) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Orders' AND INDEX_NAME = 'IX_Orders_IdempotencyKey'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE UNIQUE INDEX `IX_Orders_IdempotencyKey` ON `Orders` (`IdempotencyKey`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES
  ('20260628215806_AddOrderIdempotencyKey', '8.0.0');

-- CustomBundles
CREATE TABLE IF NOT EXISTS `CustomBundles` (
  `Id` char(36) COLLATE ascii_general_ci NOT NULL,
  `OrderId` char(36) COLLATE ascii_general_ci NOT NULL,
  `Label` varchar(200) NULL,
  `Note` varchar(500) NULL,
  `TotalPrice` decimal(18,2) NOT NULL,
  `PackingStatus` varchar(20) NOT NULL,
  `PackedAt` datetime(6) NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_CustomBundles_OrderId` (`OrderId`),
  KEY `IX_CustomBundles_PackingStatus` (`PackingStatus`),
  CONSTRAINT `FK_CustomBundles_Orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`Id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS `CustomBundleIngredients` (
  `Id` char(36) COLLATE ascii_general_ci NOT NULL,
  `CustomBundleId` char(36) COLLATE ascii_general_ci NOT NULL,
  `MaterialSkuId` char(36) COLLATE ascii_general_ci NOT NULL,
  `MaterialSkuCode` varchar(50) NOT NULL,
  `MaterialSnapshotName` varchar(255) NOT NULL,
  `Quantity` int NOT NULL,
  `UnitPrice` decimal(18,2) NOT NULL,
  `SubTotal` decimal(18,2) NOT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_CustomBundleIngredients_CustomBundleId` (`CustomBundleId`),
  CONSTRAINT `FK_CustomBundleIngredients_CustomBundles_CustomBundleId` FOREIGN KEY (`CustomBundleId`) REFERENCES `CustomBundles` (`Id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;

INSERT IGNORE INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES
  ('20260629120000_AddCustomBundles', '8.0.0');

SELECT MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId;
