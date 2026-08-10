-- =============================================================================
-- Seed tồn Kho + NCC cho nguyên liệu dụng cụ trà (NL-XUC-*, NL-TONG-*).
-- Prerequisites:
--   - ProductVariants NL-* đã có (fix-tool-product-boms-with-nl.sql hoặc import)
--   - Inventory DB migrated
-- Idempotent theo LotCode HVT-LOT-NL-* / SupplierCode NCC-HVT-04.
--
-- Windows:
--   docker cp backend/huongvantra_backend/Scripts/seed-tool-nl-inventory.sql hvt-mysql:/tmp/seed-tool-nl.sql
--   docker exec hvt-mysql mysql -uhvtuser -phvtpass123 --default-character-set=utf8mb4 -e "source /tmp/seed-tool-nl.sql"
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET @NOW = UTC_TIMESTAMP(6);
SET @SEED_USER = '00000000-0000-0000-0000-000000000000';

USE `hvt_inventory_db`;

-- NCC dụng cụ tre/gỗ (bổ sung); tống thủy tinh/gốm map NCC-HVT-03 nếu có
INSERT INTO Suppliers
  (Id, SupplierCode, NormalizedSupplierCode, Name, Phone, Email, Address, Note,
   IsDeleted, CreatedAt, UpdatedAt)
SELECT 'aaaaaaaa-1001-4000-8000-000000000004', 'NCC-HVT-04', 'NCC-HVT-04',
       'HTX Thủ công dụng cụ trà', '0912000004', 'dungcu@hvt.demo',
       'Thái Nguyên', 'Xúc trà tre/gỗ/đồng — nguyên liệu dụng cụ',
       0, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM Suppliers WHERE NormalizedSupplierCode = 'NCC-HVT-04');

SET @NCC3 = (SELECT Id FROM Suppliers WHERE NormalizedSupplierCode = 'NCC-HVT-03' AND IsDeleted = 0 LIMIT 1);
SET @NCC4 = (SELECT Id FROM Suppliers WHERE NormalizedSupplierCode = 'NCC-HVT-04' AND IsDeleted = 0 LIMIT 1);

DROP TEMPORARY TABLE IF EXISTS _tool_nl_seed;
CREATE TEMPORARY TABLE _tool_nl_seed (
  SkuCode varchar(50) NOT NULL PRIMARY KEY,
  DisplayName varchar(255) NOT NULL,
  UnitCost decimal(18,2) NOT NULL,
  WarehouseQty int NOT NULL,
  SupplierCode varchar(50) NOT NULL,
  SupplierItemCode varchar(50) NOT NULL,
  BatchId char(36) NOT NULL,
  ItemId char(36) NOT NULL,
  SupplierProductId char(36) NOT NULL
);

INSERT INTO _tool_nl_seed
  (SkuCode, DisplayName, UnitCost, WarehouseQty, SupplierCode, SupplierItemCode, BatchId, ItemId, SupplierProductId)
VALUES
  ('NL-XUC-TRE',        'Xúc trà tre (NL)',              20000,  200, 'NCC-HVT-04', 'DC-XUC-TRE',
   'c1000005-0000-4000-8000-000000000005', 'd1000005-0000-4000-8000-000000000005', 'bbbbbbbb-2001-4000-8000-000000000015'),
  ('NL-XUC-DONG-GO',    'Xúc trà đồng cán gỗ (NL)',      25000,  150, 'NCC-HVT-04', 'DC-XUC-DONG',
   'c1000006-0000-4000-8000-000000000006', 'd1000006-0000-4000-8000-000000000006', 'bbbbbbbb-2001-4000-8000-000000000016'),
  ('NL-XUC-GO-NAU',     'Xúc trà gỗ nâu (NL)',           45000,  120, 'NCC-HVT-04', 'DC-XUC-GO',
   'c1000007-0000-4000-8000-000000000007', 'd1000007-0000-4000-8000-000000000007', 'bbbbbbbb-2001-4000-8000-000000000017'),
  ('NL-XUC-VANG-DEN',   'Xúc trà vàng chuôi đen (NL)',  120000,   80, 'NCC-HVT-04', 'DC-XUC-VANG',
   'c1000008-0000-4000-8000-000000000008', 'd1000008-0000-4000-8000-000000000008', 'bbbbbbbb-2001-4000-8000-000000000018'),
  ('NL-XUC-CHUOI-RONG', 'Xúc trà chuôi rồng (NL)',       55000,  100, 'NCC-HVT-04', 'DC-XUC-RONG',
   'c1000009-0000-4000-8000-000000000009', 'd1000009-0000-4000-8000-000000000009', 'bbbbbbbb-2001-4000-8000-000000000019'),
  ('NL-TONG-THUY-TINH', 'Tống thủy tinh trong (NL)',    250000,   60, 'NCC-HVT-03', 'DC-TONG-TT',
   'c1000010-0000-4000-8000-000000000010', 'd1000010-0000-4000-8000-000000000010', 'bbbbbbbb-2001-4000-8000-000000000020'),
  ('NL-TONG-NAU-DO',    'Tống nâu đỏ (NL)',              60000,   80, 'NCC-HVT-03', 'DC-TONG-ND',
   'c1000011-0000-4000-8000-000000000011', 'd1000011-0000-4000-8000-000000000011', 'bbbbbbbb-2001-4000-8000-000000000021'),
  ('NL-TONG-QUAI-GO',   'Tống quai gỗ to (NL)',         180000,   50, 'NCC-HVT-03', 'DC-TONG-QG',
   'c1000012-0000-4000-8000-000000000012', 'd1000012-0000-4000-8000-000000000012', 'bbbbbbbb-2001-4000-8000-000000000022');

