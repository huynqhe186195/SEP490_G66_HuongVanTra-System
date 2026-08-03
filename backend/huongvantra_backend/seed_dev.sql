-- ============================================================
-- HuongVanTra — Dev Seed Data
-- Ngày tạo: 2026-06-28
-- ============================================================
-- Chạy: mysql -u hvtuser -phvtpass123 < seed_dev.sql
--   hoặc copy-paste từng SECTION vào DBeaver / MySQL Workbench
--
-- NOTES:
--   • UserService auto-seeds khi app start: admin / sale01 / manager01
--     (mật khẩu: 123456). Section [4] thêm warehouse01 + cashier01.
--   • Script dùng INSERT IGNORE — chạy lại không bị lỗi duplicate.
--   • Mọi SkuId trong InventoryService khớp với ProductVariant.Id.
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ============================================================
-- [1] PRODUCT SERVICE — hvt_product_db
-- ============================================================

USE hvt_product_db;

-- ----------------------------------------------------------
-- Categories  (int auto-increment — ta chỉ định Id cụ thể)
-- ----------------------------------------------------------

INSERT IGNORE INTO Categories
  (Id, Name, Description, ParentId, IsActive, IsDeleted, CreatedAt)
VALUES
  (1, 'Trà thành phẩm',  'Trà đóng gói sẵn bán lẻ',           NULL, 1, 0, '2026-01-01 00:00:00'),
  (2, 'Cà phê',          'Cà phê hòa tan và rang xay',          NULL, 1, 0, '2026-01-01 00:00:00'),
  (3, 'Nguyên liệu',     'Nguyên liệu thô dùng sản xuất',       NULL, 1, 0, '2026-01-01 00:00:00'),
  (4, 'Trà nguyên liệu', 'Trà xanh, trà ô long nguyên liệu',   3,    1, 0, '2026-01-01 00:00:00'),
  (5, 'Nguyên liệu phụ', 'Đường, sữa và các phụ gia khác',     3,    1, 0, '2026-01-01 00:00:00');

-- ----------------------------------------------------------
-- Products
-- ProductType stored as string: 'THANH_PHAM' | 'NGUYEN_LIEU'
-- ----------------------------------------------------------

INSERT IGNORE INTO Products
  (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, Description,
   BaseUnit, WeightValue, WeightUnit, IsVariantParent, IsActive, IsDeleted, CreatedAt)
VALUES
  -- ── THÀNH PHẨM ──────────────────────────────────────────
  ('10000000-0000-0000-0000-000000000001',
   1, 'THANH_PHAM', 'Trà Sen Tây Hồ', 'Việt Nam', 'Thanh tao, hương sen dịu',
   'Trà xanh ướp hoa sen Tây Hồ theo phương pháp thủ công truyền thống.',
   'Gói', 100, 'g', 1, 1, 0, '2026-01-01 00:00:00'),

  ('10000000-0000-0000-0000-000000000002',
   1, 'THANH_PHAM', 'Trà Ô Long Cao Sơn', 'Việt Nam', 'Ngọt hậu, hương hoa quả',
   'Trà ô long trồng ở vùng núi cao, sao thủ công giữ trọn hương vị.',
   'Gói', 100, 'g', 1, 1, 0, '2026-01-01 00:00:00'),

  ('10000000-0000-0000-0000-000000000003',
   1, 'THANH_PHAM', 'Hồng Trà Đại Hồng Bào', 'Trung Quốc', 'Đậm đà, hậu vị mật ong',
   'Hồng trà cao cấp Đại Hồng Bào, vị đậm ấm, thích hợp thưởng thức mùa lạnh.',
   'Gói', 100, 'g', 0, 1, 0, '2026-01-01 00:00:00'),

  -- ── NGUYÊN LIỆU ─────────────────────────────────────────
  ('10000000-0000-0000-0000-000000000011',
   4, 'NGUYEN_LIEU', 'Trà xanh thô', 'Thái Nguyên', NULL,
   'Búp trà xanh khô nguyên liệu từ vùng chè Thái Nguyên.',
   'g', 1, 'g', 0, 1, 0, '2026-01-01 00:00:00'),

  ('10000000-0000-0000-0000-000000000012',
   5, 'NGUYEN_LIEU', 'Hoa sen khô', 'Việt Nam', NULL,
   'Gạo sen và cánh sen khô dùng ướp hương trà sen.',
   'g', 1, 'g', 0, 1, 0, '2026-01-01 00:00:00'),

  ('10000000-0000-0000-0000-000000000013',
   4, 'NGUYEN_LIEU', 'Lá trà ô long thô', 'Lâm Đồng', NULL,
   'Lá trà ô long thô đã sao sơ, dùng sản xuất trà ô long thành phẩm.',
   'g', 1, 'g', 0, 1, 0, '2026-01-01 00:00:00');

