-- =============================================================================
-- HuongVanTra — Seed dữ liệu demo (idempotent)
-- Chạy SAU khi:
--   1. init-databases.sql + EF migrations đã apply
--   2. Các service đã start ít nhất 1 lần (seed tier + user admin/sale01)
--
-- Cách chạy (PowerShell — khuyến nghị):
--   Get-Content .\Scripts\seed-demo-data.sql -Raw | docker exec -i -e "MYSQL_PWD=$env:MYSQL_PASSWORD" hvt-mysql mysql -uhvtuser
--
-- Hoặc docker cp (giữ UTF-8):
--   docker cp .\Scripts\seed-demo-data.sql hvt-mysql:/tmp/seed-demo-data.sql
--   docker exec -e "MYSQL_PWD=$env:MYSQL_PASSWORD" hvt-mysql mysql -uhvtuser -e "source /tmp/seed-demo-data.sql"
--
-- Lưu ý: chuỗi tiếng Việt dùng biến @... = CONVERT(UNHEX(...) USING utf8mb4)
-- để tránh lỗi font (T??i 100g) khi pipe qua PowerShell.
-- Snapshot đơn hàng: "Họ tên · KH-DEMO-xxx"
--
-- Xóa demo để seed lại (tuỳ chọn, bỏ comment):
--   DELETE FROM hvt_order_db.ReturnOrderDetails WHERE ReturnOrderId IN (SELECT Id FROM hvt_order_db.ReturnOrders WHERE ReturnCode LIKE 'TH-DEMO-%');
--   DELETE FROM hvt_order_db.ReturnOrders WHERE ReturnCode LIKE 'TH-DEMO-%';
--   DELETE FROM hvt_order_db.OrderActivities WHERE OrderId IN (SELECT Id FROM hvt_order_db.Orders WHERE OrderCode LIKE 'HVT-DEMO-%');
--   DELETE FROM hvt_order_db.Payments WHERE OrderId IN (SELECT Id FROM hvt_order_db.Orders WHERE OrderCode LIKE 'HVT-DEMO-%');
--   DELETE FROM hvt_order_db.OrderDetails WHERE OrderId IN (SELECT Id FROM hvt_order_db.Orders WHERE OrderCode LIKE 'HVT-DEMO-%');
--   DELETE FROM hvt_order_db.Orders WHERE OrderCode LIKE 'HVT-DEMO-%';
--   DELETE FROM hvt_order_db.PromotionScopes WHERE PromotionId IN (SELECT Id FROM hvt_order_db.Promotions WHERE PromoCode LIKE 'DEMO%');
--   DELETE FROM hvt_order_db.Promotions WHERE PromoCode LIKE 'DEMO%';
--   DELETE FROM hvt_inventory_db.StockDeductQueueItems WHERE QueueId IN (SELECT Id FROM hvt_inventory_db.StockDeductQueues WHERE OrderCode LIKE 'HVT-DEMO-%');
--   DELETE FROM hvt_inventory_db.StockDeductQueues WHERE OrderCode LIKE 'HVT-DEMO-%';
--   DELETE FROM hvt_inventory_db.SkuStocks WHERE SkuCode LIKE 'SKU-DEMO-%';
--   DELETE FROM hvt_customer_db.CustomerAddresses WHERE CustomerId IN (SELECT Id FROM hvt_customer_db.Customers WHERE CustomerCode LIKE 'KH-DEMO-%');
--   DELETE FROM hvt_customer_db.Customers WHERE CustomerCode LIKE 'KH-DEMO-%';
--   DELETE FROM hvt_product_db.ProductVariants WHERE SkuCode LIKE 'SKU-DEMO-%';
--   DELETE FROM hvt_product_db.Products WHERE Id LIKE 'aaaaaaaa-%';
--   DELETE FROM hvt_product_db.Categories WHERE Id BETWEEN 9001 AND 9105;
-- =============================================================================

SET @NOW = UTC_TIMESTAMP(6);
SET @SALE_USER_ID = (
  SELECT u.Id FROM hvt_user_db.Users u
  WHERE u.Username = 'sale01' AND u.IsDeleted = 0
  LIMIT 1
);
SET @TIER_MEMBER = (SELECT Id FROM hvt_customer_db.CustomerTiers WHERE TierName = 'Member' LIMIT 1);
SET @TIER_SILVER = (SELECT Id FROM hvt_customer_db.CustomerTiers WHERE TierName = 'Silver' LIMIT 1);
SET @TIER_GOLD   = (SELECT Id FROM hvt_customer_db.CustomerTiers WHERE TierName = 'Gold' LIMIT 1);
-- Separator " · " (UTF-8 C2 B7)
SET @SNAP_SEP = CONCAT(' ', CONVERT(UNHEX('C2B7') USING utf8mb4), ' ');

