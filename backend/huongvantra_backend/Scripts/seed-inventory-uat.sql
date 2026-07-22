-- =============================================================================
-- HVTPOSIMS - Inventory Completion UAT Seed Data
-- Target: latest source after Batch 10 (HEAD b65c2a1)
-- Safe scope: only UAT-SEED-* master/stock rows, two Warehouse test users,
--             and one UAT customer. Existing business data is not deleted.
--
-- IMPORTANT
-- - Run only after ProductService/InventoryService/UserService migrations are applied.
-- - This script resets ONLY the UAT-SEED-* stock/batch rows to the baseline below.
-- - Do not run while a UAT transaction is being submitted/approved.
-- - Product Creation Request tests must use the reserved UAT-CR-* codes, which this
--   script intentionally does NOT create.
-- =============================================================================

SET NAMES utf8mb4;
SET @NOW = UTC_TIMESTAMP(6);
USE `hvt_user_db`;

-- =============================================================================
-- 0. PRECONDITION CHECKS
-- =============================================================================

DROP PROCEDURE IF EXISTS hvt_seed_inventory_uat_assert;
DELIMITER $$
CREATE PROCEDURE hvt_seed_inventory_uat_assert()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM hvt_product_db.__EFMigrationsHistory
        WHERE MigrationId = '20260717100000_AddInventoryUnitToProducts'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Missing ProductService Batch 1 migration. Start/rebuild ProductService before seeding.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM hvt_inventory_db.__EFMigrationsHistory
        WHERE MigrationId = '20260717170000_AddStocktakeRequests'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Missing InventoryService Batch 8 migration. Start/rebuild InventoryService before seeding.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM hvt_user_db.Roles
        WHERE RoleName = 'Warehouse' AND IsDeleted = 0
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Warehouse role is missing. Restart UserService first.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM hvt_user_db.Users
        WHERE Username IN ('admin', 'manager01') AND IsDeleted = 0
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Default admin/manager01 users are missing. Restart UserService first.';
    END IF;
END$$
DELIMITER ;
CALL hvt_seed_inventory_uat_assert();
DROP PROCEDURE hvt_seed_inventory_uat_assert;

-- =============================================================================
-- 1. USER DB - TEST ACCOUNTS
-- PasswordHash is copied from manager01, so the Warehouse accounts use the same
-- current password as manager01. In the default project seed this password is 123456.
-- =============================================================================

USE `hvt_user_db`;

SET @WAREHOUSE_ROLE_ID = (
    SELECT Id FROM Roles
    WHERE RoleName = 'Warehouse' AND IsDeleted = 0
    LIMIT 1
);
SET @DEMO_PASSWORD_HASH = (
    SELECT PasswordHash FROM Users
    WHERE Username = 'manager01' AND IsDeleted = 0
    LIMIT 1
);

SET @WAREHOUSE_01_ID = '75000000-0000-4000-8000-000000000001';
SET @WAREHOUSE_02_ID = '75000000-0000-4000-8000-000000000002';

INSERT INTO Users
    (Id, Username, PasswordHash, IsActive, LastLoginAt, CreatedAt, UpdatedAt, IsDeleted)
VALUES
    (@WAREHOUSE_01_ID, 'warehouse01', @DEMO_PASSWORD_HASH, 1, NULL, @NOW, @NOW, 0),
    (@WAREHOUSE_02_ID, 'warehouse02', @DEMO_PASSWORD_HASH, 1, NULL, @NOW, @NOW, 0)
ON DUPLICATE KEY UPDATE
    PasswordHash = VALUES(PasswordHash),
    IsActive = 1,
    UpdatedAt = @NOW,
    IsDeleted = 0;

-- Resolve real IDs by username in case local UAT users already existed with other GUIDs.
SET @WAREHOUSE_01_ID = (SELECT Id FROM Users WHERE Username = 'warehouse01' LIMIT 1);
SET @WAREHOUSE_02_ID = (SELECT Id FROM Users WHERE Username = 'warehouse02' LIMIT 1);

INSERT INTO UserRoles (UserId, RoleId)
VALUES
    (@WAREHOUSE_01_ID, @WAREHOUSE_ROLE_ID),
    (@WAREHOUSE_02_ID, @WAREHOUSE_ROLE_ID)
ON DUPLICATE KEY UPDATE RoleId = VALUES(RoleId);