DROP TEMPORARY TABLE IF EXISTS _tool_nl_resolved;
CREATE TEMPORARY TABLE _tool_nl_resolved AS
SELECT
  t.*,
  v.Id AS SkuId,
  COALESCE(NULLIF(TRIM(p.Name), ''), t.DisplayName) AS ProductName,
  CASE
    WHEN t.SupplierCode = 'NCC-HVT-03' THEN @NCC3
    ELSE @NCC4
  END AS SupplierId
FROM _tool_nl_seed t
INNER JOIN hvt_product_db.ProductVariants v
  ON v.SkuCode = t.SkuCode AND v.IsDeleted = 0
INNER JOIN hvt_product_db.Products p
  ON p.Id = v.ProductId;

SELECT COUNT(*) INTO @tool_nl_missing
FROM _tool_nl_seed t
LEFT JOIN hvt_product_db.ProductVariants v ON v.SkuCode = t.SkuCode AND v.IsDeleted = 0
WHERE v.Id IS NULL;

DROP PROCEDURE IF EXISTS sp_tool_nl_require_catalog;
DELIMITER $$
CREATE PROCEDURE sp_tool_nl_require_catalog()
BEGIN
  IF IFNULL(@tool_nl_missing, 0) > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'seed-tool-nl aborted: missing NL-XUC/NL-TONG ProductVariants. Run fix-tool-product-boms-with-nl.sql first.';
  END IF;
END$$
DELIMITER ;
CALL sp_tool_nl_require_catalog();
DROP PROCEDURE IF EXISTS sp_tool_nl_require_catalog;

-- SkuStocks: NL chỉ tồn Kho
INSERT INTO SkuStocks
  (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, ReservedQuantity,
   LowStockThreshold, WarehouseLowStockThreshold, ShelfLowStockThreshold, CreatedAt, UpdatedAt)
SELECT
  r.SkuId, r.SkuCode, 0, 0, r.WarehouseQty, 0,
  20, 30, 0, @NOW, @NOW
FROM _tool_nl_resolved r
ON DUPLICATE KEY UPDATE
  SkuCode = VALUES(SkuCode),
  WarehouseQuantityOnHand = VALUES(WarehouseQuantityOnHand),
  WarehouseLowStockThreshold = VALUES(WarehouseLowStockThreshold),
  UpdatedAt = @NOW;

-- Xóa lô seed cũ của NL dụng cụ (idempotent)
DELETE wbi FROM WarehouseBatchItems wbi
INNER JOIN WarehouseBatches wb ON wb.Id = wbi.WarehouseBatchId
WHERE wb.LotCode LIKE 'HVT-LOT-NL-XUC-%' OR wb.LotCode LIKE 'HVT-LOT-NL-TONG-%'
   OR wb.Id IN (SELECT BatchId FROM _tool_nl_seed);

DELETE FROM WarehouseBatches
WHERE LotCode LIKE 'HVT-LOT-NL-XUC-%' OR LotCode LIKE 'HVT-LOT-NL-TONG-%'
   OR Id IN (SELECT BatchId FROM _tool_nl_seed);

