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
   1, 'THANH_PHAM', 'Trà Tiết Quan', 'Trung Quốc', 'Thanh mát, hương hoa nhẹ',
   'Trà ô long cao cấp Tiết Quan, thu hoạch tay từ vùng Phúc Kiến.',
   'Gói', 200, 'g', 1, 1, 0, '2026-01-01 00:00:00'),

  ('10000000-0000-0000-0000-000000000002',
   2, 'THANH_PHAM', 'Cà phê hòa tan G7', 'Việt Nam', 'Đậm đà, thơm nồng',
   'Cà phê hòa tan G7 3in1 đặc trưng Việt Nam, dạng túi tiện lợi.',
   'Gói', 17, 'g', 1, 1, 0, '2026-01-01 00:00:00'),

  ('10000000-0000-0000-0000-000000000003',
   1, 'THANH_PHAM', 'Trà Ô Long đặc biệt', 'Đài Loan', 'Ngọt dịu, hậu vị thơm',
   'Trà ô long từ vùng cao Đài Loan, cân bằng vị đắng và ngọt.',
   'Gói', 100, 'g', 0, 1, 0, '2026-01-01 00:00:00'),

  -- ── NGUYÊN LIỆU ─────────────────────────────────────────
  ('10000000-0000-0000-0000-000000000011',
   4, 'NGUYEN_LIEU', 'Trà xanh nguyên liệu', 'Thái Nguyên', NULL,
   'Búp trà xanh khô từ vùng chè Thái Nguyên.',
   'Kg', 1, 'kg', 0, 1, 0, '2026-01-01 00:00:00'),

  ('10000000-0000-0000-0000-000000000012',
   5, 'NGUYEN_LIEU', 'Đường trắng tinh luyện', 'Việt Nam', NULL,
   'Đường trắng tinh luyện dùng pha chế và sản xuất.',
   'Kg', 1, 'kg', 0, 1, 0, '2026-01-01 00:00:00');

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
  -- Trà Tiết Quan 200g
  ('20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   'TRA-TQ-200G', '8934673200001', 'Trà Tiết Quan 200g',
   '{"Khối lượng":"200g"}',
   60000, 120000, 20, 500, 1, 1, 1, NULL,
   200, '2026-01-01 00:00:00', 0, '2026-01-01 00:00:00'),

  -- Trà Tiết Quan 500g
  ('20000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000001',
   'TRA-TQ-500G', '8934673200002', 'Trà Tiết Quan 500g',
   '{"Khối lượng":"500g"}',
   130000, 280000, 10, 200, 1, 1, 1, NULL,
   500, '2026-01-01 00:00:00', 0, '2026-01-01 00:00:00'),

  -- Cà phê G7 hộp 10 gói
  ('20000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000002',
   'CF-G7-10GOI', '8934673200003', 'Cà phê G7 3in1 — hộp 10 gói',
   '{"Số lượng":"10 gói"}',
   30000, 65000, 30, 1000, 1, 1, 1, NULL,
   170, '2026-01-01 00:00:00', 0, '2026-01-01 00:00:00'),

  -- Cà phê G7 hộp 20 gói
  ('20000000-0000-0000-0000-000000000004',
   '10000000-0000-0000-0000-000000000002',
   'CF-G7-20GOI', '8934673200004', 'Cà phê G7 3in1 — hộp 20 gói',
   '{"Số lượng":"20 gói"}',
   55000, 120000, 20, 500, 1, 1, 1, NULL,
   340, '2026-01-01 00:00:00', 0, '2026-01-01 00:00:00'),

  -- Trà Ô Long 100g
  ('20000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000003',
   'TRA-OL-100G', '8934673200005', 'Trà Ô Long đặc biệt 100g',
   '{"Khối lượng":"100g"}',
   45000, 95000, 30, 600, 1, 1, 1, NULL,
   100, '2026-01-01 00:00:00', 0, '2026-01-01 00:00:00'),

  -- Nguyên liệu: Trà xanh 1kg (KHÔNG sync cửa hàng)
  ('20000000-0000-0000-0000-000000000011',
   '10000000-0000-0000-0000-000000000011',
   'NL-TRA-1KG', NULL, 'Trà xanh nguyên liệu 1kg',
   '{"Khối lượng":"1kg"}',
   120000, 180000, 50, 2000, 0, 0, 1, NULL,
   1000, NULL, 0, '2026-01-01 00:00:00'),

  -- Nguyên liệu: Đường 1kg
  ('20000000-0000-0000-0000-000000000012',
   '10000000-0000-0000-0000-000000000012',
   'NL-DUONG-1KG', NULL, 'Đường trắng tinh luyện 1kg',
   '{"Khối lượng":"1kg"}',
   15000, 20000, 50, 5000, 0, 0, 1, NULL,
   1000, NULL, 0, '2026-01-01 00:00:00');

-- ----------------------------------------------------------
-- ProductUnits
-- ----------------------------------------------------------