-- Chuỗi tiếng Việt (UNHEX — an toàn khi pipe PowerShell)
SET @PKG_BAG_100 = CONVERT(UNHEX('54C3BA692031303067') USING utf8mb4);
SET @PKG_BAG_250 = CONVERT(UNHEX('54C3BA692032353067') USING utf8mb4);
SET @PKG_BAG_500 = CONVERT(UNHEX('54C3BA692035303067') USING utf8mb4);
SET @PKG_BAG_75 = CONVERT(UNHEX('54C3BA6920373567') USING utf8mb4);
SET @PKG_BAG_50 = CONVERT(UNHEX('54C3BA6920353067') USING utf8mb4);
SET @PKG_BAG_30 = CONVERT(UNHEX('54C3BA6920333067') USING utf8mb4);
SET @PKG_BAG_80 = CONVERT(UNHEX('54C3BA6920383067') USING utf8mb4);
SET @PKG_GIFT_BOX = CONVERT(UNHEX('48E1BB9970207175C3A0') USING utf8mb4);
SET @PKG_PIECE = CONVERT(UNHEX('43C3A169') USING utf8mb4);
SET @PKG_SET = CONVERT(UNHEX('42E1BB99') USING utf8mb4);
SET @UNIT_BAG = CONVERT(UNHEX('67C3B369') USING utf8mb4);
SET @UNIT_SET = CONVERT(UNHEX('736574') USING utf8mb4);
SET @UNIT_PIECE = CONVERT(UNHEX('63C3A169') USING utf8mb4);
SET @UNIT_KIT = CONVERT(UNHEX('62E1BB99') USING utf8mb4);
SET @CAT_TRA = CONVERT(UNHEX('5472C3A0') USING utf8mb4);
SET @CAT_QUA_TANG = CONVERT(UNHEX('5175C3A02074E1BAB76E67') USING utf8mb4);
SET @CAT_DUNG_CU = CONVERT(UNHEX('44E1BBA56E672063E1BBA520706861207472C3A0') USING utf8mb4);
SET @CAT_TRA_XANH = CONVERT(UNHEX('5472C3A02078616E68') USING utf8mb4);
SET @CAT_TRA_DEN = CONVERT(UNHEX('5472C3A020C491656E2026204F6F6C6F6E67') USING utf8mb4);
SET @CAT_TRA_THAO = CONVERT(UNHEX('5472C3A0207468E1BAA36F2064C6B0E1BBA363') USING utf8mb4);
SET @CAT_COMBO = CONVERT(UNHEX('436F6D626F207175C3A02074E1BAB76E67') USING utf8mb4);
SET @CAT_AM_LY = CONVERT(UNHEX('E1BAA46D2026206C79') USING utf8mb4);
SET @CAT_DESC_TRA = CONVERT(UNHEX('43C3A163206C6FE1BAA169207472C3A02062C3A16E206CE1BABB') USING utf8mb4);
SET @CAT_DESC_QUA = CONVERT(UNHEX('436F6D626F2C2068E1BB9970207175C3A0') USING utf8mb4);
SET @CAT_DESC_DUNG_CU = CONVERT(UNHEX('E1BAA46D2C206C792C207068E1BBA5206B69E1BB876E') USING utf8mb4);
SET @CAT_DESC_TRA_XANH = CONVERT(UNHEX('5472C3A02078616E682063C3A1632076C3B96E67206D69E1BB816E') USING utf8mb4);
SET @CAT_DESC_TRA_DEN = CONVERT(UNHEX('5472C3A020C491656E2C2068E1BB936E67207472C3A02C206F6F6C6F6E67') USING utf8mb4);
SET @CAT_DESC_TRA_THAO = CONVERT(UNHEX('486F61207175E1BAA32C207468E1BAA36F206DE1BB9963') USING utf8mb4);
SET @CAT_DESC_COMBO = CONVERT(UNHEX('48E1BB9970207175C3A02C2073657420636F6D626F') USING utf8mb4);
SET @CAT_DESC_AM_LY = CONVERT(UNHEX('E1BAA46D207472C3A02C2062E1BB99206C792073E1BBA9') USING utf8mb4);
SET @CUST_001 = CONVERT(UNHEX('4E677579E1BB856E205468E1BB8B204C616E') USING utf8mb4);
SET @CUST_002 = CONVERT(UNHEX('5472E1BAA76E2056C4836E204D696E68') USING utf8mb4);
SET @CUST_003 = CONVERT(UNHEX('4CC3AA20486FC3A06E6720416E68') USING utf8mb4);
SET @CUST_004 = CONVERT(UNHEX('5068E1BAA16D205468752048C3A0') USING utf8mb4);
SET @CUST_005 = CONVERT(UNHEX('486FC3A06E67205175E1BB91632042E1BAA36F') USING utf8mb4);
SET @CUST_006 = CONVERT(UNHEX('56C5A9205468E1BB8B204D6169') USING utf8mb4);
SET @CUST_007 = CONVERT(UNHEX('C490E1BB972056C4836E204B69C3AA6E') USING utf8mb4);
SET @CUST_008 = CONVERT(UNHEX('42C3B969205468616E682054C3A26D') USING utf8mb4);
SET @CUST_009 = CONVERT(UNHEX('4E67C3B42047696120487579') USING utf8mb4);
SET @CUST_010 = CONVERT(UNHEX('4CC3BD205068C6B0C6A16E6720436869') USING utf8mb4);
SET @PROD_001 = CONVERT(UNHEX('5472C3A0205368616E20547579E1BABF74204CC3A06F20436169') USING utf8mb4);
SET @PROD_002 = CONVERT(UNHEX('5472C3A0204CC3A069205468C3A169204E677579C3AA6E') USING utf8mb4);
SET @PROD_003 = CONVERT(UNHEX('5472C3A02042C3BA70204CE1BB996E67205875C3A26E') USING utf8mb4);
SET @PROD_004 = CONVERT(UNHEX('5472C3A020C490656E2043E1BB95205468E1BBA52059756E6E616E') USING utf8mb4);
SET @PROD_005 = CONVERT(UNHEX('48E1BB936E67205472C3A020C490C3A069204C6F616E') USING utf8mb4);
SET @PROD_006 = CONVERT(UNHEX('5472C3A020417469736F20C490C3A0204CE1BAA174') USING utf8mb4);
SET @PROD_007 = CONVERT(UNHEX('5472C3A020486F612043C3BA63') USING utf8mb4);
SET @PROD_008 = CONVERT(UNHEX('5472C3A02047E1BBAB6E67204DE1BAAD74204F6E67') USING utf8mb4);
SET @PROD_009 = CONVERT(UNHEX('436F6D626F2054E1BABF7420416E204B68616E67') USING utf8mb4);
SET @PROD_010 = CONVERT(UNHEX('436F6D626F205472C3A020436869E1BB8175') USING utf8mb4);
SET @PROD_011 = CONVERT(UNHEX('E1BAA46D2073E1BBA9207472E1BAAF6E67203135306D6C') USING utf8mb4);
SET @PROD_012 = CONVERT(UNHEX('42E1BB99206C792073E1BBA9203620636869E1BABF63') USING utf8mb4);
SET @ORIG_001 = CONVERT(UNHEX('4CC3A06F20436169') USING utf8mb4);
SET @ORIG_002 = CONVERT(UNHEX('5468C3A169204E677579C3AA6E') USING utf8mb4);
SET @ORIG_003 = CONVERT(UNHEX('42E1BAA36F204CE1BB9963') USING utf8mb4);
SET @ORIG_004 = CONVERT(UNHEX('56C3A26E204E616D') USING utf8mb4);
SET @ORIG_005 = CONVERT(UNHEX('C490C3A069204C6F616E') USING utf8mb4);
SET @ORIG_006 = CONVERT(UNHEX('4CC3A26D20C490E1BB936E67') USING utf8mb4);
SET @ORIG_007 = CONVERT(UNHEX('48C3A0204EE1BB9969') USING utf8mb4);
SET @ORIG_008 = CONVERT(UNHEX('5669E1BB8774204E616D') USING utf8mb4);
SET @FLAV_001 = CONVERT(UNHEX('4E67E1BB8D742C2068C6B0C6A16E6720686F61') USING utf8mb4);
SET @FLAV_002 = CONVERT(UNHEX('5468C6A16D206CC3A069') USING utf8mb4);
SET @FLAV_003 = CONVERT(UNHEX('5468616E68206DC3A174') USING utf8mb4);
SET @FLAV_004 = CONVERT(UNHEX('C490E1BAAD6D2C206E67E1BB8D742068E1BAAD75') USING utf8mb4);
SET @FLAV_005 = CONVERT(UNHEX('4E67E1BB8D742C20686F61207175E1BAA3') USING utf8mb4);
SET @FLAV_006 = CONVERT(UNHEX('C490E1BAAF6E67206E68E1BAB9') USING utf8mb4);
SET @FLAV_007 = CONVERT(UNHEX('48C6B0C6A16E6720686F61') USING utf8mb4);
SET @FLAV_008 = CONVERT(UNHEX('E1BAA46D2C20636179206E68E1BAB9') USING utf8mb4);
SET @FLAV_009 = CONVERT(UNHEX('C490612064E1BAA16E67') USING utf8mb4);
SET @FLAV_010 = CONVERT(UNHEX('4E68E1BAB9206E68C3A06E67') USING utf8mb4);
SET @DESC_001 = CONVERT(UNHEX('5472C3A02078616E682063616F2063E1BAA5702076C3B96E67206EC3BA69') USING utf8mb4);
SET @DESC_002 = CONVERT(UNHEX('5472C3A02078616E6820C6B0E1BB9B7020686F61206E68C3A069') USING utf8mb4);
SET @DESC_003 = CONVERT(UNHEX('42C3BA70206E6F6E20C491E1BAA7752076E1BBA5') USING utf8mb4);
SET @DESC_004 = CONVERT(UNHEX('5472C3A020C491656E206CC3AA6E206D656E') USING utf8mb4);
SET @DESC_005 = CONVERT(UNHEX('4F6F6C6F6E67206E68E1BAB9') USING utf8mb4);
SET @DESC_006 = CONVERT(UNHEX('48E1BB97207472E1BBA3207469C3AA7520686FC3A1') USING utf8mb4);
SET @DESC_007 = CONVERT(UNHEX('5472C3A020686F61206B68C3B4') USING utf8mb4);
SET @DESC_008 = CONVERT(UNHEX('5468E1BAA36F206DE1BB9963206769612074727579E1BB816E') USING utf8mb4);
SET @DESC_009 = CONVERT(UNHEX('33206C6FE1BAA169207472C3A0202B2068E1BB9970207175C3A0') USING utf8mb4);
SET @DESC_010 = CONVERT(UNHEX('5472C3A0202B2062C3A16E68206BE1BAB96F') USING utf8mb4);
SET @DESC_011 = CONVERT(UNHEX('E1BAA46D20706861207472C3A0206D696E69') USING utf8mb4);
SET @DESC_012 = CONVERT(UNHEX('4C792075E1BB916E67207472C3A02063E1BB9520C49169E1BB836E') USING utf8mb4);
SET @ADDR_001_LINE = CONVERT(UNHEX('3132204E677579E1BB856E204875E1BB87') USING utf8mb4);
SET @ADDR_001_WARD = CONVERT(UNHEX('42E1BABF6E204E6768C3A9') USING utf8mb4);
SET @ADDR_001_DIST = CONVERT(UNHEX('5175E1BAAD6E2031') USING utf8mb4);
SET @ADDR_001_PROV = CONVERT(UNHEX('54502E48434D') USING utf8mb4);
SET @ADDR_002_LINE = CONVERT(UNHEX('3838204CC3AA2056C4836E204CC6B0C6A16E67') USING utf8mb4);
SET @ADDR_002_WARD = CONVERT(UNHEX('4E68C3A26E204368C3AD6E68') USING utf8mb4);
SET @ADDR_002_DIST = CONVERT(UNHEX('5468616E68205875C3A26E') USING utf8mb4);
SET @ADDR_002_PROV = CONVERT(UNHEX('48C3A0204EE1BB9969') USING utf8mb4);
SET @ADDR_003_LINE = CONVERT(UNHEX('3435205472E1BAA76E205068C3BA') USING utf8mb4);
SET @ADDR_003_WARD = CONVERT(UNHEX('48E1BAA369204368C3A275') USING utf8mb4);
SET @ADDR_003_DIST = CONVERT(UNHEX('48E1BAA369204368C3A275') USING utf8mb4);
SET @ADDR_003_PROV = CONVERT(UNHEX('C490C3A0204EE1BAB56E67') USING utf8mb4);
SET @ADDR_004_LINE = CONVERT(UNHEX('3230302043C3A16368204DE1BAA16E67205468C3A16E672038') USING utf8mb4);
SET @ADDR_004_WARD = CONVERT(UNHEX('5068C6B0E1BB9D6E67203130') USING utf8mb4);
SET @ADDR_004_DIST = CONVERT(UNHEX('5175E1BAAD6E2033') USING utf8mb4);
SET @ADDR_004_PROV = CONVERT(UNHEX('54502E48434D') USING utf8mb4);
SET @NOTE_POS_001 = CONVERT(UNHEX('4B68C3A16368206D75612074E1BAA169207175E1BAA779') USING utf8mb4);
SET @NOTE_POS_002 = CONVERT(UNHEX('4D756120636F6D626F2054E1BABF74') USING utf8mb4);
SET @NOTE_COD_003 = CONVERT(UNHEX('4769616F20636869E1BB8175') USING utf8mb4);
SET @NOTE_COD_004 = CONVERT(UNHEX('53686970204748544B') USING utf8mb4);
SET @NOTE_POS_006 = CONVERT(UNHEX('5472E1BAA3207472C6B0E1BB9B63203230306B') USING utf8mb4);
SET @NOTE_POS_DEBT_002 = CONVERT(UNHEX('4D75612063686975C3BA206D6F74207068616E202D205472E1BA7A2056C3A26E204D696E68') USING utf8mb4);
SET @NOTE_POS_DEBT_005 = CONVERT(UNHEX('4D75612063686975C3BA206D6F74207068616E202D20486FC3A06E67204769616E') USING utf8mb4);
SET @NOTE_EXCH_007 = CONVERT(UNHEX('C490E1BB95692068C3A06E672074E1BBAB204856542D44454D4F2D303031202854482D44454D4F2D30303129') USING utf8mb4);
SET @NOTE_COD_008 = CONVERT(UNHEX('C490C6A16E2073E1BB89') USING utf8mb4);
SET @NOTE_RET_001 = CONVERT(UNHEX('C490E1BB95692073616E67207472C3A02042C3BA70204CE1BB996E67205875C3A26E') USING utf8mb4);
SET @SHIP_003 = CONVERT(UNHEX('3132204E677579E1BB856E204875E1BB872C2042E1BABF6E204E6768C3A92C205175E1BAAD6E20312C2054502E48434D') USING utf8mb4);
SET @SHIP_004 = CONVERT(UNHEX('3838204CC3AA2056C4836E204CC6B0C6A16E672C204E68C3A26E204368C3AD6E682C205468616E68205875C3A26E2C2048C3A0204EE1BB9969') USING utf8mb4);
SET @SHIP_005 = CONVERT(UNHEX('3435205472E1BAA76E205068C3BA2C2048E1BAA369204368C3A2752C20C490C3A0204EE1BAB56E67') USING utf8mb4);
SET @SHIP_008 = CONVERT(UNHEX('3230302043C3A16368204DE1BAA16E67205468C3A16E6720382C205175E1BAAD6E20332C2054502E48434D') USING utf8mb4);
SET @ACT_001 = CONVERT(UNHEX('C490C6A16E204856542D44454D4F2D30303420686FC3A06E2074E1BAA57420E2809420C491C3A32078C3A163206E68E1BAAD6E2074687520434F442E') USING utf8mb4);
SET @ACT_002 = CONVERT(UNHEX('5472E1BAA32068C3A06E672054482D44454D4F2D3030313A20C491E1BB95692F6D7561207468C3AA6D2C206B68C3A16368207472E1BAA3207468C3AA6D2035352E30303020C4912E') USING utf8mb4);

