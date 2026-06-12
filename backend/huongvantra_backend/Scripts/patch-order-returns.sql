USE `hvt_order_db`;

SET @has_returned_qty := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'hvt_order_db'
    AND TABLE_NAME = 'OrderDetails'
    AND COLUMN_NAME = 'ReturnedQuantity'
);

SET @sql := IF(
  @has_returned_qty = 0,
  'ALTER TABLE `OrderDetails` ADD `ReturnedQuantity` int NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `ReturnOrders` (
  `Id` char(36) COLLATE ascii_general_ci NOT NULL,
  `ReturnCode` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
  `SourceOrderId` char(36) COLLATE ascii_general_ci NOT NULL,
  `SourceOrderCode` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
  `CustomerId` char(36) COLLATE ascii_general_ci NULL,
  `CustomerSnapshotName` varchar(100) CHARACTER SET utf8mb4 NULL,
  `ReturnAmount` decimal(18,2) NOT NULL,
  `ExchangeAmount` decimal(18,2) NOT NULL,
  `NetCustomerPays` decimal(18,2) NOT NULL,
  `RefundAmount` decimal(18,2) NOT NULL,
  `CustomerPaidAmount` decimal(18,2) NOT NULL,
  `RefundMethod` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
  `ExchangeOrderId` char(36) COLLATE ascii_general_ci NULL,
  `Note` varchar(500) CHARACTER SET utf8mb4 NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ReturnOrders_ReturnCode` (`ReturnCode`),
  KEY `IX_ReturnOrders_SourceOrderId` (`SourceOrderId`),
  CONSTRAINT `FK_ReturnOrders_Orders_SourceOrderId` FOREIGN KEY (`SourceOrderId`) REFERENCES `Orders` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ReturnOrderDetails` (
  `Id` char(36) COLLATE ascii_general_ci NOT NULL,
  `ReturnOrderId` char(36) COLLATE ascii_general_ci NOT NULL,
  `SourceOrderDetailId` char(36) COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) COLLATE ascii_general_ci NOT NULL,
  `SkuSnapshotName` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
  `SkuSnapshotCode` varchar(50) CHARACTER SET utf8mb4 NULL,
  `ReturnQuantity` int NOT NULL,
  `UnitPrice` decimal(18,2) NOT NULL,
  `SubTotal` decimal(18,2) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_ReturnOrderDetails_ReturnOrderId` (`ReturnOrderId`),
  CONSTRAINT `FK_ReturnOrderDetails_ReturnOrders_ReturnOrderId` FOREIGN KEY (`ReturnOrderId`) REFERENCES `ReturnOrders` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260612093719_AddOrderReturns', '8.0.0'
WHERE NOT EXISTS (
  SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260612093719_AddOrderReturns'
);