INSERT IGNORE INTO ProductUnits
  (Id, ProductId, VariantId, UnitName, ConversionRate, Price,
   Barcode, IsDirectSell, IsBaseUnit, IsDeleted, CreatedAt)
VALUES
  -- TRA-TQ-200G ─ Gói (base) + Thùng 12
  ('30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   'Gói', 1, 120000, NULL, 1, 1, 0, '2026-01-01 00:00:00'),

  ('30000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   'Thùng', 12, 1320000, NULL, 0, 0, 0, '2026-01-01 00:00:00'),

  -- TRA-TQ-500G ─ Hộp (base) + Thùng 6
  ('30000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002',
   'Hộp', 1, 280000, NULL, 1, 1, 0, '2026-01-01 00:00:00'),

  ('30000000-0000-0000-0000-000000000004',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002',
   'Thùng', 6, 1596000, NULL, 0, 0, 0, '2026-01-01 00:00:00'),

  -- CF-G7-10GOI ─ Hộp (base) + Thùng 12
  ('30000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000003',
   'Hộp', 1, 65000, NULL, 1, 1, 0, '2026-01-01 00:00:00'),

  ('30000000-0000-0000-0000-000000000006',
   '10000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000003',
   'Thùng', 12, 720000, NULL, 0, 0, 0, '2026-01-01 00:00:00'),

  -- CF-G7-20GOI ─ Hộp (base)
  ('30000000-0000-0000-0000-000000000007',
   '10000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000004',
   'Hộp', 1, 120000, NULL, 1, 1, 0, '2026-01-01 00:00:00'),

  -- TRA-OL-100G ─ Gói (base)
  ('30000000-0000-0000-0000-000000000008',
   '10000000-0000-0000-0000-000000000003',
   '20000000-0000-0000-0000-000000000005',
   'Gói', 1, 95000, NULL, 1, 1, 0, '2026-01-01 00:00:00'),

  -- NL-TRA-1KG ─ Kg (base, không bán lẻ)
  ('30000000-0000-0000-0000-000000000011',
   '10000000-0000-0000-0000-000000000011',
   '20000000-0000-0000-0000-000000000011',
   'Kg', 1, 180000, NULL, 0, 1, 0, '2026-01-01 00:00:00'),

  -- NL-DUONG-1KG ─ Kg (base, không bán lẻ)
  ('30000000-0000-0000-0000-000000000012',
   '10000000-0000-0000-0000-000000000012',
   '20000000-0000-0000-0000-000000000012',
   'Kg', 1, 20000, NULL, 0, 1, 0, '2026-01-01 00:00:00');

-- ----------------------------------------------------------
-- ProductVariantBomLines  (int Id, auto-increment)
-- BOM: cần bao nhiêu nguyên liệu để tạo 1 đơn vị thành phẩm
-- ----------------------------------------------------------

INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, IsDeleted, CreatedAt)
SELECT
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000011',
  0.19, 0, '2026-01-01 00:00:00'
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
  0.005, 0, '2026-01-01 00:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM ProductVariantBomLines
  WHERE ProductVariantId = '20000000-0000-0000-0000-000000000001'
    AND MaterialId = '10000000-0000-0000-0000-000000000012'
);

INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, IsDeleted, CreatedAt)
SELECT
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000011',
  0.47, 0, '2026-01-01 00:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM ProductVariantBomLines
  WHERE ProductVariantId = '20000000-0000-0000-0000-000000000002'
    AND MaterialId = '10000000-0000-0000-0000-000000000011'
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
   125000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000002',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', NULL,
   285000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000003',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', NULL,
   68000,  1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000004',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', NULL,
   125000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000005',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', NULL,
   98000,  1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  -- ── Bảng giá sỉ (giảm ~12-14%)
  ('50000000-0000-0000-0000-000000000011',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', NULL,
   106000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000012',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', NULL,
   245000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000013',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', NULL,
   58000,  1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000014',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', NULL,
   108000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00'),

  ('50000000-0000-0000-0000-000000000015',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005', NULL,
   83000,  1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, '2026-01-01 00:00:00');


-- ============================================================
-- [2] INVENTORY SERVICE — hvt_inventory_db
-- ============================================================

USE hvt_inventory_db;

-- ----------------------------------------------------------
-- SkuStocks  (SkuId = ProductVariant.Id)
-- QuantityOnHand     = tồn tại cửa hàng (POS trừ vào đây)
-- WarehouseQuantityOnHand = tồn kho tổng (tính từ WarehouseBatchItems)
-- ----------------------------------------------------------

INSERT IGNORE INTO SkuStocks
  (SkuId, SkuCode, WeightInGrams,
   QuantityOnHand, WarehouseQuantityOnHand, LowStockThreshold,
   CreatedAt, UpdatedAt)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'TRA-TQ-200G',  200,   50,  200, 20, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000002', 'TRA-TQ-500G',  500,   30,  100, 10, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000003', 'CF-G7-10GOI',  170,  100,  500, 30, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000004', 'CF-G7-20GOI',  340,   60,  300, 20, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000005', 'TRA-OL-100G',  100,   80,  400, 30, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000011', 'NL-TRA-1KG',  1000,    0,  150, 50, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('20000000-0000-0000-0000-000000000012', 'NL-DUONG-1KG',1000,    0,  200, 50, '2026-01-01 00:00:00', '2026-01-01 00:00:00');

-- ----------------------------------------------------------
-- WarehouseBatches
-- ----------------------------------------------------------

INSERT IGNORE INTO WarehouseBatches
  (Id, LotCode, Supplier, ExpiresAt, Note, Status, CreatedBy, CreatedAt, UpdatedAt)
VALUES
  ('60000000-0000-0000-0000-000000000001',
   'LOT-20260101', 'Cty TNHH Trà Thái Nguyên',
   '2027-01-01 00:00:00',
   'Lô nhập đầu năm 2026 — trà và nguyên liệu',
   'active', '00000000-0000-0000-0000-000000000001',
   '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('60000000-0000-0000-0000-000000000002',
   'LOT-20260601', 'Cty TNHH Cà Phê Việt Ngon',
   '2027-06-01 00:00:00',
   'Lô nhập tháng 6 — bổ sung cà phê G7',
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
  -- LOT-20260101 (trà + nguyên liệu)
  ('70000000-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'TRA-TQ-200G',
   'Trà Tiết Quan 200g', 200, 300, 60000, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000002',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002', 'TRA-TQ-500G',
   'Trà Tiết Quan 500g', 100, 150, 130000, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000003',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000003', 'CF-G7-10GOI',
   'Cà phê G7 hộp 10 gói', 300, 400, 30000, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000004',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000005', 'TRA-OL-100G',
   'Trà Ô Long đặc biệt 100g', 400, 500, 45000, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000005',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000011', 'NL-TRA-1KG',
   'Trà xanh nguyên liệu 1kg', 150, 200, 120000, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000006',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000012', 'NL-DUONG-1KG',
   'Đường trắng tinh luyện 1kg', 200, 300, 15000, '2026-01-01 08:00:00', '2026-01-01 08:00:00'),

  -- LOT-20260601 (cà phê bổ sung)
  ('70000000-0000-0000-0000-000000000007',
   '60000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000003', 'CF-G7-10GOI',
   'Cà phê G7 hộp 10 gói', 200, 200, 31000, '2026-06-01 08:00:00', '2026-06-01 08:00:00'),

  ('70000000-0000-0000-0000-000000000008',
   '60000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000004', 'CF-G7-20GOI',
   'Cà phê G7 hộp 20 gói', 300, 300, 56000, '2026-06-01 08:00:00', '2026-06-01 08:00:00');


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
--   admin        — Admin     (toàn quyền)
--   sale01       — Sale      (bán hàng)
--   manager01    — Manager   (quản lý)
--   warehouse01  — Warehouse (thủ kho) ← thêm bởi script này
--   cashier01    — Sale      (thu ngân POS) ← thêm bởi script này
--
-- Sản phẩm đã sync cửa hàng (SyncedToStoreAt ≠ NULL → hiện trong POS):
--   TRA-TQ-200G  Trà Tiết Quan 200g      giá 120.000   tồn CH:  50 / kho: 200
--   TRA-TQ-500G  Trà Tiết Quan 500g      giá 280.000   tồn CH:  30 / kho: 100
--   CF-G7-10GOI  Cà phê G7 10 gói       giá  65.000   tồn CH: 100 / kho: 500
--   CF-G7-20GOI  Cà phê G7 20 gói       giá 120.000   tồn CH:  60 / kho: 300
--   TRA-OL-100G  Trà Ô Long 100g         giá  95.000   tồn CH:  80 / kho: 400
--
-- Nguyên liệu (chỉ kho tổng):
--   NL-TRA-1KG   Trà xanh 1kg            kho: 150
--   NL-DUONG-1KG Đường 1kg               kho: 200
--
-- BOM (lệnh sản xuất):
--   TRA-TQ-200G ← 0.19 kg NL-TRA + 0.005 kg NL-DUONG
--   TRA-TQ-500G ← 0.47 kg NL-TRA
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
--   1. Login cashier01 → POS → bán TRA-TQ-200G cho KH-000001
--   2. Login warehouse01 → Kho → xuất 50 gói TRA-TQ-200G từ LOT-20260101
--   3. Tạo lệnh SX: FinishedSku=TRA-TQ-200G, Qty=100 → xem BOM NL-TRA giảm
--   4. Gọi POST /api/v1/catalog/sync để kiểm tra SyncedToStoreAt được set
--   5. Tạo đơn hàng doanh nghiệp cho KH-DN-001 → kiểm tra công nợ tăng
-- ============================================================