-- -----------------------------------------------------------------------------
-- PRODUCT DB — Danh mục + sản phẩm + SKU
-- -----------------------------------------------------------------------------
USE `hvt_product_db`;

-- Danh muc CHA (9001-9003)
INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9001, @CAT_TRA, @CAT_DESC_TRA, NULL, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9001);

INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9002, @CAT_QUA_TANG, @CAT_DESC_QUA, NULL, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9002);

INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9003, @CAT_DUNG_CU, @CAT_DESC_DUNG_CU, NULL, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9003);

-- Danh muc CON (9101-9105) — san pham gan vao cap con
INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9101, @CAT_TRA_XANH, @CAT_DESC_TRA_XANH, 9001, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9101);

INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9102, @CAT_TRA_DEN, @CAT_DESC_TRA_DEN, 9001, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9102);

INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9103, @CAT_TRA_THAO, @CAT_DESC_TRA_THAO, 9001, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9103);

INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9104, @CAT_COMBO, @CAT_DESC_COMBO, 9002, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9104);

INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9105, @CAT_AM_LY, @CAT_DESC_AM_LY, 9003, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9105);

-- Products (12)
INSERT INTO Products (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description, BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000001', 9101, 0, @PROD_001, @ORIG_001, @FLAV_001, NULL, @DESC_001, @UNIT_BAG, NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000001');

INSERT INTO Products (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description, BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000002', 9101, 0, @PROD_002, @ORIG_002, @FLAV_002, NULL, @DESC_002, @UNIT_BAG, NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000002');

INSERT INTO Products (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description, BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000003', 9101, 0, @PROD_003, @ORIG_003, @FLAV_003, NULL, @DESC_003, @UNIT_BAG, NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000003');

INSERT INTO Products (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description, BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000004', 9102, 0, @PROD_004, @ORIG_004, @FLAV_004, NULL, @DESC_004, @UNIT_BAG, NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000004');

INSERT INTO Products (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description, BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000005', 9102, 0, @PROD_005, @ORIG_005, @FLAV_005, NULL, @DESC_005, @UNIT_BAG, NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000005');

INSERT INTO Products (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description, BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000006', 9103, 0, @PROD_006, @ORIG_006, @FLAV_006, NULL, @DESC_006, @UNIT_BAG, NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000006');

INSERT INTO Products (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description, BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000007', 9103, 0, @PROD_007, @ORIG_007, @FLAV_007, NULL, @DESC_007, @UNIT_BAG, NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000007');

INSERT INTO Products (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description, BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000008', 9103, 0, @PROD_008, @ORIG_008, @FLAV_008, NULL, @DESC_008, @UNIT_BAG, NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000008');

INSERT INTO Products (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description, BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000009', 9104, 0, @PROD_009, @ORIG_008, @FLAV_009, NULL, @DESC_009, @UNIT_SET, NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000009');

INSERT INTO Products (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description, BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000010', 9104, 0, @PROD_010, @ORIG_008, @FLAV_010, NULL, @DESC_010, @UNIT_SET, NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000010');

