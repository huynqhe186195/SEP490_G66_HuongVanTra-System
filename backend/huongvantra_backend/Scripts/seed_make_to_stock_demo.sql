-- =============================================================================
-- HuongVanTra - Inventory Workflow 1 make-to-stock demo seed
--
-- Apply from backend/huongvantra_backend:
--   docker exec -i -e "MYSQL_PWD=$env:MYSQL_ROOT_PASSWORD" hvt-mysql mysql --default-character-set=utf8mb4 -uroot < Scripts\seed_make_to_stock_demo.sql
--
-- Scope:
--   - Product catalog demo data for raw materials and jasmine tea finished goods.
--   - BOM for FG-TRA-NHAI-50G and FG-TRA-NHAI-100G.
--   - Central warehouse stock for raw materials only.
--   - POS/store QuantityOnHand remains 0 for every seeded SKU.
--
-- Rerunnable behavior:
--   - Stable IDs/codes are used.
--   - Product/category/variant/stock/batch rows are upserted.
--   - BOM rows for the two demo finished variants are deleted and reinserted.
-- =============================================================================

SET NAMES utf8mb4;
SET @NOW = UTC_TIMESTAMP(6);
SET @ZERO_USER_ID = '00000000-0000-0000-0000-000000000000';

-- UTF-8 text constants encoded as hex to survive PowerShell piping.
SET @CAT_RAW_NAME = CONVERT(UNHEX('4E677579C3AA6E206C69E1BB87752073E1BAA36E207875E1BAA574') USING utf8mb4);
SET @CAT_RAW_DESC = CONVERT(UNHEX('44656D6F20726177206D6174657269616C7320616E64206D616B652D746F2D73746F636B2066696E697368656420676F6F6473') USING utf8mb4);
SET @RM_TRA_NHAI_NAME = CONVERT(UNHEX('5472C3A0206E68C3A069206E677579C3AA6E206C69E1BB8775') USING utf8mb4);
SET @RM_TRA_NHAI_DESC = CONVERT(UNHEX('5472C3A0206E68C3A069206E677579C3AA6E206C69E1BB87752C20C4916F207468656F206772616D') USING utf8mb4);
SET @RM_TUI_ZIP_NAME = CONVERT(UNHEX('54C3BA69207A6970') USING utf8mb4);
SET @RM_TUI_ZIP_DESC = CONVERT(UNHEX('54C3BA69207A697020C491C3B36E672067C3B369207472C3A0') USING utf8mb4);
SET @RM_HOP_GIAY_NAME = CONVERT(UNHEX('48E1BB9970206769E1BAA579') USING utf8mb4);
SET @RM_HOP_GIAY_DESC = CONVERT(UNHEX('48E1BB9970206769E1BAA57920C491C3B36E672067C3B369207472C3A0') USING utf8mb4);
SET @RM_TEM_NHAN_NAME = CONVERT(UNHEX('54656D206E68C3A36E') USING utf8mb4);
SET @RM_TEM_NHAN_DESC = CONVERT(UNHEX('54656D206E68C3A36E2073E1BAA36E207068E1BAA96D') USING utf8mb4);
SET @FG_TRA_NHAI_NAME = CONVERT(UNHEX('5472C3A0206E68C3A069') USING utf8mb4);
SET @FG_TRA_NHAI_DESC = CONVERT(UNHEX('5468C3A06E68207068E1BAA96D207472C3A0206E68C3A069206D616B652D746F2D73746F636B') USING utf8mb4);
SET @UNIT_GRAM = CONVERT(UNHEX('6772616D') USING utf8mb4);
SET @UNIT_CAI = CONVERT(UNHEX('63C3A169') USING utf8mb4);
SET @VARIANT_GRAM = CONVERT(UNHEX('6772616D') USING utf8mb4);
SET @VARIANT_CAI = CONVERT(UNHEX('63C3A169') USING utf8mb4);
SET @VARIANT_GOI_50G = CONVERT(UNHEX('67C3B36920353067') USING utf8mb4);
SET @VARIANT_GOI_100G = CONVERT(UNHEX('67C3B3692031303067') USING utf8mb4);
SET @SNAP_FG_50G = CONVERT(UNHEX('5472C3A0206E68C3A06920353067') USING utf8mb4);
SET @SNAP_FG_100G = CONVERT(UNHEX('5472C3A0206E68C3A0692031303067') USING utf8mb4);
SET @BATCH_SUPPLIER = CONVERT(UNHEX('536565642064656D6F20496E76656E746F727920576F726B666C6F772031') USING utf8mb4);
SET @BATCH_NOTE = CONVERT(UNHEX('4261746368206E677579C3AA6E206C69E1BB87752064656D6F206D616B652D746F2D73746F636B') USING utf8mb4);

