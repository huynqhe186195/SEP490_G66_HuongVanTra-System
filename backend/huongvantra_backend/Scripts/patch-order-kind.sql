-- Run against hvt_order_db when migration was not applied automatically.
USE hvt_order_db;

SET @col_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'hvt_order_db'
      AND TABLE_NAME = 'Orders'
      AND COLUMN_NAME = 'OrderKind'
);

SET @ddl := IF(
    @col_exists = 0,
    'ALTER TABLE Orders ADD COLUMN OrderKind varchar(20) NOT NULL DEFAULT ''Sale''',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'hvt_order_db'
      AND TABLE_NAME = 'Orders'
      AND INDEX_NAME = 'IX_Orders_OrderKind'
);

SET @idx_ddl := IF(
    @idx_exists = 0,
    'CREATE INDEX IX_Orders_OrderKind ON Orders (OrderKind)',
    'SELECT 1'
);
PREPARE stmt2 FROM @idx_ddl;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

UPDATE Orders o
INNER JOIN ReturnOrders r ON r.ExchangeOrderId = o.Id
SET o.OrderKind = 'Exchange'
WHERE r.ExchangeOrderId IS NOT NULL;

INSERT IGNORE INTO __EFMigrationsHistory (MigrationId, ProductVersion)
VALUES ('20260612101916_AddOrderKind', '8.0.11');