INSERT INTO Products (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description, BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000011', 9105, 0, @PROD_011, 'Bat Trang', NULL, NULL, @DESC_011, @UNIT_PIECE, NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000011');

INSERT INTO Products (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description, BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000012', 9105, 0, @PROD_012, 'Bat Trang', NULL, NULL, @DESC_012, @UNIT_KIT, NULL, NULL, 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000012');

-- SKUs (15) — giá VNĐ
INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'SKU-DEMO-001', '8930000000001', @PKG_BAG_100, '{}', 120000, 180000, 5, 200, 1, 1, 1, NULL, 100, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-001');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000002', 'aaaaaaaa-0001-4000-8000-000000000001', 'SKU-DEMO-002', '8930000000002', @PKG_BAG_250, '{}', 280000, 420000, 5, 100, 1, 1, 1, NULL, 250, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-002');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000003', 'aaaaaaaa-0001-4000-8000-000000000002', 'SKU-DEMO-003', '8930000000003', @PKG_BAG_100, '{}', 60000, 95000, 10, 300, 1, 1, 1, NULL, 100, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-003');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000004', 'aaaaaaaa-0001-4000-8000-000000000003', 'SKU-DEMO-004', '8930000000004', @PKG_BAG_100, '{}', 95000, 150000, 5, 150, 1, 1, 1, NULL, 100, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-004');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000005', 'aaaaaaaa-0001-4000-8000-000000000004', 'SKU-DEMO-005', '8930000000005', @PKG_BAG_100, '{}', 140000, 220000, 5, 120, 1, 1, 1, NULL, 100, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-005');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000006', 'aaaaaaaa-0001-4000-8000-000000000005', 'SKU-DEMO-006', '8930000000006', @PKG_BAG_75, '{}', 180000, 280000, 3, 80, 1, 1, 1, NULL, 75, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-006');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000007', 'aaaaaaaa-0001-4000-8000-000000000006', 'SKU-DEMO-007', '8930000000007', @PKG_BAG_50, '{}', 40000, 65000, 10, 250, 1, 1, 1, NULL, 50, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-007');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000008', 'aaaaaaaa-0001-4000-8000-000000000007', 'SKU-DEMO-008', '8930000000008', @PKG_BAG_30, '{}', 25000, 45000, 10, 300, 1, 1, 1, NULL, 30, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-008');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000009', 'aaaaaaaa-0001-4000-8000-000000000008', 'SKU-DEMO-009', '8930000000009', @PKG_BAG_80, '{}', 35000, 55000, 10, 200, 1, 1, 1, NULL, 80, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-009');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000010', 'aaaaaaaa-0001-4000-8000-000000000009', 'SKU-DEMO-010', '8930000000010', @PKG_GIFT_BOX, '{}', 550000, 890000, 2, 50, 1, 1, 1, NULL, 500, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-010');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000011', 'aaaaaaaa-0001-4000-8000-000000000010', 'SKU-DEMO-011', '8930000000011', @PKG_GIFT_BOX, '{}', 320000, 520000, 3, 60, 1, 1, 1, NULL, 400, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-011');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000012', 'aaaaaaaa-0001-4000-8000-000000000011', 'SKU-DEMO-012', '8930000000012', @PKG_PIECE, '{}', 90000, 180000, 5, 40, 1, 1, 1, NULL, 200, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-012');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000013', 'aaaaaaaa-0001-4000-8000-000000000012', 'SKU-DEMO-013', '8930000000013', @PKG_SET, '{}', 200000, 350000, 3, 30, 1, 1, 1, NULL, 800, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-013');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000014', 'aaaaaaaa-0001-4000-8000-000000000002', 'SKU-DEMO-014', '8930000000014', @PKG_BAG_500, '{}', 260000, 420000, 3, 80, 1, 1, 1, NULL, 500, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-014');

INSERT INTO ProductVariants (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice, MinStock, MaxStock, IsSellable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000015', 'aaaaaaaa-0001-4000-8000-000000000004', 'SKU-DEMO-015', '8930000000015', @PKG_BAG_250, '{}', 300000, 480000, 3, 60, 1, 1, 1, NULL, 250, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductVariants WHERE SkuCode = 'SKU-DEMO-015');

-- -----------------------------------------------------------------------------
-- CUSTOMER DB — Khách hàng + địa chỉ
-- -----------------------------------------------------------------------------
USE `hvt_customer_db`;

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId, TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000001', 'KH-DEMO-001', @CUST_001, '0901000001', 'lan.nguyen@demo.vn', 'PhoThong', NULL, @TIER_MEMBER, 2500000, 0, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-001');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId, TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000002', 'KH-DEMO-002', @CUST_002, '0901000002', 'minh.tran@demo.vn', 'PhoThong', NULL, @TIER_SILVER, 8200000, 150000, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-002');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId, TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000003', 'KH-DEMO-003', @CUST_003, '0901000003', 'anh.le@demo.vn', 'DoanhNghiep', NULL, @TIER_GOLD, 28500000, 0, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-003');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId, TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000004', 'KH-DEMO-004', @CUST_004, '0901000004', NULL, 'PhoThong', NULL, @TIER_MEMBER, 450000, 0, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-004');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId, TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000005', 'KH-DEMO-005', @CUST_005, '0901000005', 'bao.hoang@demo.vn', 'DoiNgoai', NULL, @TIER_SILVER, 6100000, 320000, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-005');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId, TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000006', 'KH-DEMO-006', @CUST_006, '0901000006', NULL, 'PhoThong', NULL, @TIER_MEMBER, 0, 0, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-006');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId, TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000007', 'KH-DEMO-007', @CUST_007, '0901000007', 'kien.do@demo.vn', 'PhoThong', NULL, @TIER_MEMBER, 1200000, 0, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-007');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId, TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000008', 'KH-DEMO-008', @CUST_008, '0901000008', NULL, 'PhoThong', NULL, @TIER_SILVER, 9800000, 0, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-008');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId, TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000009', 'KH-DEMO-009', @CUST_009, '0901000009', 'huy.ngo@demo.vn', 'DoanhNghiep', NULL, @TIER_GOLD, 41000000, 0, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-009');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId, TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000010', 'KH-DEMO-010', @CUST_010, '0901000010', NULL, 'PhoThong', NULL, @TIER_MEMBER, 780000, 85000, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-010');

-- Địa chỉ giao (COD / trả hàng)
INSERT INTO CustomerAddresses (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000001', 'cccccccc-0001-4000-8000-000000000002', @CUST_002, '0901000002', @ADDR_001_LINE, @ADDR_001_WARD, @ADDR_001_DIST, @ADDR_001_PROV, 1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000001');

INSERT INTO CustomerAddresses (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000002', 'cccccccc-0001-4000-8000-000000000005', @CUST_005, '0901000005', @ADDR_002_LINE, @ADDR_002_WARD, @ADDR_002_DIST, @ADDR_002_PROV, 1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000002');

INSERT INTO CustomerAddresses (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000003', 'cccccccc-0001-4000-8000-000000000007', @CUST_007, '0901000007', @ADDR_003_LINE, @ADDR_003_WARD, @ADDR_003_DIST, @ADDR_003_PROV, 1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000003');

INSERT INTO CustomerAddresses (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000004', 'cccccccc-0001-4000-8000-000000000009', @CUST_009, '0901000009', @ADDR_004_LINE, @ADDR_004_WARD, @ADDR_004_DIST, @ADDR_004_PROV, 1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000004');

-- Giao dịch công nợ (liên kết đơn mua chịu)
INSERT INTO CustomerDebtTransactions (Id, CustomerId, Type, Amount, BalanceAfter, ReferenceType, ReferenceId, RelatedOrderCode, Note, CreatedAt)
SELECT '66666666-0001-4000-8000-000000000001', 'cccccccc-0001-4000-8000-000000000002', 'IncreaseDebt', 150000, 150000, 'Order', 'dddddddd-0001-4000-8000-000000000009', 'HVT-DEMO-DEBT-002', 'Mua chịu đơn HVT-DEMO-DEBT-002', DATE_SUB(@NOW, INTERVAL 8 DAY)
WHERE NOT EXISTS (SELECT 1 FROM CustomerDebtTransactions WHERE Id = '66666666-0001-4000-8000-000000000001');