SET @CAT_RAW_ID = 9301;
SET @CAT_FINISHED_ID = 9302;

SET @PROD_RM_TRA_NHAI_ID = '11111111-2501-4000-8000-000000000001';
SET @PROD_RM_TUI_ZIP_ID = '11111111-2501-4000-8000-000000000002';
SET @PROD_RM_HOP_GIAY_ID = '11111111-2501-4000-8000-000000000003';
SET @PROD_RM_TEM_NHAN_ID = '11111111-2501-4000-8000-000000000004';
SET @PROD_FG_TRA_NHAI_ID = '11111111-2501-4000-8000-000000000005';

SET @SKU_RM_TRA_NHAI_ID = '22222222-2501-4000-8000-000000000001';
SET @SKU_RM_TUI_ZIP_ID = '22222222-2501-4000-8000-000000000002';
SET @SKU_RM_HOP_GIAY_ID = '22222222-2501-4000-8000-000000000003';
SET @SKU_RM_TEM_NHAN_ID = '22222222-2501-4000-8000-000000000004';
SET @SKU_FG_50G_ID = '22222222-2501-4000-8000-000000000005';
SET @SKU_FG_100G_ID = '22222222-2501-4000-8000-000000000006';

-- -----------------------------------------------------------------------------
-- Product DB - categories, products, variants, BOM
-- -----------------------------------------------------------------------------
USE `hvt_product_db`;

