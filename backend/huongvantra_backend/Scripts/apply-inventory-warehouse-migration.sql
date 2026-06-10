-- Áp dụng migration AddWarehouseStockAndExportSlips nếu EF chưa chạy
USE hvt_inventory_db;

SET @migration_id = '20260609180000_AddWarehouseStockAndExportSlips';

-- SkuStocks.WarehouseQuantityOnHand
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'hvt_inventory_db' AND TABLE_NAME = 'SkuStocks' AND COLUMN_NAME = 'WarehouseQuantityOnHand'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `SkuStocks` ADD `WarehouseQuantityOnHand` int NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- StockAdjustmentRequests columns
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'hvt_inventory_db' AND TABLE_NAME = 'StockAdjustmentRequests' AND COLUMN_NAME = 'ExportSlipId'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `StockAdjustmentRequests` ADD `ExportSlipId` char(36) NULL COLLATE ascii_general_ci',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'hvt_inventory_db' AND TABLE_NAME = 'StockAdjustmentRequests' AND COLUMN_NAME = 'QuantityOnHandAfter'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `StockAdjustmentRequests` ADD `QuantityOnHandAfter` int NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'hvt_inventory_db' AND TABLE_NAME = 'StockAdjustmentRequests' AND COLUMN_NAME = 'WarehouseQuantityOnHandAfter'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `StockAdjustmentRequests` ADD `WarehouseQuantityOnHandAfter` int NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- StockExportSlips table
CREATE TABLE IF NOT EXISTS `StockExportSlips` (
  `Id` char(36) NOT NULL COLLATE ascii_general_ci,
  `ExportCode` varchar(30) NOT NULL,
  `ExportType` varchar(30) NOT NULL,
  `StockAdjustmentRequestId` char(36) NULL COLLATE ascii_general_ci,
  `SkuId` char(36) NOT NULL COLLATE ascii_general_ci,
  `SkuCode` varchar(50) NOT NULL,
  `SkuSnapshotName` varchar(255) NOT NULL,
  `Quantity` int NOT NULL,
  `WarehouseQtyBefore` int NOT NULL,
  `WarehouseQtyAfter` int NOT NULL,
  `StoreQtyBefore` int NOT NULL,
  `StoreQtyAfter` int NOT NULL,
  `Note` varchar(500) NULL,
  `CreatedBy` char(36) NOT NULL COLLATE ascii_general_ci,
  `CreatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_StockExportSlips_ExportCode` (`ExportCode`),
  KEY `IX_StockExportSlips_CreatedAt` (`CreatedAt`),
  KEY `IX_StockExportSlips_StockAdjustmentRequestId` (`StockAdjustmentRequestId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @idx_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = 'hvt_inventory_db' AND TABLE_NAME = 'StockAdjustmentRequests' AND INDEX_NAME = 'IX_StockAdjustmentRequests_ExportSlipId'
);
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX `IX_StockAdjustmentRequests_ExportSlipId` ON `StockAdjustmentRequests` (`ExportSlipId`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = 'hvt_inventory_db' AND TABLE_NAME = 'StockAdjustmentRequests'
    AND CONSTRAINT_NAME = 'FK_StockAdjustmentRequests_StockExportSlips_ExportSlipId'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE `StockAdjustmentRequests` ADD CONSTRAINT `FK_StockAdjustmentRequests_StockExportSlips_ExportSlipId` FOREIGN KEY (`ExportSlipId`) REFERENCES `StockExportSlips` (`Id`) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT @migration_id, '8.0.0'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = @migration_id
);