INSERT INTO CustomerDebtTransactions (Id, CustomerId, Type, Amount, BalanceAfter, ReferenceType, ReferenceId, RelatedOrderCode, Note, CreatedAt)
SELECT '66666666-0001-4000-8000-000000000002', 'cccccccc-0001-4000-8000-000000000005', 'IncreaseDebt', 320000, 320000, 'Order', 'dddddddd-0001-4000-8000-00000000000a', 'HVT-DEMO-DEBT-005', 'Mua chịu đơn HVT-DEMO-DEBT-005', DATE_SUB(@NOW, INTERVAL 9 DAY)
WHERE NOT EXISTS (SELECT 1 FROM CustomerDebtTransactions WHERE Id = '66666666-0001-4000-8000-000000000002');

-- -----------------------------------------------------------------------------
-- INVENTORY DB — Tồn kho quầy + kho
-- -----------------------------------------------------------------------------
USE `hvt_inventory_db`;

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000001', 'SKU-DEMO-001', 100, 45, 120, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000001');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000002', 'SKU-DEMO-002', 250, 18, 60, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000002');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000003', 'SKU-DEMO-003', 100, 80, 200, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000003');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000004', 'SKU-DEMO-004', 100, 35, 90, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000004');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000005', 'SKU-DEMO-005', 100, 22, 55, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000005');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000006', 'SKU-DEMO-006', 75, 15, 40, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000006');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000007', 'SKU-DEMO-007', 50, 60, 150, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000007');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000008', 'SKU-DEMO-008', 30, 90, 220, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000008');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000009', 'SKU-DEMO-009', 80, 55, 130, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000009');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000010', 'SKU-DEMO-010', 500, 8, 25, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000010');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000011', 'SKU-DEMO-011', 400, 12, 30, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000011');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000012', 'SKU-DEMO-012', 200, 10, 35, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000012');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000013', 'SKU-DEMO-013', 800, 6, 18, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000013');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000014', 'SKU-DEMO-014', 500, 14, 40, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000014');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000015', 'SKU-DEMO-015', 250, 9, 28, 10, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000015');

-- -----------------------------------------------------------------------------
-- ORDER DB — Khuyến mãi + đơn hàng + phiếu trả
-- -----------------------------------------------------------------------------
USE `hvt_order_db`;

INSERT INTO Promotions (Id, PromoCode, NormalizedPromoCode, DiscountType, DiscountValue, MaxDiscountAmount, MinimumOrderAmount, ScopeType, UsageLimitTotal, UsageLimitPerCustomer, ValidFromUtc, ValidToUtc, IsActive, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'eeeeeeee-0001-4000-8000-000000000001', 'DEMO10', 'DEMO10', 'PERCENTAGE', 10, 100000, 300000, 'ORDER', 100, 3, '2026-01-01 00:00:00.000000', '2026-12-31 23:59:59.000000', 1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Promotions WHERE PromoCode = 'DEMO10');

INSERT INTO Promotions (Id, PromoCode, NormalizedPromoCode, DiscountType, DiscountValue, MaxDiscountAmount, MinimumOrderAmount, ScopeType, UsageLimitTotal, UsageLimitPerCustomer, ValidFromUtc, ValidToUtc, IsActive, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'eeeeeeee-0001-4000-8000-000000000002', 'DEMO50K', 'DEMO50K', 'FIXED', 50000, NULL, 500000, 'ORDER', 50, 1, '2026-01-01 00:00:00.000000', '2026-12-31 23:59:59.000000', 1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Promotions WHERE PromoCode = 'DEMO50K');

-- 1) POS hoàn tất — tiền mặt
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, IdempotencyKey, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000001', 'HVT-DEMO-001', 'Sale', 'cccccccc-0001-4000-8000-000000000001', @CUST_001, @SALE_USER_ID, 'POS', 'Completed', 'Synced', 275000, 0, NULL, NULL, 0, 275000, NULL, @NOTE_POS_001, NULL, DATE_SUB(@NOW, INTERVAL 5 DAY), DATE_SUB(@NOW, INTERVAL 5 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-001');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000001', 'dddddddd-0001-4000-8000-000000000001', 'bbbbbbbb-0001-4000-8000-000000000003', @PROD_002, 'SKU-DEMO-003', 2, 0, 95000, 50000, 'Trà demo', 190000, 0, DATE_SUB(@NOW, INTERVAL 5 DAY), DATE_SUB(@NOW, INTERVAL 5 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000001');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000002', 'dddddddd-0001-4000-8000-000000000001', 'bbbbbbbb-0001-4000-8000-000000000007', @PROD_006, 'SKU-DEMO-007', 1, 0, 65000, 50000, 'Trà demo', 65000, 0, DATE_SUB(@NOW, INTERVAL 5 DAY), DATE_SUB(@NOW, INTERVAL 5 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000002');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt, TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000001', 'dddddddd-0001-4000-8000-000000000001', 'Cash', 275000, 'Success', NULL, 0, DATE_SUB(@NOW, INTERVAL 5 DAY), NULL, NULL, DATE_SUB(@NOW, INTERVAL 5 DAY), DATE_SUB(@NOW, INTERVAL 5 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000001');

-- 2) POS hoàn tất — có mã DEMO10
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, IdempotencyKey, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000002', 'HVT-DEMO-002', 'Sale', 'cccccccc-0001-4000-8000-000000000003', @CUST_003, @SALE_USER_ID, 'POS', 'Completed', 'Synced', 890000, 89000, 'eeeeeeee-0001-4000-8000-000000000001', 'DEMO10', 89000, 801000, NULL, @NOTE_POS_002, NULL, DATE_SUB(@NOW, INTERVAL 4 DAY), DATE_SUB(@NOW, INTERVAL 4 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-002');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000003', 'dddddddd-0001-4000-8000-000000000002', 'bbbbbbbb-0001-4000-8000-000000000010', @PROD_009, 'SKU-DEMO-010', 1, 0, 890000, 50000, 'Trà demo', 890000, 0, DATE_SUB(@NOW, INTERVAL 4 DAY), DATE_SUB(@NOW, INTERVAL 4 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000003');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt, TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000002', 'dddddddd-0001-4000-8000-000000000002', 'Cash', 801000, 'Success', NULL, 0, DATE_SUB(@NOW, INTERVAL 4 DAY), NULL, NULL, DATE_SUB(@NOW, INTERVAL 4 DAY), DATE_SUB(@NOW, INTERVAL 4 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000002');

-- 3) COD đang giao — chưa thu COD
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, IdempotencyKey, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000003', 'HVT-DEMO-003', 'Sale', 'cccccccc-0001-4000-8000-000000000002', @CUST_002, @SALE_USER_ID, 'COD', 'Shipping', 'PendingDeduction', 580000, 0, NULL, NULL, 0, 580000, @SHIP_003, @NOTE_COD_003, NULL, DATE_SUB(@NOW, INTERVAL 2 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-003');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000004', 'dddddddd-0001-4000-8000-000000000003', 'bbbbbbbb-0001-4000-8000-000000000001', @PROD_001, 'SKU-DEMO-001', 2, 0, 180000, 50000, 'Trà demo', 360000, 0, DATE_SUB(@NOW, INTERVAL 2 DAY), DATE_SUB(@NOW, INTERVAL 2 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000004');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000005', 'dddddddd-0001-4000-8000-000000000003', 'bbbbbbbb-0001-4000-8000-000000000005', @PROD_004, 'SKU-DEMO-005', 1, 0, 220000, 50000, 'Trà demo', 220000, 0, DATE_SUB(@NOW, INTERVAL 2 DAY), DATE_SUB(@NOW, INTERVAL 2 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000005');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, CodWarningDate, PaidAt, TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000003', 'dddddddd-0001-4000-8000-000000000003', 'COD', 580000, 'Pending', NULL, 0, DATE_ADD(@NOW, INTERVAL 5 DAY), NULL, NULL, NULL, DATE_SUB(@NOW, INTERVAL 2 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000003');