INSERT INTO Employees
    (UserId, FullName, Department, ActualSalary, BankAccountInfo, Status, CreatedAt, UpdatedAt, IsDeleted)
SELECT @WAREHOUSE_01_ID, 'Warehouse UAT 01', 'Inventory UAT', 0, NULL, 'Active', @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Employees WHERE UserId = @WAREHOUSE_01_ID);

INSERT INTO Employees
    (UserId, FullName, Department, ActualSalary, BankAccountInfo, Status, CreatedAt, UpdatedAt, IsDeleted)
SELECT @WAREHOUSE_02_ID, 'Warehouse UAT 02', 'Inventory UAT', 0, NULL, 'Active', @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Employees WHERE UserId = @WAREHOUSE_02_ID);

UPDATE Employees
SET FullName = 'Warehouse UAT 01', Department = 'Inventory UAT', Status = 'Active', UpdatedAt = @NOW, IsDeleted = 0
WHERE UserId = @WAREHOUSE_01_ID;

UPDATE Employees
SET FullName = 'Warehouse UAT 02', Department = 'Inventory UAT', Status = 'Active', UpdatedAt = @NOW, IsDeleted = 0
WHERE UserId = @WAREHOUSE_02_ID;

-- Existing default actors used by the UAT plan.
SET @ADMIN_ID = (SELECT Id FROM Users WHERE Username = 'admin' AND IsDeleted = 0 LIMIT 1);
SET @MANAGER_ID = (SELECT Id FROM Users WHERE Username = 'manager01' AND IsDeleted = 0 LIMIT 1);
SET @SALE_ID = (SELECT Id FROM Users WHERE Username = 'sale01' AND IsDeleted = 0 LIMIT 1);

-- =============================================================================
-- 2. PRODUCT DB - UAT CATEGORIES / PRODUCTS / SKUS / BOM
-- =============================================================================

USE `hvt_product_db`;

SET @CAT_RAW_ID = 9701;
SET @CAT_PACKAGING_ID = 9702;
SET @CAT_FINISHED_ID = 9703;