-- ----------------------------------------------------------
-- ProductVariants (= SKU)
-- SyncedToStoreAt non-NULL → xuất hiện ở cửa hàng / POS
-- NGUYEN_LIEU để NULL (chỉ ở kho tổng)
-- ----------------------------------------------------------

INSERT IGNORE INTO ProductVariants
  (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson,
   CostPrice, RetailPrice, MinStock, MaxStock,
   IsSellable, AllowRewardPoints, IsActive, ImageUrl,
   WeightInGrams, SyncedToStoreAt, IsDeleted, CreatedAt)
VALUES
  -- Trà Sen Tây Hồ 100g
  ('20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   'TRA-SEN-100G', '8934673200001', 'Trà Sen Tây Hồ 100g',
   '{"Khối lượng":"100g"}',
   90000, 185000, 15, 400, 1, 1, 1, NULL,
   100, '2026-01-01 00:00:00', 0, '2026-01-01 00:00:00'),

  -- Trà Sen Tây Hồ 250g
  ('20000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000001',
   'TRA-SEN-250G', '8934673200002', 'Trà Sen Tây Hồ 250g',
   '{"Khối lượng":"250g"}',
   210000, 420000, 10, 200, 1, 1, 1, NULL,
   250, '2026-01-01 00:00:00', 0, '2026-01-01 00:00:00'),

  -- Trà Ô Long Cao Sơn 100g
  ('20000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000002',
   'TRA-OL-100G', '8934673200003', 'Trà Ô Long Cao Sơn 100g',
   '{"Khối lượng":"100g"}',
   70000, 145000, 20, 500, 1, 1, 1, NULL,
   100, '2026-01-01 00:00:00', 0, '2026-01-01 00:00:00'),

  -- Trà Ô Long Cao Sơn 250g
  ('20000000-0000-0000-0000-000000000004',
   '10000000-0000-0000-0000-000000000002',
   'TRA-OL-250G', '8934673200004', 'Trà Ô Long Cao Sơn 250g',
   '{"Khối lượng":"250g"}',
   165000, 330000, 15, 300, 1, 1, 1, NULL,
   250, '2026-01-01 00:00:00', 0, '2026-01-01 00:00:00'),

  -- Hồng Trà Đại Hồng Bào 100g
  ('20000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000003',
   'HTRA-DHB-100G', '8934673200005', 'Hồng Trà Đại Hồng Bào 100g',
   '{"Khối lượng":"100g"}',
   110000, 220000, 15, 300, 1, 1, 1, NULL,
   100, '2026-01-01 00:00:00', 0, '2026-01-01 00:00:00'),

  -- Nguyên liệu: Trà xanh thô 1kg (KHÔNG sync cửa hàng)
  ('20000000-0000-0000-0000-000000000011',
   '10000000-0000-0000-0000-000000000011',
   'NL-TRAXANH-1KG', NULL, 'Trà xanh thô 1kg',
   '{"Khối lượng":"1kg"}',
   120, 180, 50000, 2000000, 0, 0, 1, NULL,
   1, NULL, 0, '2026-01-01 00:00:00'),

  -- Nguyên liệu: Hoa sen khô 1kg
  ('20000000-0000-0000-0000-000000000012',
   '10000000-0000-0000-0000-000000000012',
   'NL-HOASEN-1KG', NULL, 'Hoa sen khô 1kg',
   '{"Khối lượng":"1kg"}',
   350, 500, 20000, 500000, 0, 0, 1, NULL,
   1, NULL, 0, '2026-01-01 00:00:00'),

  -- Nguyên liệu: Lá trà ô long thô 1kg
  ('20000000-0000-0000-0000-000000000013',
   '10000000-0000-0000-0000-000000000013',
   'NL-OLONG-1KG', NULL, 'Lá trà ô long thô 1kg',
   '{"Khối lượng":"1kg"}',
   140, 210, 40000, 1500000, 0, 0, 1, NULL,
   1, NULL, 0, '2026-01-01 00:00:00');