-- 4) COD hoàn tất — đã xác nhận thu (dùng để test trả hàng)
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, IdempotencyKey, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000004', 'HVT-DEMO-004', 'Sale', 'cccccccc-0001-4000-8000-000000000005', @CUST_005, @SALE_USER_ID, 'COD', 'Completed', 'Synced', 420000, 0, NULL, NULL, 0, 420000, @SHIP_004, @NOTE_COD_004, NULL, DATE_SUB(@NOW, INTERVAL 7 DAY), DATE_SUB(@NOW, INTERVAL 6 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-004');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000006', 'dddddddd-0001-4000-8000-000000000004', 'bbbbbbbb-0001-4000-8000-000000000002', @PROD_001, 'SKU-DEMO-002', 1, 0, 420000, 50000, 'Trà demo', 420000, 0, DATE_SUB(@NOW, INTERVAL 7 DAY), DATE_SUB(@NOW, INTERVAL 7 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000006');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, CodWarningDate, PaidAt, TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000004', 'dddddddd-0001-4000-8000-000000000004', 'COD', 420000, 'Success', NULL, 1, DATE_SUB(@NOW, INTERVAL 6 DAY), DATE_SUB(@NOW, INTERVAL 6 DAY), NULL, NULL, DATE_SUB(@NOW, INTERVAL 7 DAY), DATE_SUB(@NOW, INTERVAL 6 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000004');

-- 5) COD chờ thanh toán
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, IdempotencyKey, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000005', 'HVT-DEMO-005', 'Sale', 'cccccccc-0001-4000-8000-000000000007', @CUST_007, @SALE_USER_ID, 'COD', 'PendingPayment', 'PendingDeduction', 350000, 0, NULL, NULL, 0, 350000, @SHIP_005, NULL, NULL, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-005');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000007', 'dddddddd-0001-4000-8000-000000000005', 'bbbbbbbb-0001-4000-8000-000000000013', @PROD_012, 'SKU-DEMO-013', 1, 0, 350000, 50000, 'Trà demo', 350000, 0, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000007');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, CodWarningDate, PaidAt, TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000005', 'dddddddd-0001-4000-8000-000000000005', 'COD', 350000, 'Pending', NULL, 0, DATE_ADD(@NOW, INTERVAL 7 DAY), NULL, NULL, NULL, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000005');

-- 6) POS ghi nợ một phần
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, IdempotencyKey, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000006', 'HVT-DEMO-006', 'Sale', 'cccccccc-0001-4000-8000-000000000010', @CUST_010, @SALE_USER_ID, 'POS', 'Completed', 'Synced', 565000, 0, NULL, NULL, 0, 565000, NULL, @NOTE_POS_006, NULL, DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-006');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000008', 'dddddddd-0001-4000-8000-000000000006', 'bbbbbbbb-0001-4000-8000-000000000011', @PROD_010, 'SKU-DEMO-011', 1, 0, 520000, 50000, 'Trà demo', 520000, 0, DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000008');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000009', 'dddddddd-0001-4000-8000-000000000006', 'bbbbbbbb-0001-4000-8000-000000000008', @PROD_007, 'SKU-DEMO-008', 1, 0, 45000, 50000, 'Trà demo', 45000, 0, DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000009');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt, TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000006', 'dddddddd-0001-4000-8000-000000000006', 'Cash', 200000, 'Success', NULL, 0, DATE_SUB(@NOW, INTERVAL 3 DAY), NULL, NULL, DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000006');

-- 6b) POS mua chịu — Trần Văn Minh (KH-DEMO-002, nợ 150.000)
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, IdempotencyKey, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000009', 'HVT-DEMO-DEBT-002', 'Sale', 'cccccccc-0001-4000-8000-000000000002', @CUST_002, @SALE_USER_ID, 'POS', 'Completed', 'Synced', 330000, 0, NULL, NULL, 0, 330000, NULL, @NOTE_POS_DEBT_002, NULL, DATE_SUB(@NOW, INTERVAL 8 DAY), DATE_SUB(@NOW, INTERVAL 8 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-DEBT-002');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-00000000000a', 'dddddddd-0001-4000-8000-000000000009', 'bbbbbbbb-0001-4000-8000-000000000001', @PROD_001, 'SKU-DEMO-001', 1, 0, 180000, 50000, 'Trà demo', 180000, 0, DATE_SUB(@NOW, INTERVAL 8 DAY), DATE_SUB(@NOW, INTERVAL 8 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-00000000000a');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-00000000000b', 'dddddddd-0001-4000-8000-000000000009', 'bbbbbbbb-0001-4000-8000-000000000007', @PROD_006, 'SKU-DEMO-007', 1, 0, 150000, 50000, 'Trà demo', 150000, 0, DATE_SUB(@NOW, INTERVAL 8 DAY), DATE_SUB(@NOW, INTERVAL 8 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-00000000000b');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt, TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000009', 'dddddddd-0001-4000-8000-000000000009', 'Cash', 180000, 'Success', NULL, 0, DATE_SUB(@NOW, INTERVAL 8 DAY), NULL, NULL, DATE_SUB(@NOW, INTERVAL 8 DAY), DATE_SUB(@NOW, INTERVAL 8 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000009');

-- 6c) POS mua chịu — Hoàng Gia Bảo (KH-DEMO-005, nợ 320.000)
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, IdempotencyKey, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-00000000000a', 'HVT-DEMO-DEBT-005', 'Sale', 'cccccccc-0001-4000-8000-000000000005', @CUST_005, @SALE_USER_ID, 'POS', 'Completed', 'Synced', 520000, 0, NULL, NULL, 0, 520000, NULL, @NOTE_POS_DEBT_005, NULL, DATE_SUB(@NOW, INTERVAL 9 DAY), DATE_SUB(@NOW, INTERVAL 9 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-DEBT-005');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-00000000000c', 'dddddddd-0001-4000-8000-00000000000a', 'bbbbbbbb-0001-4000-8000-000000000005', @PROD_004, 'SKU-DEMO-005', 1, 0, 220000, 50000, 'Trà demo', 220000, 0, DATE_SUB(@NOW, INTERVAL 9 DAY), DATE_SUB(@NOW, INTERVAL 9 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-00000000000c');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-00000000000d', 'dddddddd-0001-4000-8000-00000000000a', 'bbbbbbbb-0001-4000-8000-000000000006', @PROD_005, 'SKU-DEMO-006', 1, 0, 300000, 50000, 'Trà demo', 300000, 0, DATE_SUB(@NOW, INTERVAL 9 DAY), DATE_SUB(@NOW, INTERVAL 9 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-00000000000d');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt, TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-00000000000a', 'dddddddd-0001-4000-8000-00000000000a', 'Cash', 200000, 'Success', NULL, 0, DATE_SUB(@NOW, INTERVAL 9 DAY), NULL, NULL, DATE_SUB(@NOW, INTERVAL 9 DAY), DATE_SUB(@NOW, INTERVAL 9 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-00000000000a');

-- 7) Đơn đổi (Exchange)
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, IdempotencyKey, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000007', 'HVT-DEMO-DOI-001', 'Exchange', 'cccccccc-0001-4000-8000-000000000004', @CUST_004, @SALE_USER_ID, 'POS', 'Completed', 'Synced', 150000, 95000, NULL, NULL, 0, 55000, NULL, @NOTE_EXCH_007, NULL, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-DOI-001');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000010', 'dddddddd-0001-4000-8000-000000000007', 'bbbbbbbb-0001-4000-8000-000000000004', @PROD_003, 'SKU-DEMO-004', 1, 0, 150000, 50000, 'Trà demo', 150000, 0, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000010');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt, TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000007', 'dddddddd-0001-4000-8000-000000000007', 'Cash', 55000, 'Success', NULL, 0, DATE_SUB(@NOW, INTERVAL 1 DAY), NULL, NULL, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000007');