INSERT INTO Categories
    (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
VALUES
    (@CAT_RAW_ID, 'UAT - Nguyên liệu', 'Dữ liệu nền kiểm thử nghiệp vụ Kho', NULL, 1, @NOW, @NOW, @NOW, 0),
    (@CAT_PACKAGING_ID, 'UAT - Bao bì', 'Dữ liệu nền kiểm thử Bao bì và BOM', NULL, 1, @NOW, @NOW, @NOW, 0),
    (@CAT_FINISHED_ID, 'UAT - Sản phẩm kệ', 'Dữ liệu nền kiểm thử POS và sản xuất', NULL, 1, @NOW, @NOW, @NOW, 0)
ON DUPLICATE KEY UPDATE
    Name = VALUES(Name),
    Description = VALUES(Description),
    IsActive = 1,
    SyncedToStoreAt = @NOW,
    UpdatedAt = @NOW,
    IsDeleted = 0;

SET @PROD_RAW_TEA_ID = '71000000-0000-4000-8000-000000000001';
SET @PROD_PKG_BAG_ID = '71000000-0000-4000-8000-000000000002';
SET @PROD_PKG_BOX_ID = '71000000-0000-4000-8000-000000000003';
SET @PROD_FG_100_ID = '71000000-0000-4000-8000-000000000004';
SET @PROD_FG_200_ID = '71000000-0000-4000-8000-000000000005';
SET @PROD_DELETE_ID = '71000000-0000-4000-8000-000000000006';

INSERT INTO Products
    (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description,
     BaseUnit, InventoryUnit, WeightValue, WeightUnit, IsVariantParent, IsActive,
     SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
VALUES
    (@PROD_RAW_TEA_ID, @CAT_RAW_ID, 'NGUYEN_LIEU', 'Trà nguyên liệu UAT Seed', 'Việt Nam', NULL, NULL,
     'Nguyên liệu cân đo theo gram; được phép bán trực tiếp tại POS khi có tồn Kệ Hàng.',
     'g', 'Gram', 1.0000, 'g', 0, 1, @NOW, @NOW, @NOW, 0),
    (@PROD_PKG_BAG_ID, @CAT_PACKAGING_ID, 'BAO_BI', 'Túi đóng gói UAT Seed', NULL, NULL, NULL,
     'Bao bì tính theo chiếc, dùng trong BOM.',
     'cái', 'Piece', 1.0000, 'cái', 0, 1, @NOW, @NOW, @NOW, 0),
    (@PROD_PKG_BOX_ID, @CAT_PACKAGING_ID, 'BAO_BI', 'Hộp giấy UAT Seed', NULL, NULL, NULL,
     'Bao bì hộp giấy tính theo chiếc, dùng trong BOM.',
     'cái', 'Piece', 1.0000, 'cái', 0, 1, @NOW, @NOW, @NOW, 0),
    (@PROD_FG_100_ID, @CAT_FINISHED_ID, 'THANH_PHAM', 'Trà hộp 100g UAT Seed', 'Việt Nam', NULL, NULL,
     'Sản phẩm kệ 100g dùng kiểm thử POS, replenishment, return và production.',
     'hộp', 'Piece', NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0),
    (@PROD_FG_200_ID, @CAT_FINISHED_ID, 'THANH_PHAM', 'Trà hộp 200g UAT Seed', 'Việt Nam', NULL, NULL,
     'Sản phẩm kệ 200g không có tồn đầu kỳ, dùng kiểm thử sell-first và production.',
     'hộp', 'Piece', NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0),
    (@PROD_DELETE_ID, @CAT_FINISHED_ID, 'THANH_PHAM', 'Sản phẩm xóa an toàn UAT Seed', NULL, NULL, NULL,
     'Không tồn, không BOM, dùng kiểm thử Product Deletion Request thành công.',
     'cái', 'Piece', NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0)
ON DUPLICATE KEY UPDATE
    CategoryId = VALUES(CategoryId),
    ProductType = VALUES(ProductType),
    Name = VALUES(Name),
    Origin = VALUES(Origin),
    Description = VALUES(Description),
    BaseUnit = VALUES(BaseUnit),
    InventoryUnit = VALUES(InventoryUnit),
    WeightValue = VALUES(WeightValue),
    WeightUnit = VALUES(WeightUnit),
    IsVariantParent = VALUES(IsVariantParent),
    IsActive = 1,
    SyncedToStoreAt = @NOW,
    UpdatedAt = @NOW,
    IsDeleted = 0;

SET @SKU_RAW_TEA_ID = '72000000-0000-4000-8000-000000000001';
SET @SKU_PKG_BAG_ID = '72000000-0000-4000-8000-000000000002';
SET @SKU_PKG_BOX_ID = '72000000-0000-4000-8000-000000000003';
SET @SKU_FG_100_ID = '72000000-0000-4000-8000-000000000004';
SET @SKU_FG_200_ID = '72000000-0000-4000-8000-000000000005';
SET @SKU_DELETE_ID = '72000000-0000-4000-8000-000000000006';

INSERT INTO ProductVariants
    (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice,
     MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams,
     SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
VALUES
    (@SKU_RAW_TEA_ID, @PROD_RAW_TEA_ID, 'UAT-SEED-RAW-TEA', '8990000019011', 'Theo gram', '{"unit":"gram"}', 180.00, 300.00,
     1000, 30000, 1, 0, 1, NULL, 1, @NOW, @NOW, @NOW, 0),
    (@SKU_PKG_BAG_ID, @PROD_PKG_BAG_ID, 'UAT-SEED-PKG-BAG', '8990000019028', 'Theo chiếc', '{"unit":"piece"}', 500.00, 0.00,
     50, 2000, 0, 0, 1, NULL, 0, @NOW, @NOW, @NOW, 0),
    (@SKU_PKG_BOX_ID, @PROD_PKG_BOX_ID, 'UAT-SEED-PKG-BOX', '8990000019035', 'Theo chiếc', '{"unit":"piece"}', 1200.00, 0.00,
     20, 1000, 0, 0, 1, NULL, 0, @NOW, @NOW, @NOW, 0),
    (@SKU_FG_100_ID, @PROD_FG_100_ID, 'UAT-SEED-FG-100', '8990000019042', 'Hộp 100g', '{"weight":"100g"}', 30000.00, 50000.00,
     5, 200, 1, 1, 1, NULL, 100, @NOW, @NOW, @NOW, 0),
    (@SKU_FG_200_ID, @PROD_FG_200_ID, 'UAT-SEED-FG-200', '8990000019059', 'Hộp 200g', '{"weight":"200g"}', 55000.00, 90000.00,
     5, 200, 1, 1, 1, NULL, 200, @NOW, @NOW, @NOW, 0),
    (@SKU_DELETE_ID, @PROD_DELETE_ID, 'UAT-SEED-DELETE', '8990000019066', 'Mặc định', '{}', 1000.00, 5000.00,
     0, 10, 0, 0, 1, NULL, 0, @NOW, @NOW, @NOW, 0)
ON DUPLICATE KEY UPDATE
    ProductId = VALUES(ProductId),
    Barcode = VALUES(Barcode),
    VariantName = VALUES(VariantName),
    OptionValuesJson = VALUES(OptionValuesJson),
    CostPrice = VALUES(CostPrice),
    RetailPrice = VALUES(RetailPrice),
    MinStock = VALUES(MinStock),
    MaxStock = VALUES(MaxStock),
    IsSellable = VALUES(IsSellable),
    AllowRewardPoints = VALUES(AllowRewardPoints),
    IsActive = 1,
    WeightInGrams = VALUES(WeightInGrams),
    SyncedToStoreAt = @NOW,
    UpdatedAt = @NOW,
    IsDeleted = 0;

-- Always resolve the real IDs by SKU code in case an earlier local row used another Id.
SET @SKU_RAW_TEA_ID = (SELECT Id FROM ProductVariants WHERE SkuCode = 'UAT-SEED-RAW-TEA' LIMIT 1);
SET @SKU_PKG_BAG_ID = (SELECT Id FROM ProductVariants WHERE SkuCode = 'UAT-SEED-PKG-BAG' LIMIT 1);
SET @SKU_PKG_BOX_ID = (SELECT Id FROM ProductVariants WHERE SkuCode = 'UAT-SEED-PKG-BOX' LIMIT 1);
SET @SKU_FG_100_ID = (SELECT Id FROM ProductVariants WHERE SkuCode = 'UAT-SEED-FG-100' LIMIT 1);
SET @SKU_FG_200_ID = (SELECT Id FROM ProductVariants WHERE SkuCode = 'UAT-SEED-FG-200' LIMIT 1);
SET @SKU_DELETE_ID = (SELECT Id FROM ProductVariants WHERE SkuCode = 'UAT-SEED-DELETE' LIMIT 1);

DELETE FROM ProductVariantBomLines
WHERE ProductVariantId IN (@SKU_FG_100_ID, @SKU_FG_200_ID);

INSERT INTO ProductVariantBomLines
    (ProductVariantId, MaterialId, Quantity, CreatedAt, UpdatedAt, IsDeleted)
VALUES
    (@SKU_FG_100_ID, @PROD_RAW_TEA_ID, 100.0000, @NOW, @NOW, 0),
    (@SKU_FG_100_ID, @PROD_PKG_BAG_ID, 1.0000, @NOW, @NOW, 0),
    (@SKU_FG_100_ID, @PROD_PKG_BOX_ID, 1.0000, @NOW, @NOW, 0),
    (@SKU_FG_200_ID, @PROD_RAW_TEA_ID, 200.0000, @NOW, @NOW, 0),
    (@SKU_FG_200_ID, @PROD_PKG_BAG_ID, 2.0000, @NOW, @NOW, 0),
    (@SKU_FG_200_ID, @PROD_PKG_BOX_ID, 1.0000, @NOW, @NOW, 0);

-- =============================================================================
-- 3. INVENTORY DB - KNOWN BASELINE STOCK + FEFO BATCHES
-- =============================================================================

USE `hvt_inventory_db`;

INSERT INTO SkuStocks
    (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand,
     LowStockThreshold, WarehouseLowStockThreshold, ShelfLowStockThreshold,
     CreatedAt, UpdatedAt)
VALUES
    (@SKU_RAW_TEA_ID, 'UAT-SEED-RAW-TEA', 1, 500, 10000, 200, 2000, 200, @NOW, @NOW),
    (@SKU_PKG_BAG_ID, 'UAT-SEED-PKG-BAG', 0, 20, 500, 10, 100, 10, @NOW, @NOW),
    (@SKU_PKG_BOX_ID, 'UAT-SEED-PKG-BOX', 0, 10, 200, 5, 50, 5, @NOW, @NOW),
    (@SKU_FG_100_ID, 'UAT-SEED-FG-100', 100, 10, 20, 5, 5, 5, @NOW, @NOW),
    (@SKU_FG_200_ID, 'UAT-SEED-FG-200', 200, 0, 0, 5, 5, 5, @NOW, @NOW),
    (@SKU_DELETE_ID, 'UAT-SEED-DELETE', 0, 0, 0, 0, 0, 0, @NOW, @NOW)
ON DUPLICATE KEY UPDATE
    SkuCode = VALUES(SkuCode),
    WeightInGrams = VALUES(WeightInGrams),
    QuantityOnHand = VALUES(QuantityOnHand),
    WarehouseQuantityOnHand = VALUES(WarehouseQuantityOnHand),
    LowStockThreshold = VALUES(LowStockThreshold),
    WarehouseLowStockThreshold = VALUES(WarehouseLowStockThreshold),
    ShelfLowStockThreshold = VALUES(ShelfLowStockThreshold),
    UpdatedAt = @NOW;

-- Stable batch IDs.
SET @BATCH_RAW_W1 = '73000000-0000-4000-8000-000000000001';
SET @BATCH_RAW_W2 = '73000000-0000-4000-8000-000000000002';
SET @BATCH_RAW_S1 = '73000000-0000-4000-8000-000000000003';
SET @BATCH_BAG_W1 = '73000000-0000-4000-8000-000000000004';
SET @BATCH_BAG_S1 = '73000000-0000-4000-8000-000000000005';
SET @BATCH_BOX_W1 = '73000000-0000-4000-8000-000000000006';
SET @BATCH_BOX_S1 = '73000000-0000-4000-8000-000000000007';
SET @BATCH_FG100_W1 = '73000000-0000-4000-8000-000000000008';
SET @BATCH_FG100_S1 = '73000000-0000-4000-8000-000000000009';

INSERT INTO WarehouseBatches
    (Id, LotCode, Supplier, ExpiresAt, Note, SourceType, SourceReferenceId,
     SourceReferenceCode, Location, ParentBatchId, SourceBatchId, Status,
     CreatedBy, CreatedAt, UpdatedAt)
VALUES
    (@BATCH_RAW_W1, 'UAT-RAW-W-EXP-001', 'Nhà cung cấp UAT', '2026-12-31 00:00:00', 'Lô FEFO hết hạn trước', 'uat_seed', NULL,
     'UAT-SEED-BASELINE', 'Warehouse', NULL, NULL, 'active', @WAREHOUSE_01_ID, @NOW, @NOW),
    (@BATCH_RAW_W2, 'UAT-RAW-W-EXP-002', 'Nhà cung cấp UAT', '2027-06-30 00:00:00', 'Lô FEFO hết hạn sau', 'uat_seed', NULL,
     'UAT-SEED-BASELINE', 'Warehouse', NULL, NULL, 'active', @WAREHOUSE_01_ID, @NOW, @NOW),
    (@BATCH_RAW_S1, 'UAT-RAW-S-001', 'Điều chuyển UAT', '2026-12-31 00:00:00', 'Tồn Kệ Hàng có lineage', 'uat_seed_transfer', @BATCH_RAW_W1,
     'UAT-SEED-BASELINE', 'Shelf', @BATCH_RAW_W1, @BATCH_RAW_W1, 'active', @WAREHOUSE_01_ID, @NOW, @NOW),
    (@BATCH_BAG_W1, 'UAT-BAG-W-001', 'Nhà cung cấp UAT', '2028-12-31 00:00:00', 'Bao bì tại Kho', 'uat_seed', NULL,
     'UAT-SEED-BASELINE', 'Warehouse', NULL, NULL, 'active', @WAREHOUSE_01_ID, @NOW, @NOW),
    (@BATCH_BAG_S1, 'UAT-BAG-S-001', 'Điều chuyển UAT', '2028-12-31 00:00:00', 'Bao bì tại Kệ Hàng', 'uat_seed_transfer', @BATCH_BAG_W1,
     'UAT-SEED-BASELINE', 'Shelf', @BATCH_BAG_W1, @BATCH_BAG_W1, 'active', @WAREHOUSE_01_ID, @NOW, @NOW),
    (@BATCH_BOX_W1, 'UAT-BOX-W-001', 'Nhà cung cấp UAT', '2028-12-31 00:00:00', 'Hộp giấy tại Kho', 'uat_seed', NULL,
     'UAT-SEED-BASELINE', 'Warehouse', NULL, NULL, 'active', @WAREHOUSE_01_ID, @NOW, @NOW),
    (@BATCH_BOX_S1, 'UAT-BOX-S-001', 'Điều chuyển UAT', '2028-12-31 00:00:00', 'Hộp giấy tại Kệ Hàng', 'uat_seed_transfer', @BATCH_BOX_W1,
     'UAT-SEED-BASELINE', 'Shelf', @BATCH_BOX_W1, @BATCH_BOX_W1, 'active', @WAREHOUSE_01_ID, @NOW, @NOW),
    (@BATCH_FG100_W1, 'UAT-FG100-W-001', 'Nhà cung cấp UAT', '2027-01-31 00:00:00', 'Sản phẩm kệ tại Kho', 'uat_seed', NULL,
     'UAT-SEED-BASELINE', 'Warehouse', NULL, NULL, 'active', @WAREHOUSE_01_ID, @NOW, @NOW),
    (@BATCH_FG100_S1, 'UAT-FG100-S-001', 'Điều chuyển UAT', '2027-01-31 00:00:00', 'Sản phẩm kệ tại Kệ Hàng', 'uat_seed_transfer', @BATCH_FG100_W1,
     'UAT-SEED-BASELINE', 'Shelf', @BATCH_FG100_W1, @BATCH_FG100_W1, 'active', @WAREHOUSE_01_ID, @NOW, @NOW)
ON DUPLICATE KEY UPDATE
    Supplier = VALUES(Supplier),
    ExpiresAt = VALUES(ExpiresAt),
    Note = VALUES(Note),
    SourceType = VALUES(SourceType),
    SourceReferenceId = VALUES(SourceReferenceId),
    SourceReferenceCode = VALUES(SourceReferenceCode),
    Location = VALUES(Location),
    ParentBatchId = VALUES(ParentBatchId),
    SourceBatchId = VALUES(SourceBatchId),
    Status = 'active',
    CreatedBy = VALUES(CreatedBy),
    UpdatedAt = @NOW;

INSERT INTO WarehouseBatchItems
    (Id, WarehouseBatchId, SkuId, SkuCode, ProductSnapshotName,
     QuantityOnHand, InitialQuantity, UnitCost, CreatedAt, UpdatedAt)
VALUES
    ('74000000-0000-4000-8000-000000000001', @BATCH_RAW_W1, @SKU_RAW_TEA_ID, 'UAT-SEED-RAW-TEA', 'Trà nguyên liệu UAT Seed', 6000, 6500, 180.00, @NOW, @NOW),
    ('74000000-0000-4000-8000-000000000002', @BATCH_RAW_W2, @SKU_RAW_TEA_ID, 'UAT-SEED-RAW-TEA', 'Trà nguyên liệu UAT Seed', 4000, 4000, 190.00, @NOW, @NOW),
    ('74000000-0000-4000-8000-000000000003', @BATCH_RAW_S1, @SKU_RAW_TEA_ID, 'UAT-SEED-RAW-TEA', 'Trà nguyên liệu UAT Seed', 500, 500, 180.00, @NOW, @NOW),
    ('74000000-0000-4000-8000-000000000004', @BATCH_BAG_W1, @SKU_PKG_BAG_ID, 'UAT-SEED-PKG-BAG', 'Túi đóng gói UAT Seed', 500, 520, 500.00, @NOW, @NOW),
    ('74000000-0000-4000-8000-000000000005', @BATCH_BAG_S1, @SKU_PKG_BAG_ID, 'UAT-SEED-PKG-BAG', 'Túi đóng gói UAT Seed', 20, 20, 500.00, @NOW, @NOW),
    ('74000000-0000-4000-8000-000000000006', @BATCH_BOX_W1, @SKU_PKG_BOX_ID, 'UAT-SEED-PKG-BOX', 'Hộp giấy UAT Seed', 200, 210, 1200.00, @NOW, @NOW),
    ('74000000-0000-4000-8000-000000000007', @BATCH_BOX_S1, @SKU_PKG_BOX_ID, 'UAT-SEED-PKG-BOX', 'Hộp giấy UAT Seed', 10, 10, 1200.00, @NOW, @NOW),
    ('74000000-0000-4000-8000-000000000008', @BATCH_FG100_W1, @SKU_FG_100_ID, 'UAT-SEED-FG-100', 'Trà hộp 100g UAT Seed', 20, 30, 30000.00, @NOW, @NOW),
    ('74000000-0000-4000-8000-000000000009', @BATCH_FG100_S1, @SKU_FG_100_ID, 'UAT-SEED-FG-100', 'Trà hộp 100g UAT Seed', 10, 10, 30000.00, @NOW, @NOW)
ON DUPLICATE KEY UPDATE
    WarehouseBatchId = VALUES(WarehouseBatchId),
    SkuId = VALUES(SkuId),
    SkuCode = VALUES(SkuCode),
    ProductSnapshotName = VALUES(ProductSnapshotName),
    QuantityOnHand = VALUES(QuantityOnHand),
    InitialQuantity = VALUES(InitialQuantity),
    UnitCost = VALUES(UnitCost),
    UpdatedAt = @NOW;

-- =============================================================================
-- 4. CUSTOMER DB - CUSTOMER FOR POS / RETURN UAT
-- =============================================================================

USE `hvt_customer_db`;

SET @UAT_CUSTOMER_ID = '76000000-0000-4000-8000-000000000001';
SET @MEMBER_TIER_ID = (
    SELECT Id FROM CustomerTiers
    WHERE TierName = 'Member' AND IsDeleted = 0
    LIMIT 1
);

INSERT INTO Customers
    (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode,
     TierId, TotalSpending, CurrentDebt, AssignedSaleId, Source, Department,
     CreatedAt, UpdatedAt, IsDeleted)
VALUES
    (@UAT_CUSTOMER_ID, 'KH-UAT-1907-001', 'Khách hàng UAT Kho', '0909001907', 'uat.inventory@example.local',
     'PhoThong', NULL, @MEMBER_TIER_ID, 0, 0, @SALE_ID, 'WalkIn', 'UAT', @NOW, @NOW, 0)
ON DUPLICATE KEY UPDATE
    FullName = VALUES(FullName),
    Email = VALUES(Email),
    CustomerGroup = VALUES(CustomerGroup),
    TierId = VALUES(TierId),
    TotalSpending = 0,
    CurrentDebt = 0,
    AssignedSaleId = VALUES(AssignedSaleId),
    Source = VALUES(Source),
    Department = VALUES(Department),
    UpdatedAt = @NOW,
    IsDeleted = 0;

-- =============================================================================
-- 5. VERIFICATION OUTPUT
-- =============================================================================

SELECT 'SEED_OK' AS Result,
       'Use http://localhost:5173 because docker-compose.dev.yml is active.' AS FrontendUrl;

SELECT u.Username, r.RoleName, u.IsActive, e.FullName
FROM hvt_user_db.Users u
JOIN hvt_user_db.UserRoles ur ON ur.UserId = u.Id
JOIN hvt_user_db.Roles r ON r.Id = ur.RoleId
LEFT JOIN hvt_user_db.Employees e ON e.UserId = u.Id
WHERE u.Username IN ('admin', 'manager01', 'sale01', 'warehouse01', 'warehouse02')
ORDER BY u.Username;

SELECT v.SkuCode, p.ProductType, p.InventoryUnit, v.IsSellable, v.RetailPrice
FROM hvt_product_db.ProductVariants v
JOIN hvt_product_db.Products p ON p.Id = v.ProductId
WHERE v.SkuCode LIKE 'UAT-SEED-%'
ORDER BY v.SkuCode;

SELECT s.SkuCode,
       s.WarehouseQuantityOnHand AS WarehouseQty,
       s.QuantityOnHand AS ShelfQty,
       s.WarehouseLowStockThreshold,
       s.ShelfLowStockThreshold
FROM hvt_inventory_db.SkuStocks s
WHERE s.SkuCode LIKE 'UAT-SEED-%'
ORDER BY s.SkuCode;

SELECT b.LotCode, b.Location, b.ExpiresAt, i.SkuCode,
       i.QuantityOnHand, i.InitialQuantity, i.UnitCost,
       b.SourceReferenceCode
FROM hvt_inventory_db.WarehouseBatches b
JOIN hvt_inventory_db.WarehouseBatchItems i ON i.WarehouseBatchId = b.Id
WHERE b.SourceReferenceCode = 'UAT-SEED-BASELINE'
ORDER BY i.SkuCode, b.Location, b.ExpiresAt;

SELECT CustomerCode, FullName, PhoneNumber, Source
FROM hvt_customer_db.Customers
WHERE CustomerCode = 'KH-UAT-1907-001';