-- ----------------------------------------------------------
-- ProductUnits
-- ----------------------------------------------------------

INSERT IGNORE INTO ProductUnits
  (Id, ProductId, VariantId, UnitName, ConversionRate, Price,
   Barcode, IsDirectSell, IsBaseUnit, IsDeleted, CreatedAt)
VALUES
  -- TRA-SEN-100G ─ Gói (base) + Thùng 12
  ('30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   'Gói', 1, 185000, NULL, 1, 1, 0, '2026-01-01 00:00:00'),

  ('30000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   'Thùng', 12, 2035000, NULL, 0, 0, 0, '2026-01-01 00:00:00'),

  -- TRA-SEN-250G ─ Hộp (base) + Thùng 6
  ('30000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002',
   'Hộp', 1, 420000, NULL, 1, 1, 0, '2026-01-01 00:00:00'),

  ('30000000-0000-0000-0000-000000000004',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002',
   'Thùng', 6, 2394000, NULL, 0, 0, 0, '2026-01-01 00:00:00'),

  -- TRA-OL-100G ─ Gói (base) + Thùng 12
  ('30000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000003',
   'Gói', 1, 145000, NULL, 1, 1, 0, '2026-01-01 00:00:00'),

  ('30000000-0000-0000-0000-000000000006',
   '10000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000003',
   'Thùng', 12, 1595000, NULL, 0, 0, 0, '2026-01-01 00:00:00'),

  -- TRA-OL-250G ─ Hộp (base)
  ('30000000-0000-0000-0000-000000000007',
   '10000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000004',
   'Hộp', 1, 330000, NULL, 1, 1, 0, '2026-01-01 00:00:00'),

  -- HTRA-DHB-100G ─ Gói (base)
  ('30000000-0000-0000-0000-000000000008',
   '10000000-0000-0000-0000-000000000003',
   '20000000-0000-0000-0000-000000000005',
   'Gói', 1, 220000, NULL, 1, 1, 0, '2026-01-01 00:00:00'),

  -- NL-TRAXANH-1KG ─ Kg (base, không bán lẻ)
  ('30000000-0000-0000-0000-000000000011',
   '10000000-0000-0000-0000-000000000011',
   '20000000-0000-0000-0000-000000000011',
   'g', 1, 180, NULL, 0, 1, 0, '2026-01-01 00:00:00'),

  -- NL-HOASEN-1KG ─ Kg (base, không bán lẻ)
  ('30000000-0000-0000-0000-000000000012',
   '10000000-0000-0000-0000-000000000012',
   '20000000-0000-0000-0000-000000000012',
   'g', 1, 500, NULL, 0, 1, 0, '2026-01-01 00:00:00'),

  -- NL-OLONG-1KG ─ Kg (base, không bán lẻ)
  ('30000000-0000-0000-0000-000000000013',
   '10000000-0000-0000-0000-000000000013',
   '20000000-0000-0000-0000-000000000013',
   'g', 1, 210, NULL, 0, 1, 0, '2026-01-01 00:00:00');

-- ----------------------------------------------------------
-- ProductVariantBomLines  (int Id, auto-increment)
-- BOM: cần bao nhiêu nguyên liệu để tạo 1 đơn vị thành phẩm
-- ----------------------------------------------------------

-- TRA-SEN-100G ← trà xanh thô 90g + hoa sen khô 20g
INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, IsDeleted, CreatedAt)
SELECT
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000011',
  90, 0, '2026-01-01 00:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM ProductVariantBomLines
  WHERE ProductVariantId = '20000000-0000-0000-0000-000000000001'
    AND MaterialId = '10000000-0000-0000-0000-000000000011'
);

INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, IsDeleted, CreatedAt)
SELECT
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000012',
  20, 0, '2026-01-01 00:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM ProductVariantBomLines
  WHERE ProductVariantId = '20000000-0000-0000-0000-000000000001'
    AND MaterialId = '10000000-0000-0000-0000-000000000012'
);

-- TRA-SEN-250G ← trà xanh thô 230g + hoa sen khô 50g
INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, IsDeleted, CreatedAt)
SELECT
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000011',
  230, 0, '2026-01-01 00:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM ProductVariantBomLines
  WHERE ProductVariantId = '20000000-0000-0000-0000-000000000002'
    AND MaterialId = '10000000-0000-0000-0000-000000000011'
);

INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, IsDeleted, CreatedAt)
SELECT
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000012',
  50, 0, '2026-01-01 00:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM ProductVariantBomLines
  WHERE ProductVariantId = '20000000-0000-0000-0000-000000000002'
    AND MaterialId = '10000000-0000-0000-0000-000000000012'
);

-- TRA-OL-100G ← lá trà ô long thô 100g
INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, IsDeleted, CreatedAt)
SELECT
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000013',
  100, 0, '2026-01-01 00:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM ProductVariantBomLines
  WHERE ProductVariantId = '20000000-0000-0000-0000-000000000003'
    AND MaterialId = '10000000-0000-0000-0000-000000000013'
);

-- TRA-OL-250G ← lá trà ô long thô 250g
INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, IsDeleted, CreatedAt)
SELECT
  '20000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000013',
  250, 0, '2026-01-01 00:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM ProductVariantBomLines
  WHERE ProductVariantId = '20000000-0000-0000-0000-000000000004'
    AND MaterialId = '10000000-0000-0000-0000-000000000013'
);

-- ----------------------------------------------------------
-- PriceBooks
-- ----------------------------------------------------------

INSERT IGNORE INTO PriceBooks
  (Id, Code, Name, Description, IsActive, StartsAt, EndsAt, IsDeleted, CreatedAt)