-- Phiếu trả hàng (từ đơn POS HVT-DEMO-001 — đã trả 1 SP, còn 1 SP)
INSERT INTO ReturnOrders (Id, ReturnCode, SourceOrderId, SourceOrderCode, CustomerId, CustomerSnapshotName, ReturnAmount, ExchangeAmount, NetCustomerPays, RefundAmount, CustomerPaidAmount, RefundMethod, ExchangeOrderId, Note, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'ffffffff-0001-4000-8000-000000000001', 'TH-DEMO-001', 'dddddddd-0001-4000-8000-000000000001', 'HVT-DEMO-001', 'cccccccc-0001-4000-8000-000000000001', @CUST_001, 95000, 150000, 55000, 0, 55000, 'Cash', 'dddddddd-0001-4000-8000-000000000007', @NOTE_RET_001, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM ReturnOrders WHERE ReturnCode = 'TH-DEMO-001');

INSERT INTO ReturnOrderDetails (Id, ReturnOrderId, SourceOrderDetailId, SkuId, SkuSnapshotName, SkuSnapshotCode, ReturnQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '44444444-0001-4000-8000-000000000001', 'ffffffff-0001-4000-8000-000000000001', '22222222-0001-4000-8000-000000000001', 'bbbbbbbb-0001-4000-8000-000000000003', @PROD_002, 'SKU-DEMO-003', 1, 95000, 95000, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM ReturnOrderDetails WHERE Id = '44444444-0001-4000-8000-000000000001');

-- Cập nhật ReturnedQuantity trên đơn gốc (nếu seed lần đầu)
UPDATE OrderDetails
SET ReturnedQuantity = 1, UpdatedAt = @NOW
WHERE Id = '22222222-0001-4000-8000-000000000001'
  AND ReturnedQuantity = 0;

-- 8) COD hoàn tất lớn — doanh nghiệp
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, IdempotencyKey, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000008', 'HVT-DEMO-008', 'Sale', 'cccccccc-0001-4000-8000-000000000009', @CUST_009, @SALE_USER_ID, 'COD', 'Completed', 'Synced', 1780000, 50000, 'eeeeeeee-0001-4000-8000-000000000002', 'DEMO50K', 50000, 1730000, @SHIP_008, @NOTE_COD_008, NULL, DATE_SUB(@NOW, INTERVAL 10 DAY), DATE_SUB(@NOW, INTERVAL 9 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-008');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, IsGift, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000011', 'dddddddd-0001-4000-8000-000000000008', 'bbbbbbbb-0001-4000-8000-000000000010', @PROD_009, 'SKU-DEMO-010', 2, 0, 890000, 50000, 'Trà demo', 1780000, 0, DATE_SUB(@NOW, INTERVAL 10 DAY), DATE_SUB(@NOW, INTERVAL 10 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000011');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, CodWarningDate, PaidAt, TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000008', 'dddddddd-0001-4000-8000-000000000008', 'COD', 1730000, 'Success', NULL, 1, DATE_SUB(@NOW, INTERVAL 9 DAY), DATE_SUB(@NOW, INTERVAL 9 DAY), NULL, NULL, DATE_SUB(@NOW, INTERVAL 10 DAY), DATE_SUB(@NOW, INTERVAL 9 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000008');

-- Hoạt động đơn hàng (mẫu)
INSERT INTO OrderActivities (Id, OrderId, ActivityType, Description, ActorId, ActorName, CreatedAt)
SELECT '55555555-0001-4000-8000-000000000001', 'dddddddd-0001-4000-8000-000000000004', 'Completed', @ACT_001, @SALE_USER_ID, 'sale01', DATE_SUB(@NOW, INTERVAL 6 DAY)
WHERE NOT EXISTS (SELECT 1 FROM OrderActivities WHERE Id = '55555555-0001-4000-8000-000000000001');

INSERT INTO OrderActivities (Id, OrderId, ActivityType, Description, ActorId, ActorName, CreatedAt)
SELECT '55555555-0001-4000-8000-000000000002', 'dddddddd-0001-4000-8000-000000000001', 'Returned', @ACT_002, @SALE_USER_ID, 'sale01', DATE_SUB(@NOW, INTERVAL 1 DAY)
WHERE NOT EXISTS (SELECT 1 FROM OrderActivities WHERE Id = '55555555-0001-4000-8000-000000000002');

-- -----------------------------------------------------------------------------
-- SYNC — sửa font tiếng Việt (chạy mỗi lần, kể cả data đã seed trước đó)
-- -----------------------------------------------------------------------------
USE `hvt_product_db`;

-- Categories
UPDATE Categories SET Name = @CAT_TRA, Description = @CAT_DESC_TRA, ParentId = NULL, UpdatedAt = @NOW WHERE Id = 9001;
UPDATE Categories SET Name = @CAT_QUA_TANG, Description = @CAT_DESC_QUA, ParentId = NULL, UpdatedAt = @NOW WHERE Id = 9002;
UPDATE Categories SET Name = @CAT_DUNG_CU, Description = @CAT_DESC_DUNG_CU, ParentId = NULL, UpdatedAt = @NOW WHERE Id = 9003;
UPDATE Categories SET Name = @CAT_TRA_XANH, Description = @CAT_DESC_TRA_XANH, ParentId = 9001, UpdatedAt = @NOW WHERE Id = 9101;
UPDATE Categories SET Name = @CAT_TRA_DEN, Description = @CAT_DESC_TRA_DEN, ParentId = 9001, UpdatedAt = @NOW WHERE Id = 9102;
UPDATE Categories SET Name = @CAT_TRA_THAO, Description = @CAT_DESC_TRA_THAO, ParentId = 9001, UpdatedAt = @NOW WHERE Id = 9103;
UPDATE Categories SET Name = @CAT_COMBO, Description = @CAT_DESC_COMBO, ParentId = 9002, UpdatedAt = @NOW WHERE Id = 9104;
UPDATE Categories SET Name = @CAT_AM_LY, Description = @CAT_DESC_AM_LY, ParentId = 9003, UpdatedAt = @NOW WHERE Id = 9105;

-- Products
UPDATE Products SET Name = @PROD_001, Origin = @ORIG_001, FlavorProfile = @FLAV_001, Description = @DESC_001, BaseUnit = @UNIT_BAG WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000001';
UPDATE Products SET Name = @PROD_002, Origin = @ORIG_002, FlavorProfile = @FLAV_002, Description = @DESC_002, BaseUnit = @UNIT_BAG WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000002';
UPDATE Products SET Name = @PROD_003, Origin = @ORIG_003, FlavorProfile = @FLAV_003, Description = @DESC_003, BaseUnit = @UNIT_BAG WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000003';
UPDATE Products SET Name = @PROD_004, Origin = @ORIG_004, FlavorProfile = @FLAV_004, Description = @DESC_004, BaseUnit = @UNIT_BAG WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000004';
UPDATE Products SET Name = @PROD_005, Origin = @ORIG_005, FlavorProfile = @FLAV_005, Description = @DESC_005, BaseUnit = @UNIT_BAG WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000005';
UPDATE Products SET Name = @PROD_006, Origin = @ORIG_006, FlavorProfile = @FLAV_006, Description = @DESC_006, BaseUnit = @UNIT_BAG WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000006';
UPDATE Products SET Name = @PROD_007, Origin = @ORIG_007, FlavorProfile = @FLAV_007, Description = @DESC_007, BaseUnit = @UNIT_BAG WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000007';
UPDATE Products SET Name = @PROD_008, Origin = @ORIG_008, FlavorProfile = @FLAV_008, Description = @DESC_008, BaseUnit = @UNIT_BAG WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000008';
UPDATE Products SET Name = @PROD_009, Origin = @ORIG_008, FlavorProfile = @FLAV_009, Description = @DESC_009, BaseUnit = @UNIT_SET WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000009';
UPDATE Products SET Name = @PROD_010, Origin = @ORIG_008, FlavorProfile = @FLAV_010, Description = @DESC_010, BaseUnit = @UNIT_SET WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000010';
UPDATE Products SET Name = @PROD_011, Origin = 'Bat Trang', FlavorProfile = NULL, Description = @DESC_011, BaseUnit = @UNIT_PIECE WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000011';
UPDATE Products SET Name = @PROD_012, Origin = 'Bat Trang', FlavorProfile = NULL, Description = @DESC_012, BaseUnit = @UNIT_KIT WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000012';