INSERT INTO Categories
  (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
VALUES
  (@CAT_RAW_ID, @CAT_RAW_NAME, @CAT_RAW_DESC, NULL, 1, @NOW, @NOW, @NOW, 0),
  (@CAT_FINISHED_ID, @FG_TRA_NHAI_NAME, @FG_TRA_NHAI_DESC, NULL, 1, @NOW, @NOW, @NOW, 0)
ON DUPLICATE KEY UPDATE
  Name = VALUES(Name),
  Description = VALUES(Description),
  ParentId = VALUES(ParentId),
  IsActive = 1,
  SyncedToStoreAt = VALUES(SyncedToStoreAt),
  UpdatedAt = @NOW,
  IsDeleted = 0;

INSERT INTO Products
  (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description,
   BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt,
   CreatedAt, UpdatedAt, IsDeleted)
VALUES
  (@PROD_RM_TRA_NHAI_ID, @CAT_RAW_ID, 'NGUYEN_LIEU', @RM_TRA_NHAI_NAME, NULL, NULL, NULL, @RM_TRA_NHAI_DESC,
   @UNIT_GRAM, 1.0000, @UNIT_GRAM, 0, 1, @NOW, @NOW, @NOW, 0),
  (@PROD_RM_TUI_ZIP_ID, @CAT_RAW_ID, 'NGUYEN_LIEU', @RM_TUI_ZIP_NAME, NULL, NULL, NULL, @RM_TUI_ZIP_DESC,
   @UNIT_CAI, 1.0000, @UNIT_CAI, 0, 1, @NOW, @NOW, @NOW, 0),
  (@PROD_RM_HOP_GIAY_ID, @CAT_RAW_ID, 'NGUYEN_LIEU', @RM_HOP_GIAY_NAME, NULL, NULL, NULL, @RM_HOP_GIAY_DESC,
   @UNIT_CAI, 1.0000, @UNIT_CAI, 0, 1, @NOW, @NOW, @NOW, 0),
  (@PROD_RM_TEM_NHAN_ID, @CAT_RAW_ID, 'NGUYEN_LIEU', @RM_TEM_NHAN_NAME, NULL, NULL, NULL, @RM_TEM_NHAN_DESC,
   @UNIT_CAI, 1.0000, @UNIT_CAI, 0, 1, @NOW, @NOW, @NOW, 0),
  (@PROD_FG_TRA_NHAI_ID, @CAT_FINISHED_ID, 'THANH_PHAM', @FG_TRA_NHAI_NAME, NULL, NULL, NULL, @FG_TRA_NHAI_DESC,
   @UNIT_CAI, NULL, NULL, 1, 1, @NOW, @NOW, @NOW, 0)
ON DUPLICATE KEY UPDATE
  CategoryId = VALUES(CategoryId),
  ProductType = VALUES(ProductType),
  Name = VALUES(Name),
  Description = VALUES(Description),
  BaseUnit = VALUES(BaseUnit),
  WeightValue = VALUES(WeightValue),
  WeightUnit = VALUES(WeightUnit),
  IsVariantParent = VALUES(IsVariantParent),
  IsActive = 1,
  SyncedToStoreAt = VALUES(SyncedToStoreAt),
  UpdatedAt = @NOW,
  IsDeleted = 0;

INSERT INTO ProductVariants
  (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice,
   MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams,
   SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
VALUES
  (@SKU_RM_TRA_NHAI_ID, @PROD_RM_TRA_NHAI_ID, 'RM-TRA-NHAI-G', NULL, @VARIANT_GRAM, '{"unit":"gram"}', 0.20, 0.00,
   1000, 20000, 0, 0, 1, NULL, 1, @NOW, @NOW, @NOW, 0),
  (@SKU_RM_TUI_ZIP_ID, @PROD_RM_TUI_ZIP_ID, 'RM-TUI-ZIP', NULL, @VARIANT_CAI, '{"unit":"piece"}', 500.00, 0.00,
   50, 2000, 0, 0, 1, NULL, 0, @NOW, @NOW, @NOW, 0),
  (@SKU_RM_HOP_GIAY_ID, @PROD_RM_HOP_GIAY_ID, 'RM-HOP-GIAY', NULL, @VARIANT_CAI, '{"unit":"piece"}', 1200.00, 0.00,
   50, 2000, 0, 0, 1, NULL, 0, @NOW, @NOW, @NOW, 0),
  (@SKU_RM_TEM_NHAN_ID, @PROD_RM_TEM_NHAN_ID, 'RM-TEM-NHAN', NULL, @VARIANT_CAI, '{"unit":"piece"}', 200.00, 0.00,
   50, 2000, 0, 0, 1, NULL, 0, @NOW, @NOW, @NOW, 0),
  (@SKU_FG_50G_ID, @PROD_FG_TRA_NHAI_ID, 'FG-TRA-NHAI-50G', NULL, @VARIANT_GOI_50G, '{"weight":"50g"}', 12000.00, 25000.00,
   0, 10000, 1, 1, 1, NULL, 50, @NOW, @NOW, @NOW, 0),
  (@SKU_FG_100G_ID, @PROD_FG_TRA_NHAI_ID, 'FG-TRA-NHAI-100G', NULL, @VARIANT_GOI_100G, '{"weight":"100g"}', 22000.00, 45000.00,
   0, 10000, 1, 1, 1, NULL, 100, @NOW, @NOW, @NOW, 0)
ON DUPLICATE KEY UPDATE
  ProductId = VALUES(ProductId),
  VariantName = VALUES(VariantName),
  OptionValuesJson = VALUES(OptionValuesJson),
  CostPrice = VALUES(CostPrice),
  RetailPrice = VALUES(RetailPrice),
  MinStock = VALUES(MinStock),
  MaxStock = VALUES(MaxStock),
  IsSellable = VALUES(IsSellable),
  AllowRewardPoints = VALUES(AllowRewardPoints),
  IsActive = 1,
  ImageUrl = VALUES(ImageUrl),
  WeightInGrams = VALUES(WeightInGrams),
  SyncedToStoreAt = VALUES(SyncedToStoreAt),
  UpdatedAt = @NOW,
  IsDeleted = 0;

-- If a demo SKU code already existed with a different Id, use the actual row Id.
SET @SKU_RM_TRA_NHAI_ID = (SELECT Id FROM ProductVariants WHERE SkuCode = 'RM-TRA-NHAI-G' LIMIT 1);
SET @SKU_RM_TUI_ZIP_ID = (SELECT Id FROM ProductVariants WHERE SkuCode = 'RM-TUI-ZIP' LIMIT 1);
SET @SKU_RM_HOP_GIAY_ID = (SELECT Id FROM ProductVariants WHERE SkuCode = 'RM-HOP-GIAY' LIMIT 1);
SET @SKU_RM_TEM_NHAN_ID = (SELECT Id FROM ProductVariants WHERE SkuCode = 'RM-TEM-NHAN' LIMIT 1);
SET @SKU_FG_50G_ID = (SELECT Id FROM ProductVariants WHERE SkuCode = 'FG-TRA-NHAI-50G' LIMIT 1);
SET @SKU_FG_100G_ID = (SELECT Id FROM ProductVariants WHERE SkuCode = 'FG-TRA-NHAI-100G' LIMIT 1);

DELETE FROM ProductVariantBomLines
WHERE ProductVariantId IN (@SKU_FG_50G_ID, @SKU_FG_100G_ID);

INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, CreatedAt, UpdatedAt, IsDeleted)
VALUES
  (@SKU_FG_50G_ID, @PROD_RM_TRA_NHAI_ID, 50.0000, @NOW, @NOW, 0),
  (@SKU_FG_50G_ID, @PROD_RM_TUI_ZIP_ID, 1.0000, @NOW, @NOW, 0),
  (@SKU_FG_50G_ID, @PROD_RM_HOP_GIAY_ID, 1.0000, @NOW, @NOW, 0),
  (@SKU_FG_50G_ID, @PROD_RM_TEM_NHAN_ID, 1.0000, @NOW, @NOW, 0),
  (@SKU_FG_100G_ID, @PROD_RM_TRA_NHAI_ID, 100.0000, @NOW, @NOW, 0),
  (@SKU_FG_100G_ID, @PROD_RM_TUI_ZIP_ID, 1.0000, @NOW, @NOW, 0),
  (@SKU_FG_100G_ID, @PROD_RM_HOP_GIAY_ID, 1.0000, @NOW, @NOW, 0),
  (@SKU_FG_100G_ID, @PROD_RM_TEM_NHAN_ID, 1.0000, @NOW, @NOW, 0);

-- -----------------------------------------------------------------------------
-- Inventory DB - central warehouse raw material stock only
-- -----------------------------------------------------------------------------
USE `hvt_inventory_db`;

INSERT INTO SkuStocks
  (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand,
   LowStockThreshold, CreatedAt, UpdatedAt)
VALUES
  (@SKU_RM_TRA_NHAI_ID, 'RM-TRA-NHAI-G', 1, 0, 10000, 1000, @NOW, @NOW),
  (@SKU_RM_TUI_ZIP_ID, 'RM-TUI-ZIP', 0, 0, 500, 50, @NOW, @NOW),
  (@SKU_RM_HOP_GIAY_ID, 'RM-HOP-GIAY', 0, 0, 500, 50, @NOW, @NOW),
  (@SKU_RM_TEM_NHAN_ID, 'RM-TEM-NHAN', 0, 0, 500, 50, @NOW, @NOW),
  (@SKU_FG_50G_ID, 'FG-TRA-NHAI-50G', 50, 0, 0, 0, @NOW, @NOW),
  (@SKU_FG_100G_ID, 'FG-TRA-NHAI-100G', 100, 0, 0, 0, @NOW, @NOW)
ON DUPLICATE KEY UPDATE
  SkuCode = VALUES(SkuCode),
  WeightInGrams = VALUES(WeightInGrams),
  QuantityOnHand = VALUES(QuantityOnHand),
  WarehouseQuantityOnHand = VALUES(WarehouseQuantityOnHand),
  LowStockThreshold = VALUES(LowStockThreshold),
  UpdatedAt = @NOW;

SET @BATCH_RAW_ID = '33333333-2501-4000-8000-000000000001';

INSERT INTO WarehouseBatches
  (Id, LotCode, Supplier, ExpiresAt, Note, Status, CreatedBy, CreatedAt, UpdatedAt)
VALUES
  (@BATCH_RAW_ID, 'MTS-DEMO-RM-001', @BATCH_SUPPLIER, NULL, @BATCH_NOTE, 'active', @ZERO_USER_ID, @NOW, @NOW)
ON DUPLICATE KEY UPDATE
  Supplier = VALUES(Supplier),
  ExpiresAt = VALUES(ExpiresAt),
  Note = VALUES(Note),
  Status = 'active',
  UpdatedAt = @NOW;

SET @BATCH_RAW_ID = (SELECT Id FROM WarehouseBatches WHERE LotCode = 'MTS-DEMO-RM-001' LIMIT 1);

INSERT INTO WarehouseBatchItems
  (Id, WarehouseBatchId, SkuId, SkuCode, ProductSnapshotName, QuantityOnHand,
   InitialQuantity, UnitCost, CreatedAt, UpdatedAt)
VALUES
  ('33333333-2501-4000-8000-000000000101', @BATCH_RAW_ID, @SKU_RM_TRA_NHAI_ID, 'RM-TRA-NHAI-G', @RM_TRA_NHAI_NAME, 10000, 10000, 0.20, @NOW, @NOW),
  ('33333333-2501-4000-8000-000000000102', @BATCH_RAW_ID, @SKU_RM_TUI_ZIP_ID, 'RM-TUI-ZIP', @RM_TUI_ZIP_NAME, 500, 500, 500.00, @NOW, @NOW),
  ('33333333-2501-4000-8000-000000000103', @BATCH_RAW_ID, @SKU_RM_HOP_GIAY_ID, 'RM-HOP-GIAY', @RM_HOP_GIAY_NAME, 500, 500, 1200.00, @NOW, @NOW),
  ('33333333-2501-4000-8000-000000000104', @BATCH_RAW_ID, @SKU_RM_TEM_NHAN_ID, 'RM-TEM-NHAN', @RM_TEM_NHAN_NAME, 500, 500, 200.00, @NOW, @NOW)
ON DUPLICATE KEY UPDATE
  SkuCode = VALUES(SkuCode),
  ProductSnapshotName = VALUES(ProductSnapshotName),
  QuantityOnHand = VALUES(QuantityOnHand),
  InitialQuantity = VALUES(InitialQuantity),
  UnitCost = VALUES(UnitCost),
  UpdatedAt = @NOW;

-- =============================================================================
-- Optional verification queries
-- =============================================================================
-- USE `hvt_product_db`;
-- SELECT v.SkuCode, p.Name AS ProductName, p.ProductType, v.VariantName, v.IsActive, v.IsSellable
-- FROM ProductVariants v
-- JOIN Products p ON p.Id = v.ProductId
-- WHERE v.SkuCode IN ('RM-TRA-NHAI-G', 'RM-TUI-ZIP', 'RM-HOP-GIAY', 'RM-TEM-NHAN')
-- ORDER BY v.SkuCode;
--
-- SELECT v.SkuCode, p.Name AS ProductName, p.ProductType, v.VariantName, v.WeightInGrams, v.IsActive, v.IsSellable
-- FROM ProductVariants v
-- JOIN Products p ON p.Id = v.ProductId
-- WHERE v.SkuCode IN ('FG-TRA-NHAI-50G', 'FG-TRA-NHAI-100G')
-- ORDER BY v.SkuCode;
--
-- SELECT fg.SkuCode AS FinishedSkuCode, material.Name AS MaterialProductName, rm.SkuCode AS MaterialSkuCode, b.Quantity
-- FROM ProductVariantBomLines b
-- JOIN ProductVariants fg ON fg.Id = b.ProductVariantId
-- JOIN Products material ON material.Id = b.MaterialId
-- LEFT JOIN ProductVariants rm ON rm.ProductId = material.Id AND rm.IsDeleted = 0
-- WHERE fg.SkuCode IN ('FG-TRA-NHAI-50G', 'FG-TRA-NHAI-100G') AND b.IsDeleted = 0
-- ORDER BY fg.SkuCode, rm.SkuCode;
--
-- USE `hvt_inventory_db`;
-- SELECT SkuCode, QuantityOnHand AS StoreQty, WarehouseQuantityOnHand AS CentralWarehouseQty
-- FROM SkuStocks
-- WHERE SkuCode IN ('RM-TRA-NHAI-G', 'RM-TUI-ZIP', 'RM-HOP-GIAY', 'RM-TEM-NHAN', 'FG-TRA-NHAI-50G', 'FG-TRA-NHAI-100G')
-- ORDER BY SkuCode;
--
-- SELECT b.LotCode, i.SkuCode, i.QuantityOnHand, i.InitialQuantity
-- FROM WarehouseBatches b
-- JOIN WarehouseBatchItems i ON i.WarehouseBatchId = b.Id
-- WHERE b.LotCode = 'MTS-DEMO-RM-001'
-- ORDER BY i.SkuCode;
--
-- SELECT s.SkuCode, COALESCE(SUM(i.QuantityOnHand), 0) AS FinishedWarehouseBatchQty
-- FROM SkuStocks s
-- LEFT JOIN WarehouseBatchItems i ON i.SkuId = s.SkuId
-- WHERE s.SkuCode IN ('FG-TRA-NHAI-50G', 'FG-TRA-NHAI-100G')
-- GROUP BY s.SkuCode
-- ORDER BY s.SkuCode;