INSERT INTO WarehouseBatches
  (Id, LotCode, BatchCode, Supplier, ExpiresAt, Note, SourceType, SourceReferenceId,
   SourceReferenceCode, Location, ParentBatchId, SourceBatchId, Status,
   CreatedBy, CreatedAt, UpdatedAt)
SELECT
  r.BatchId,
  CONCAT('HVT-LOT-', r.SkuCode, '-1'),
  CONCAT('HVT-LOT-', r.SkuCode, '-1'),
  CASE WHEN r.SupplierCode = 'NCC-HVT-03' THEN 'Xưởng gốm sứ Bát Tràng' ELSE 'HTX Thủ công dụng cụ trà' END,
  DATE_ADD(@NOW, INTERVAL 24 MONTH),
  'Seed NL dụng cụ trà — tồn Kho',
  'hvt_tool_nl_seed',
  NULL,
  'HVT-TOOL-NL',
  'Warehouse',
  NULL,
  NULL,
  'active',
  @SEED_USER,
  @NOW,
  @NOW
FROM _tool_nl_resolved r
ON DUPLICATE KEY UPDATE
  Supplier = VALUES(Supplier),
  Note = VALUES(Note),
  Location = 'Warehouse',
  Status = 'active',
  UpdatedAt = @NOW;

INSERT INTO WarehouseBatchItems
  (Id, WarehouseBatchId, SkuId, SkuCode, ProductSnapshotName,
   QuantityOnHand, InitialQuantity, UnitCost, CreatedAt, UpdatedAt)
SELECT
  r.ItemId,
  r.BatchId,
  r.SkuId,
  r.SkuCode,
  r.ProductName,
  r.WarehouseQty,
  r.WarehouseQty,
  r.UnitCost,
  @NOW,
  @NOW
FROM _tool_nl_resolved r
ON DUPLICATE KEY UPDATE
  QuantityOnHand = VALUES(QuantityOnHand),
  InitialQuantity = VALUES(InitialQuantity),
  UnitCost = VALUES(UnitCost),
  ProductSnapshotName = VALUES(ProductSnapshotName),
  UpdatedAt = @NOW;

-- Đồng bộ aggregate Kho = tổng batch Warehouse
UPDATE SkuStocks s
INNER JOIN (
  SELECT wbi.SkuId, SUM(wbi.QuantityOnHand) AS WhQty
  FROM WarehouseBatchItems wbi
  INNER JOIN WarehouseBatches wb ON wb.Id = wbi.WarehouseBatchId
  WHERE wb.Location = 'Warehouse' AND wb.Status = 'active'
  GROUP BY wbi.SkuId
) x ON x.SkuId = s.SkuId
INNER JOIN _tool_nl_resolved r ON r.SkuId = s.SkuId
SET s.WarehouseQuantityOnHand = x.WhQty, s.UpdatedAt = @NOW;

-- SupplierProducts
INSERT INTO SupplierProducts
  (Id, SupplierId, SkuId, SkuCodeSnapshot, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SupplierItemCode, NormalizedSupplierItemCode, SupplierItemName, QuotedPrice, MinimumOrderQuantity,
   LeadTimeDays, IsPrimarySource, Note, IsActive, CreatedAt, UpdatedAt)
SELECT
  r.SupplierProductId,
  r.SupplierId,
  r.SkuId,
  r.SkuCode,
  r.ProductName,
  'NGUYEN_LIEU',
  'Piece',
  r.SupplierItemCode,
  r.SupplierItemCode,
  r.DisplayName,
  r.UnitCost,
  10,
  7,
  1,
  'Seed NL dụng cụ trà',
  1,
  @NOW,
  @NOW
FROM _tool_nl_resolved r
WHERE r.SupplierId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM SupplierProducts sp WHERE sp.Id = r.SupplierProductId);

SELECT s.SkuCode, s.WarehouseQuantityOnHand, sp.SupplierItemCode, sup.Name AS SupplierName
FROM SkuStocks s
INNER JOIN _tool_nl_resolved r ON r.SkuId = s.SkuId
LEFT JOIN SupplierProducts sp ON sp.Id = r.SupplierProductId
LEFT JOIN Suppliers sup ON sup.Id = r.SupplierId
ORDER BY s.SkuCode;