VALUES
  ('40000000-0000-0000-0000-000000000001',
   'PB-LE-2026', 'Bảng giá lẻ 2026',
   'Giá bán lẻ cho khách phổ thông và đối ngoại',
   1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('40000000-0000-0000-0000-000000000002',
   'PB-SI-2026', 'Bảng giá sỉ 2026',
   'Giá sỉ cho khách doanh nghiệp và đại lý (giảm ~12%)',
   1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00');

-- ----------------------------------------------------------
-- PriceBookEntries
-- ----------------------------------------------------------

INSERT IGNORE INTO PriceBookEntries
  (Id, PriceBookId, VariantId, UnitId, Price, IsActive, StartsAt, EndsAt, IsDeleted, CreatedAt)
VALUES
  -- ── Bảng giá lẻ (theo Variant, không kèm Unit)
  ('50000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', NULL,
   185000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000002',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', NULL,
   420000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000003',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', NULL,
   145000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000004',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', NULL,
   330000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000005',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', NULL,
   220000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  -- ── Bảng giá sỉ (giảm ~12-14%)
  ('50000000-0000-0000-0000-000000000011',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', NULL,
   163000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000012',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', NULL,
   370000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000013',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', NULL,
   128000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000014',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', NULL,
   290000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000015',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005', NULL,
   194000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00');


-- ============================================================
-- [2] INVENTORY SERVICE — hvt_inventory_db
-- ============================================================

USE hvt_inventory_db;

-- ----------------------------------------------------------
-- SkuStocks  (SkuId = ProductVariant.Id)
-- QuantityOnHand          = tồn tại cửa hàng/quầy kệ (POS trừ vào đây)
-- WarehouseQuantityOnHand = tồn kho tổng (tính từ WarehouseBatchItems)
-- LowStockThreshold          = ngưỡng cảnh báo chung
-- WarehouseLowStockThreshold = ngưỡng cảnh báo kho tổng
-- ShelfLowStockThreshold     = ngưỡng cảnh báo quầy/kệ
-- ----------------------------------------------------------

INSERT IGNORE INTO SkuStocks
  (SkuId, SkuCode, WeightInGrams,
   QuantityOnHand, WarehouseQuantityOnHand,
   LowStockThreshold, WarehouseLowStockThreshold, ShelfLowStockThreshold,
   CreatedAt, UpdatedAt)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'TRA-SEN-100G',  100,  40, 180, 15, 30, 10, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000002', 'TRA-SEN-250G',  250,  25,  90, 10, 20,  8, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000003', 'TRA-OL-100G',   100,  60, 250, 20, 40, 15, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000004', 'TRA-OL-250G',   250,  35, 120, 15, 25, 10, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000005', 'HTRA-DHB-100G', 100,  30, 140, 15, 25, 10, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000011', 'NL-TRAXANH-1KG',   1,  0, 150000, 50000, 50000,  0, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000012', 'NL-HOASEN-1KG',    1,  0,  60000, 20000, 20000,  0, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000013', 'NL-OLONG-1KG',     1,  0, 120000, 40000, 40000,  0, '2026-01-01 00:00:00', '2026-01-01 00:00:00');

-- ----------------------------------------------------------
-- WarehouseBatches
-- ----------------------------------------------------------

INSERT IGNORE INTO WarehouseBatches
  (Id, LotCode, Supplier, ExpiresAt, Note, Status, CreatedBy, CreatedAt, UpdatedAt)
VALUES
  ('60000000-0000-0000-0000-000000000001',
   'LOT-20260101', 'Cty TNHH Trà Thái Nguyên',
   '2027-01-01 00:00:00',
   'Lô nhập đầu năm 2026 — trà thành phẩm và nguyên liệu',
   'active', '00000000-0000-0000-0000-000000000001',
   '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('60000000-0000-0000-0000-000000000002',
   'LOT-20260601', 'HTX Trà Ô Long Lâm Đồng',
   '2027-06-01 00:00:00',
   'Lô nhập tháng 6 — bổ sung trà sen và ô long',
   'active', '00000000-0000-0000-0000-000000000001',
   '2026-06-01 08:00:00', '2026-06-01 08:00:00');

-- ----------------------------------------------------------
-- WarehouseBatchItems
-- QuantityOnHand = còn lại trong lô; InitialQuantity = khi nhập
-- ----------------------------------------------------------

INSERT IGNORE INTO WarehouseBatchItems
  (Id, WarehouseBatchId, SkuId, SkuCode, ProductSnapshotName,
   QuantityOnHand, InitialQuantity, UnitCost, CreatedAt, UpdatedAt)
VALUES
  -- LOT-20260101 (trà thành phẩm + nguyên liệu)
  ('70000000-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'TRA-SEN-100G',
   'Trà Sen Tây Hồ 100g', 120, 200, 90000, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000002',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002', 'TRA-SEN-250G',
   'Trà Sen Tây Hồ 250g', 90, 150, 210000, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000003',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000003', 'TRA-OL-100G',
   'Trà Ô Long Cao Sơn 100g', 150, 250, 70000, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000004',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000004', 'TRA-OL-250G',
   'Trà Ô Long Cao Sơn 250g', 120, 180, 165000, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000005',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000005', 'HTRA-DHB-100G',
   'Hồng Trà Đại Hồng Bào 100g', 140, 200, 110000, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000006',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000011', 'NL-TRAXANH-1KG',
   'Trà xanh thô 1kg', 150000, 200000, 120, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000007',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000012', 'NL-HOASEN-1KG',
   'Hoa sen khô 1kg', 60000, 100000, 350, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000008',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000013', 'NL-OLONG-1KG',
   'Lá trà ô long thô 1kg', 120000, 180000, 140, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  -- LOT-20260601 (bổ sung trà sen + ô long)
  ('70000000-0000-0000-0000-000000000009',
   '60000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001', 'TRA-SEN-100G',
   'Trà Sen Tây Hồ 100g', 60, 60, 92000, '2026-06-01 08:00:00', '2026-06-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000010',
   '60000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000003', 'TRA-OL-100G',
   'Trà Ô Long Cao Sơn 100g', 100, 100, 72000, '2026-06-01 08:00:00', '2026-06-01 08:00:00');


-- ============================================================
-- [3] CUSTOMER SERVICE — hvt_customer_db
-- ============================================================

USE hvt_customer_db;

-- ----------------------------------------------------------
-- CustomerTiers
-- ----------------------------------------------------------

INSERT IGNORE INTO CustomerTiers
  (Id, TierName, MinSpendingThreshold, DiscountPercent, ValidityMonths, IsDeleted, CreatedAt)
VALUES
  (1, 'Đồng',     0,         0,   NULL, 0, '2026-01-01 00:00:00'),
  (2, 'Bạc',      2000000,   3,   12,   0, '2026-01-01 00:00:00'),
  (3, 'Vàng',     10000000,  5,   12,   0, '2026-01-01 00:00:00'),
  (4, 'Bạch Kim', 50000000,  10,  24,   0, '2026-01-01 00:00:00');

-- ----------------------------------------------------------
-- Customers
-- CustomerGroup (int): DoiNgoai=0  PhoThong=1  DoanhNghiep=2
-- CustomerSource (int): Website=0  Zalo=1  Phone=2  WalkIn=3
-- ----------------------------------------------------------

INSERT IGNORE INTO Customers
  (Id, CustomerCode, FullName, PhoneNumber, Email,
   CustomerGroup, TaxCode, TierId, TotalSpending, CurrentDebt,
   AssignedSaleId, Source, Department, IsDeleted, CreatedAt)
VALUES
  -- ── Khách phổ thông
  ('80000000-0000-0000-0000-000000000001',
   'KH-000001', 'Nguyễn Thị Lan', '0901234501', 'lan.nguyen@gmail.com',
   1, NULL, 2, 5500000, 0, NULL, 3, NULL, 0, '2026-02-01 00:00:00'),

  ('80000000-0000-0000-0000-000000000002',
   'KH-000002', 'Trần Văn Bình', '0901234502', NULL,
   1, NULL, 1, 800000, 0, NULL, 3, NULL, 0, '2026-02-15 00:00:00'),

  ('80000000-0000-0000-0000-000000000003',
   'KH-000003', 'Phạm Thị Hương', '0901234503', 'huong.pham@email.com',
   1, NULL, 3, 15200000, 0, NULL, 0, NULL, 0, '2026-01-10 00:00:00'),

  ('80000000-0000-0000-0000-000000000004',
   'KH-000004', 'Vũ Minh Khoa', '0901234504', NULL,
   1, NULL, 1, 350000, 0, NULL, 1, NULL, 0, '2026-03-01 00:00:00'),

  -- ── Khách đối ngoại (bán buôn nhỏ)
  ('80000000-0000-0000-0000-000000000005',
   'KH-000005', 'Lê Thị Ngọc', '0901234505', 'ngoc.le@business.vn',
   0, NULL, 3, 22000000, 500000, NULL, 2, NULL, 0, '2026-01-20 00:00:00'),

  ('80000000-0000-0000-0000-000000000006',
   'KH-000006', 'Hoàng Văn Nam', '0901234506', NULL,
   0, NULL, 2, 3200000, 0, NULL, 3, NULL, 0, '2026-02-28 00:00:00'),

  -- ── Khách doanh nghiệp (có công nợ)
  ('80000000-0000-0000-0000-000000000007',
   'KH-DN-001', 'Nhà hàng Phố Cổ', '0284567001', 'contact@phoco.vn',
   2, '0301234567', NULL, 85000000, 12000000, NULL, 2,
   'Phòng mua hàng', 0, '2026-01-05 00:00:00'),

  ('80000000-0000-0000-0000-000000000008',
   'KH-DN-002', 'Khách sạn Ánh Dương', '0284567002', 'purchase@anhdong.com',
   2, '0307654321', NULL, 45000000, 0, NULL, 2,
   'Phòng kinh doanh', 0, '2026-01-15 00:00:00');

-- ----------------------------------------------------------
-- CustomerAddresses
-- ----------------------------------------------------------

INSERT IGNORE INTO CustomerAddresses
  (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine,
   Ward, District, Province, IsDefault, IsDeleted, CreatedAt)
VALUES
  ('90000000-0000-0000-0000-000000000001',
   '80000000-0000-0000-0000-000000000001',
   'Nguyễn Thị Lan', '0901234501', '12 Nguyễn Trãi',
   'Phường Thịnh Liệt', 'Hoàng Mai', 'Hà Nội',
   1, 0, '2026-02-01 00:00:00'),

  ('90000000-0000-0000-0000-000000000002',
   '80000000-0000-0000-0000-000000000005',
   'Lê Thị Ngọc', '0901234505', '34 Bùi Thị Xuân',
   'Phường Phạm Đình Hổ', 'Hai Bà Trưng', 'Hà Nội',
   1, 0, '2026-01-20 00:00:00'),

  ('90000000-0000-0000-0000-000000000003',
   '80000000-0000-0000-0000-000000000007',
   'Phòng Mua Hàng', '0284567001', '56 Lý Thường Kiệt',
   'Phường Trần Hưng Đạo', 'Hoàn Kiếm', 'Hà Nội',
   1, 0, '2026-01-05 00:00:00'),

  ('90000000-0000-0000-0000-000000000004',
   '80000000-0000-0000-0000-000000000008',
   'Phòng Kinh Doanh', '0284567002', '78 Trần Phú',
   'Phường 4', 'Quận 5', 'TP. Hồ Chí Minh',
   1, 0, '2026-01-15 00:00:00');

-- ----------------------------------------------------------
-- CustomerActivities (không có IsDeleted — không extends BaseEntity)
-- ----------------------------------------------------------

INSERT IGNORE INTO CustomerActivities
  (Id, CustomerId, ActivityType, Description, CreatedAt)
VALUES
  ('a0000000-0000-0000-0000-000000000001',
   '80000000-0000-0000-0000-000000000001',
   0, 'Khách hàng được tạo mới tại cửa hàng', '2026-02-01 00:00:00'),

  ('a0000000-0000-0000-0000-000000000002',
   '80000000-0000-0000-0000-000000000003',
   0, 'Khách hàng được tạo mới qua website', '2026-01-10 00:00:00'),

  ('a0000000-0000-0000-0000-000000000003',
   '80000000-0000-0000-0000-000000000007',
   0, 'Khách doanh nghiệp được tạo', '2026-01-05 00:00:00'),

  ('a0000000-0000-0000-0000-000000000004',
   '80000000-0000-0000-0000-000000000005',
   3, 'Hạng thành viên nâng lên Vàng', '2026-03-15 00:00:00');


-- ============================================================
-- [4] USER SERVICE — hvt_user_db
-- Thêm warehouse01 + cashier01
-- (admin / sale01 / manager01 đã được DataSeeder tạo tự động)
-- ============================================================

USE hvt_user_db;

-- BCrypt hash của "123456" với work factor 11.
-- Nếu login bị lỗi invalid credentials, tạo user qua API POST /api/v1/users
-- hoặc chạy BCrypt.Net.BCrypt.HashPassword("123456") và thay thế hash bên dưới.
SET @HASH = '$2a$11$K7iDQNrHH.t.RRn2A8Gx.urIE7r9L6gMFCb5j1Q4jfDDENy1hYi';

SET @WH_ROLE_ID   = (SELECT Id FROM Roles WHERE RoleName = 'Warehouse' AND IsDeleted = 0 LIMIT 1);
SET @SALE_ROLE_ID = (SELECT Id FROM Roles WHERE RoleName = 'Sale'      AND IsDeleted = 0 LIMIT 1);

-- warehouse01
SET @WH_UID = 'aaaa0001-0000-0000-0000-000000000001';

INSERT IGNORE INTO Users
  (Id, Username, PasswordHash, IsActive, IsDeleted, CreatedAt)
VALUES
  (@WH_UID, 'warehouse01', @HASH, 1, 0, NOW());

INSERT IGNORE INTO Employees
  (UserId, FullName, Department, ActualSalary, Status, IsDeleted, CreatedAt)
SELECT @WH_UID, 'Nguyễn Văn Kho', 'Kho', 9500000, 0, 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM Employees WHERE UserId = @WH_UID);

INSERT IGNORE INTO UserRoles (UserId, RoleId)
  SELECT @WH_UID, @WH_ROLE_ID
  WHERE @WH_ROLE_ID IS NOT NULL;

-- cashier01
SET @CS_UID = 'aaaa0001-0000-0000-0000-000000000002';

INSERT IGNORE INTO Users
  (Id, Username, PasswordHash, IsActive, IsDeleted, CreatedAt)
VALUES
  (@CS_UID, 'cashier01', @HASH, 1, 0, NOW());

INSERT IGNORE INTO Employees
  (UserId, FullName, Department, ActualSalary, Status, IsDeleted, CreatedAt)
SELECT @CS_UID, 'Lê Thị Thu Ngân', 'Bán hàng', 8000000, 0, 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM Employees WHERE UserId = @CS_UID);

INSERT IGNORE INTO UserRoles (UserId, RoleId)
  SELECT @CS_UID, @SALE_ROLE_ID
  WHERE @SALE_ROLE_ID IS NOT NULL;


-- ============================================================
-- TÓM TẮT SEED DATA
-- ============================================================
-- Tài khoản (mật khẩu: 123456):
--   admin        — Admin     (giám sát + IAM + duyệt nhẹ; không vận hành bán/kho)
--   sale01       — Sale      (bán hàng)
--   manager01    — Manager   (quản lý)
--   warehouse01  — Warehouse (thủ kho) ← thêm bởi script này
--   cashier01    — Sale      (thu ngân POS) ← thêm bởi script này
--
-- Sản phẩm đã sync cửa hàng (SyncedToStoreAt ≠ NULL → hiện trong POS):
--   TRA-SEN-100G   Trà Sen Tây Hồ 100g       giá 185.000   tồn CH:  40 / kho: 180
--   TRA-SEN-250G   Trà Sen Tây Hồ 250g       giá 420.000   tồn CH:  25 / kho:  90
--   TRA-OL-100G    Trà Ô Long Cao Sơn 100g   giá 145.000   tồn CH:  60 / kho: 250
--   TRA-OL-250G    Trà Ô Long Cao Sơn 250g   giá 330.000   tồn CH:  35 / kho: 120000 g
--   HTRA-DHB-100G  Hồng Trà Đại Hồng Bào 100g giá 220.000  tồn CH:  30 / kho: 140
--
-- Nguyên liệu (chỉ kho tổng):
--   NL-TRAXANH-1KG  Trà xanh thô 1kg      kho: 150000 g
--   NL-HOASEN-1KG   Hoa sen khô 1kg       kho:  60000 g
--   NL-OLONG-1KG    Lá trà ô long thô 1kg kho: 120000 g
--
-- BOM (lệnh sản xuất):
--   TRA-SEN-100G ← 90 g NL-TRAXANH + 20 g NL-HOASEN
--   TRA-SEN-250G ← 230 g NL-TRAXANH + 50 g NL-HOASEN
--   TRA-OL-100G  ← 100 g NL-OLONG
--   TRA-OL-250G  ← 250 g NL-OLONG
--
-- Bảng giá:
--   PB-LE-2026  Giá lẻ  (khách phổ thông & đối ngoại)
--   PB-SI-2026  Giá sỉ  (doanh nghiệp, giảm ~12%)
--
-- Khách hàng: 6 lẻ / 2 doanh nghiệp
--   KH-DN-001 Nhà hàng Phố Cổ    công nợ: 12.000.000đ
--   KH-DN-002 Khách sạn Ánh Dương công nợ: 0đ
--
-- Kịch bản test gợi ý:
--   1. Login cashier01 → POS → bán TRA-SEN-100G cho KH-000001
--   2. Login warehouse01 → Kho → xuất 50 gói TRA-SEN-100G từ LOT-20260101
--   3. Tạo lệnh SX: FinishedSku=TRA-SEN-100G, Qty=100 → xem BOM NL-TRAXANH/NL-HOASEN giảm
--   4. Gọi POST /api/v1/catalog/sync để kiểm tra SyncedToStoreAt được set
--   5. Tạo đơn hàng doanh nghiệp cho KH-DN-001 → kiểm tra công nợ tăng
-- ============================================================