-- Product SKUs (PackagingType)
UPDATE ProductVariants SET VariantName = @PKG_BAG_100, UpdatedAt = @NOW WHERE SkuCode IN ('SKU-DEMO-001','SKU-DEMO-003','SKU-DEMO-004','SKU-DEMO-005');
UPDATE ProductVariants SET VariantName = @PKG_BAG_250, UpdatedAt = @NOW WHERE SkuCode IN ('SKU-DEMO-002','SKU-DEMO-015');
UPDATE ProductVariants SET VariantName = @PKG_BAG_500, UpdatedAt = @NOW WHERE SkuCode = 'SKU-DEMO-014';
UPDATE ProductVariants SET VariantName = @PKG_BAG_75, UpdatedAt = @NOW WHERE SkuCode = 'SKU-DEMO-006';
UPDATE ProductVariants SET VariantName = @PKG_BAG_50, UpdatedAt = @NOW WHERE SkuCode = 'SKU-DEMO-007';
UPDATE ProductVariants SET VariantName = @PKG_BAG_30, UpdatedAt = @NOW WHERE SkuCode = 'SKU-DEMO-008';
UPDATE ProductVariants SET VariantName = @PKG_BAG_80, UpdatedAt = @NOW WHERE SkuCode = 'SKU-DEMO-009';
UPDATE ProductVariants SET VariantName = @PKG_GIFT_BOX, UpdatedAt = @NOW WHERE SkuCode IN ('SKU-DEMO-010','SKU-DEMO-011');
UPDATE ProductVariants SET VariantName = @PKG_PIECE, UpdatedAt = @NOW WHERE SkuCode = 'SKU-DEMO-012';
UPDATE ProductVariants SET VariantName = @PKG_SET, UpdatedAt = @NOW WHERE SkuCode = 'SKU-DEMO-013';

USE `hvt_customer_db`;

UPDATE Customers SET FullName = @CUST_001, UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-001';
UPDATE Customers SET FullName = @CUST_002, UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-002';
UPDATE Customers SET FullName = @CUST_003, UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-003';
UPDATE Customers SET FullName = @CUST_004, UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-004';
UPDATE Customers SET FullName = @CUST_005, UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-005';
UPDATE Customers SET FullName = @CUST_006, UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-006';
UPDATE Customers SET FullName = @CUST_007, UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-007';
UPDATE Customers SET FullName = @CUST_008, UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-008';
UPDATE Customers SET FullName = @CUST_009, UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-009';
UPDATE Customers SET FullName = @CUST_010, UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-010';

UPDATE CustomerAddresses SET ReceiverName = @CUST_002, AddressLine = @ADDR_001_LINE, Ward = @ADDR_001_WARD, District = @ADDR_001_DIST, Province = @ADDR_001_PROV, UpdatedAt = @NOW WHERE Id = '11111111-0001-4000-8000-000000000001';
UPDATE CustomerAddresses SET ReceiverName = @CUST_005, AddressLine = @ADDR_002_LINE, Ward = @ADDR_002_WARD, District = @ADDR_002_DIST, Province = @ADDR_002_PROV, UpdatedAt = @NOW WHERE Id = '11111111-0001-4000-8000-000000000002';
UPDATE CustomerAddresses SET ReceiverName = @CUST_007, AddressLine = @ADDR_003_LINE, Ward = @ADDR_003_WARD, District = @ADDR_003_DIST, Province = @ADDR_003_PROV, UpdatedAt = @NOW WHERE Id = '11111111-0001-4000-8000-000000000003';
UPDATE CustomerAddresses SET ReceiverName = @CUST_009, AddressLine = @ADDR_004_LINE, Ward = @ADDR_004_WARD, District = @ADDR_004_DIST, Province = @ADDR_004_PROV, UpdatedAt = @NOW WHERE Id = '11111111-0001-4000-8000-000000000004';

USE `hvt_order_db`;

UPDATE Orders SET Note = @NOTE_POS_001, UpdatedAt = @NOW WHERE OrderCode = 'HVT-DEMO-001';
UPDATE Orders SET Note = @NOTE_POS_002, UpdatedAt = @NOW WHERE OrderCode = 'HVT-DEMO-002';
UPDATE Orders SET ShippingAddress = @SHIP_003, Note = @NOTE_COD_003, UpdatedAt = @NOW WHERE OrderCode = 'HVT-DEMO-003';
UPDATE Orders SET ShippingAddress = @SHIP_004, Note = @NOTE_COD_004, UpdatedAt = @NOW WHERE OrderCode = 'HVT-DEMO-004';
UPDATE Orders SET ShippingAddress = @SHIP_005, UpdatedAt = @NOW WHERE OrderCode = 'HVT-DEMO-005';
UPDATE Orders SET Note = @NOTE_POS_006, UpdatedAt = @NOW WHERE OrderCode = 'HVT-DEMO-006';
UPDATE Orders SET Note = @NOTE_POS_DEBT_002, UpdatedAt = @NOW WHERE OrderCode = 'HVT-DEMO-DEBT-002';
UPDATE Orders SET Note = @NOTE_POS_DEBT_005, UpdatedAt = @NOW WHERE OrderCode = 'HVT-DEMO-DEBT-005';
UPDATE Orders SET Note = @NOTE_EXCH_007, UpdatedAt = @NOW WHERE OrderCode = 'HVT-DEMO-DOI-001';
UPDATE Orders SET ShippingAddress = @SHIP_008, Note = @NOTE_COD_008, UpdatedAt = @NOW WHERE OrderCode = 'HVT-DEMO-008';

UPDATE ReturnOrders SET Note = @NOTE_RET_001, UpdatedAt = @NOW WHERE ReturnCode = 'TH-DEMO-001';

UPDATE OrderActivities SET Description = @ACT_001 WHERE Id = '55555555-0001-4000-8000-000000000001';
UPDATE OrderActivities SET Description = @ACT_002 WHERE Id = '55555555-0001-4000-8000-000000000002';

UPDATE Orders o
INNER JOIN hvt_customer_db.Customers c ON c.Id = o.CustomerId
SET o.CustomerSnapshotName = CONCAT(c.FullName, @SNAP_SEP, c.CustomerCode),
    o.UpdatedAt = @NOW
WHERE o.OrderCode LIKE 'HVT-DEMO-%'
  AND c.CustomerCode LIKE 'KH-DEMO-%';

UPDATE ReturnOrders r
INNER JOIN hvt_customer_db.Customers c ON c.Id = r.CustomerId
SET r.CustomerSnapshotName = CONCAT(c.FullName, @SNAP_SEP, c.CustomerCode),
    r.UpdatedAt = @NOW
WHERE r.ReturnCode LIKE 'TH-DEMO-%'
  AND c.CustomerCode LIKE 'KH-DEMO-%';

UPDATE OrderDetails d
INNER JOIN hvt_product_db.Products p ON p.Id = (
  SELECT s.ProductId FROM hvt_product_db.ProductVariants s WHERE s.SkuCode = d.SkuSnapshotCode LIMIT 1
)
SET d.SkuSnapshotName = p.Name,
    d.UpdatedAt = @NOW
WHERE d.SkuSnapshotCode LIKE 'SKU-DEMO-%';

UPDATE ReturnOrderDetails d
INNER JOIN hvt_product_db.Products p ON p.Id = (
  SELECT s.ProductId FROM hvt_product_db.ProductVariants s WHERE s.SkuCode = d.SkuSnapshotCode LIMIT 1
)
SET d.SkuSnapshotName = p.Name,
    d.UpdatedAt = @NOW
WHERE d.SkuSnapshotCode LIKE 'SKU-DEMO-%';

SELECT 'Seed demo data completed.' AS Result;
