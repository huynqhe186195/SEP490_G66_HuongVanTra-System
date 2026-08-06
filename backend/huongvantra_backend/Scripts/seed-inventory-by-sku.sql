-- =============================================================================
-- Phase B — Seed inventory-only theo SkuCode (KHÔNG tạo Product/SKU)
-- Prerequisites:
--   1) ProductService + InventoryService đã migrate
--   2) Đã chạy seed-hvt-categories
--   3) Đã import + approve Excel catalog Hương Vân (SkuCode HVT-*/NL-*/BB-*)
-- Runner:
--   .\Scripts\run-seed-inventory-by-sku.ps1
-- Idempotent: xóa lô HVT-LOT-* / HVT-SHELF-* rồi insert lại; UPSERT SkuStocks.
-- BOM: không seed — dùng BOM từ Excel approve.
-- Soft-deprecated: seed-catalog-inventory-realistic.sql (Matcha/Ceylon path cũ).
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET @NOW = UTC_TIMESTAMP(6);
SET @SEED_USER = '00000000-0000-0000-0000-000000000000';

-- Toan bo temp table nam trong inventory_db de khong mat khi chuyen schema.
USE `hvt_inventory_db`;

DROP TEMPORARY TABLE IF EXISTS _phase_b_seed_skus;
CREATE TEMPORARY TABLE _phase_b_seed_skus (
  SkuCode varchar(50) NOT NULL PRIMARY KEY,
  SkuType varchar(8) NOT NULL,
  DisplayName varchar(255) NOT NULL,
  UnitCost decimal(18,2) NOT NULL,
  WeightInGrams int NOT NULL,
  ShelfQty int NOT NULL,
  WarehouseQty int NOT NULL
);

INSERT INTO _phase_b_seed_skus
  (SkuCode, SkuType, DisplayName, UnitCost, WeightInGrams, ShelfQty, WarehouseQty)
VALUES
  ('NL-TRA-XANH-G', 'NL', 'Trà xanh thô Tân Cương', 180, 1, 0, 50000),
  ('NL-HONG-TRA-G', 'NL', 'Hồng trà thô Hương Vân', 220, 1, 0, 30000),
  ('NL-HOA-BUOI-G', 'NL', 'Hoa bưởi sấy', 900, 1, 0, 8000),
  ('NL-HOA-SEN-G', 'NL', 'Hoa sen sấy', 1200, 1, 0, 8000),
  ('BB-TUI-TRA', 'BB', 'Túi trà thực phẩm', 1500, 0, 0, 2000),
  ('BB-HOP-GIAY-HVT', 'BB', 'Hộp giấy Hương Vân', 5000, 0, 0, 1200),
  ('BB-HU-SU-HVT', 'BB', 'Hũ sứ đựng trà', 45000, 0, 0, 400),
  ('BB-HOP-QUA-HVT', 'BB', 'Hộp quà cứng Hương Vân', 50000, 0, 0, 350),
  ('BB-TEM-HVT', 'BB', 'Tem chống giả Hương Vân', 300, 0, 0, 5000),
  ('HVT-HONGTRA-100G', 'FG', 'Hồng Trà Hương Vân', 75000, 0, 28, 90),
  ('HVT-HONGTRA-1KG', 'FG', 'Hồng Trà Hương Vân', 750000, 0, 8, 35),
  ('HVT-HONGTRA-50G-HU', 'FG', 'Hồng Trà Hũ Sứ 50g', 137500, 0, 12, 40),
  ('HVT-HOABUOI-100G', 'FG', 'Trà Ướp Hoa Bưởi', 137500, 0, 22, 70),
  ('HVT-HOABUOI-500G', 'FG', 'Trà Ướp Hoa Bưởi', 687500, 0, 6, 24),
  ('HVT-TRAVON-100G', 'FG', 'Trà Vón – Trà Ký Ức', 75000, 0, 30, 85),
  ('HVT-TRAVON-500G', 'FG', 'Trà Vón – Trà Ký Ức', 375000, 0, 10, 36),
  ('HVT-THAOMOC-50G', 'FG', 'Trà Hoa Thảo Mộc', 20000, 0, 35, 100),
  ('HVT-THAOMOC-500G', 'FG', 'Trà Hoa Thảo Mộc', 200000, 0, 12, 40),
  ('HVT-THANHHOA-100G', 'FG', 'Thanh Hoa Trà', 75000, 0, 26, 80),
  ('HVT-THANHHOA-200G', 'FG', 'Thanh Hoa Trà', 150000, 0, 14, 45),
  ('HVT-SEN-THANGHOA', 'FG', 'Trà Sen Sấy Thăng Hoa', 60000, 0, 20, 60),
  ('HVT-HUONGTRA-100G', 'FG', 'Hương Trà Hương Vân', 87500, 0, 40, 120),
  ('HVT-NGOCXUAN-100G', 'FG', 'Ngọc Xuân Trà – Trà Đinh', 375000, 0, 10, 30),
  ('HVT-NGOCXUAN-200G', 'FG', 'Ngọc Xuân Trà – Trà Đinh', 750000, 0, 5, 18),
  ('HVT-TAMPHUC-100G', 'FG', 'Tam Phúc Trà – Trà Móc Câu', 75000, 0, 28, 90),
  ('HVT-TAMPHUC-500G', 'FG', 'Tam Phúc Trà – Trà Móc Câu', 375000, 0, 8, 28),
  ('HVT-LUCBAO', 'FG', 'Trà Lục Bảo', 1075000, 0, 4, 12),
  ('HVT-NONTOM-100G', 'FG', 'Hộp Trà Nõn Tôm Cao Cấp', 200000, 0, 12, 40),
  ('HVT-NONTOM-500G', 'FG', 'Hộp Trà Nõn Tôm Cao Cấp', 1000000, 0, 4, 14),
  ('HVT-SET-TRONGDONG', 'FG', 'Hộp Trà Trống Đồng Hương Vân', 125000, 0, 10, 30),
  ('HVT-SET-HUONGTRA-DB', 'FG', 'Hộp Hương Trà Đặc Biệt', 425000, 0, 6, 20),
  ('HVT-SET-TUIGAM', 'FG', 'Túi Gấm Trà Cao Cấp', 400000, 0, 6, 18),
  ('HVT-SET-GO-DA', 'FG', 'Hộp Trà Gỗ Bọc Da Cao Cấp', 425000, 0, 5, 16),
  ('HVT-SET-VANGO', 'FG', 'Hộp Trà Vân Gỗ Cao Cấp', 450000, 0, 5, 16),
  ('HVT-SET-NAPGO', 'FG', 'Hộp Trà Nắp Gỗ Cao Cấp', 400000, 0, 6, 18),
  ('HVT-SET-DOANVIEN', 'FG', 'Hộp Trà Đoàn Viên Cao Cấp', 900000, 0, 3, 10),
  ('HVT-KEOTRA', 'FG', 'Kẹo Trà Hương Vân', 150000, 0, 18, 50),
  ('HVT-CHELAM-MATCHA', 'FG', 'Chè Lam Matcha', 47500, 0, 25, 70),
  ('HVT-HOATRA-50', 'FG', 'Hoa Trà Hương Vân', 250000, 0, 8, 24),
  ('HVT-HOATRA-100', 'FG', 'Hoa Trà Hương Vân', 500000, 0, 5, 16),
  ('HVT-TONG-THUY-TINH', 'FG', 'Tống Thủy Tinh Trong', 210000, 0, 10, 30),
  ('HVT-TONG-NAU-DO', 'FG', 'Tống Nâu Đỏ', 52500, 0, 14, 40),
  ('HVT-TONG-QUAI-GO', 'FG', 'Tống Quai Gỗ To', 150000, 0, 10, 28),
  ('HVT-XUC-TRE', 'FG', 'Xúc Trà Tre', 17500, 0, 30, 80),
  ('HVT-XUC-DONG-GO', 'FG', 'Xúc Trà Đồng Cán Gỗ Lẻ', 22500, 0, 24, 70),
  ('HVT-XUC-GO-NAU', 'FG', 'Xúc Trà Gỗ Nâu', 40000, 0, 20, 55),
  ('HVT-XUC-VANG-DEN', 'FG', 'Xúc Trà Vàng Chuôi Đen', 100000, 0, 12, 35),
  ('HVT-XUC-CHUOI-RONG', 'FG', 'Xúc Trà Chuôi Rồng', 47500, 0, 16, 45);

DROP TEMPORARY TABLE IF EXISTS _phase_b_missing;
CREATE TEMPORARY TABLE _phase_b_missing AS
SELECT s.SkuCode
FROM _phase_b_seed_skus s
LEFT JOIN hvt_product_db.ProductVariants v
  ON v.SkuCode = s.SkuCode AND v.IsDeleted = 0
WHERE v.Id IS NULL
ORDER BY s.SkuCode;

SELECT COUNT(*) INTO @phase_b_missing_count FROM _phase_b_missing;
SELECT GROUP_CONCAT(SkuCode ORDER BY SkuCode SEPARATOR ', ') INTO @phase_b_missing_list
FROM _phase_b_missing;

DROP PROCEDURE IF EXISTS sp_phase_b_require_catalog;
DELIMITER $$
CREATE PROCEDURE sp_phase_b_require_catalog()
BEGIN
  DECLARE msg VARCHAR(512);
  IF IFNULL(@phase_b_missing_count, 0) > 0 THEN
    SET msg = CONCAT(
      'Phase B aborted: missing ', @phase_b_missing_count,
      ' SkuCode(s). Import/approve Excel catalog first. Missing: ',
      LEFT(IFNULL(@phase_b_missing_list, ''), 380)
    );
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = msg;
  END IF;
END$$
DELIMITER ;
CALL sp_phase_b_require_catalog();
DROP PROCEDURE IF EXISTS sp_phase_b_require_catalog;

DROP TEMPORARY TABLE IF EXISTS _phase_b_resolved_raw;
CREATE TEMPORARY TABLE _phase_b_resolved_raw AS
SELECT
  s.SkuCode,
  s.SkuType,
  s.DisplayName,
  s.UnitCost,
  s.WeightInGrams,
  s.ShelfQty,
  s.WarehouseQty,
  v.Id AS SkuId,
  v.UpdatedAt AS VariantUpdatedAt,
  COALESCE(NULLIF(TRIM(p.Name), ''), s.DisplayName) AS ProductName
FROM _phase_b_seed_skus s
INNER JOIN hvt_product_db.ProductVariants v
  ON v.SkuCode = s.SkuCode AND v.IsDeleted = 0
INNER JOIN hvt_product_db.Products p
  ON p.Id = v.ProductId;

-- Neu cung SkuCode con nhieu ban ghi, giu ban cap nhat moi nhat (tranh reopen temp table).
DROP TEMPORARY TABLE IF EXISTS _phase_b_resolved;
CREATE TEMPORARY TABLE _phase_b_resolved AS
SELECT
  SkuCode, SkuType, DisplayName, UnitCost, WeightInGrams, ShelfQty, WarehouseQty, SkuId, ProductName
FROM (
  SELECT
    r.*,
    ROW_NUMBER() OVER (PARTITION BY r.SkuCode ORDER BY r.VariantUpdatedAt DESC, r.SkuId DESC) AS rn
  FROM _phase_b_resolved_raw r
) ranked
WHERE ranked.rn = 1;

DROP TEMPORARY TABLE IF EXISTS _phase_b_resolved_raw;

INSERT INTO SkuStocks
  (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, ReservedQuantity,
   LowStockThreshold, WarehouseLowStockThreshold, ShelfLowStockThreshold, CreatedAt, UpdatedAt)
SELECT
  r.SkuId,
  r.SkuCode,
  r.WeightInGrams,
  r.ShelfQty,
  r.WarehouseQty,
  0,
  CASE WHEN r.SkuType = 'FG' THEN 5 ELSE 20 END,
  CASE WHEN r.SkuType = 'FG' THEN 20 WHEN r.SkuType = 'NL' THEN 5000 ELSE 100 END,
  CASE WHEN r.SkuType = 'FG' THEN 5 ELSE 0 END,
  @NOW,
  @NOW
FROM _phase_b_resolved r
ON DUPLICATE KEY UPDATE
  SkuCode = VALUES(SkuCode),
  WeightInGrams = VALUES(WeightInGrams),
  QuantityOnHand = VALUES(QuantityOnHand),
  WarehouseQuantityOnHand = VALUES(WarehouseQuantityOnHand),
  LowStockThreshold = VALUES(LowStockThreshold),
  WarehouseLowStockThreshold = VALUES(WarehouseLowStockThreshold),
  ShelfLowStockThreshold = VALUES(ShelfLowStockThreshold),
  UpdatedAt = @NOW;

-- Xoa lo seed Phase B cu (idempotent re-run)
DELETE wbi FROM WarehouseBatchItems wbi
INNER JOIN WarehouseBatches wb ON wb.Id = wbi.WarehouseBatchId
WHERE wb.LotCode LIKE 'HVT-LOT-%' OR wb.LotCode LIKE 'HVT-SHELF-%';

DELETE FROM WarehouseBatches
WHERE LotCode LIKE 'HVT-LOT-%' OR LotCode LIKE 'HVT-SHELF-%';

DROP TEMPORARY TABLE IF EXISTS _phase_b_batches;
CREATE TEMPORARY TABLE _phase_b_batches (
  Id char(36) NOT NULL PRIMARY KEY,
  LotCode varchar(50) NOT NULL,
  SkuCode varchar(50) NOT NULL,
  Supplier varchar(255) NULL,
  ExpiresAt datetime(6) NULL,
  Note varchar(500) NULL,
  Location varchar(32) NOT NULL
);

INSERT INTO _phase_b_batches (Id, LotCode, SkuCode, Supplier, ExpiresAt, Note, Location)
VALUES
  ('cebcdfe9-91e8-4531-a4a4-386a96bc8b95', 'HVT-LOT-NL-TRA-XANH-G-1', 'NL-TRA-XANH-G', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('f3d93c53-59c1-4c4f-acae-863dad506b87', 'HVT-LOT-NL-TRA-XANH-G-2', 'NL-TRA-XANH-G', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('bfb0e5a0-b5d3-460b-aec1-7cfcf7564ae0', 'HVT-LOT-NL-HONG-TRA-G-1', 'NL-HONG-TRA-G', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('d9ea7057-8b5d-4275-a3d3-71d127175b5e', 'HVT-LOT-NL-HONG-TRA-G-2', 'NL-HONG-TRA-G', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('12661ac7-5b12-43e3-ab3a-5145eb7595cc', 'HVT-LOT-NL-HOA-BUOI-G-1', 'NL-HOA-BUOI-G', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('f0164daf-ab28-46e9-a15f-a98ea7236b86', 'HVT-LOT-NL-HOA-BUOI-G-2', 'NL-HOA-BUOI-G', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('890fbd41-5f62-4fa0-ac5d-49658fa2b66c', 'HVT-LOT-NL-HOA-SEN-G-1', 'NL-HOA-SEN-G', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('68c9b8af-fdf8-4dbd-aa16-f052bbf4172e', 'HVT-LOT-NL-HOA-SEN-G-2', 'NL-HOA-SEN-G', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('992321bd-5f2b-44ed-ac25-ca7ef2677b6e', 'HVT-LOT-BB-TUI-TRA-1', 'BB-TUI-TRA', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('33233cac-123e-4837-aeba-5c4fb1a2532c', 'HVT-LOT-BB-TUI-TRA-2', 'BB-TUI-TRA', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('d7f01d9e-f4db-44c7-a5b5-04662e01b4ce', 'HVT-LOT-BB-HOP-GIAY-HVT-1', 'BB-HOP-GIAY-HVT', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('7acde412-9fcb-45a2-a981-e073c68809d3', 'HVT-LOT-BB-HOP-GIAY-HVT-2', 'BB-HOP-GIAY-HVT', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('b44ed5d4-79ca-442c-aba3-a449b438930d', 'HVT-LOT-BB-HU-SU-HVT-1', 'BB-HU-SU-HVT', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('720a5c50-b3d2-4227-abec-e30f91164951', 'HVT-LOT-BB-HU-SU-HVT-2', 'BB-HU-SU-HVT', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('79d091f8-d3c3-40c5-ab01-4ef1191b6a8d', 'HVT-LOT-BB-HOP-QUA-HVT-1', 'BB-HOP-QUA-HVT', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('e48ac3b3-175b-4a96-a41d-609848a36fcd', 'HVT-LOT-BB-HOP-QUA-HVT-2', 'BB-HOP-QUA-HVT', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('fb114886-0b66-4eae-a223-d8978ed0857a', 'HVT-LOT-BB-TEM-HVT-1', 'BB-TEM-HVT', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('dcb86032-8fa5-4f67-a478-a99526bd7ae9', 'HVT-LOT-BB-TEM-HVT-2', 'BB-TEM-HVT', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('add9d2fd-83e6-4743-a0a6-0262cb894935', 'HVT-LOT-HVT-HONGTRA-100G-1', 'HVT-HONGTRA-100G', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('43e7c8eb-bf9f-4b07-a3b9-406545bf65b0', 'HVT-LOT-HVT-HONGTRA-100G-2', 'HVT-HONGTRA-100G', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('ae744e11-5bc7-4419-a853-330291754295', 'HVT-SHELF-HVT-HONGTRA-100G', 'HVT-HONGTRA-100G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('b3f2d391-4ef6-4500-a359-2ff8e8a97dc2', 'HVT-LOT-HVT-HONGTRA-1KG-1', 'HVT-HONGTRA-1KG', 'Bao bì Minh Phát', '2028-08-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('aaa7d543-f14c-4fe7-acf8-32b8eb7232ce', 'HVT-LOT-HVT-HONGTRA-1KG-2', 'HVT-HONGTRA-1KG', 'Nội bộ Hương Vân', '2028-12-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('77380b03-9e05-4e13-a092-68b1d97dd18c', 'HVT-SHELF-HVT-HONGTRA-1KG', 'HVT-HONGTRA-1KG', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('8ebf2f46-2ff9-44b2-ac5d-e78acdf10de7', 'HVT-LOT-HVT-HONGTRA-50G-HU-1', 'HVT-HONGTRA-50G-HU', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('0136bc35-b88e-4b1b-ada4-21abf11dd811', 'HVT-LOT-HVT-HONGTRA-50G-HU-2', 'HVT-HONGTRA-50G-HU', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('292c0f2c-3f4f-4090-aad0-c66b81574249', 'HVT-SHELF-HVT-HONGTRA-50G-HU', 'HVT-HONGTRA-50G-HU', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('4f17492a-9e17-44f7-a748-0ee153623b25', 'HVT-LOT-HVT-HOABUOI-100G-1', 'HVT-HOABUOI-100G', 'HTX Chè Thái Nguyên', '2028-02-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('e1c2adb1-f5aa-4cd4-ac68-3dcd3eb556b5', 'HVT-LOT-HVT-HOABUOI-100G-2', 'HVT-HOABUOI-100G', 'HTX Hương Vân Trà', '2028-06-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('054d1c90-8f62-428a-aaa5-dda627919da4', 'HVT-SHELF-HVT-HOABUOI-100G', 'HVT-HOABUOI-100G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('c9de88c0-c50d-4561-a1f5-b6de491ac556', 'HVT-LOT-HVT-HOABUOI-500G-1', 'HVT-HOABUOI-500G', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('da2cf820-b469-4192-a90b-90395e0d9ab4', 'HVT-LOT-HVT-HOABUOI-500G-2', 'HVT-HOABUOI-500G', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('25e7ba9b-901a-4fce-ae33-227b47e15088', 'HVT-SHELF-HVT-HOABUOI-500G', 'HVT-HOABUOI-500G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('72b8bbcc-bfdb-4c1f-a5c6-9ab1616f7ad9', 'HVT-LOT-HVT-TRAVON-100G-1', 'HVT-TRAVON-100G', 'Bao bì Minh Phát', '2028-08-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('d2234c4c-f811-40cd-a42b-f3a8e7fd62ba', 'HVT-LOT-HVT-TRAVON-100G-2', 'HVT-TRAVON-100G', 'Nội bộ Hương Vân', '2028-12-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('654527b3-3def-409f-a3c1-7013488f95a7', 'HVT-SHELF-HVT-TRAVON-100G', 'HVT-TRAVON-100G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('7f5d3c99-fdd9-472a-a142-3284e8acaed9', 'HVT-LOT-HVT-TRAVON-500G-1', 'HVT-TRAVON-500G', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('94d69432-1666-43de-a6ff-9ed73cbf6cfd', 'HVT-LOT-HVT-TRAVON-500G-2', 'HVT-TRAVON-500G', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('afd9234c-2204-4f4e-a7dc-c8ab46afdc37', 'HVT-SHELF-HVT-TRAVON-500G', 'HVT-TRAVON-500G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('84e23c80-b244-455c-a953-bd097c830947', 'HVT-LOT-HVT-THAOMOC-50G-1', 'HVT-THAOMOC-50G', 'HTX Chè Thái Nguyên', '2028-02-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('f2eb3b98-6150-46df-a5f7-bab163e7a777', 'HVT-LOT-HVT-THAOMOC-50G-2', 'HVT-THAOMOC-50G', 'HTX Hương Vân Trà', '2028-06-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('0bd994d3-5b3c-44c2-ac5f-339ace271ead', 'HVT-SHELF-HVT-THAOMOC-50G', 'HVT-THAOMOC-50G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('aac59b40-33c2-47c1-aa08-a355bc27b62b', 'HVT-LOT-HVT-THAOMOC-500G-1', 'HVT-THAOMOC-500G', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('9344083e-e533-4de7-ab6a-7109f7164386', 'HVT-LOT-HVT-THAOMOC-500G-2', 'HVT-THAOMOC-500G', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('645e2f60-733c-423f-aeb0-19c79a346f91', 'HVT-SHELF-HVT-THAOMOC-500G', 'HVT-THAOMOC-500G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('ce99c412-7972-4456-a11b-f2d17541b7ca', 'HVT-LOT-HVT-THANHHOA-100G-1', 'HVT-THANHHOA-100G', 'Bao bì Minh Phát', '2028-08-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('ba039df6-31bd-49e4-a42b-a37282b66330', 'HVT-LOT-HVT-THANHHOA-100G-2', 'HVT-THANHHOA-100G', 'Nội bộ Hương Vân', '2028-12-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('f8ff6cd0-8ba0-4477-ad42-5a98bbb8f973', 'HVT-SHELF-HVT-THANHHOA-100G', 'HVT-THANHHOA-100G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('ef01932f-b7a8-4a81-a88c-c5a0be3a2deb', 'HVT-LOT-HVT-THANHHOA-200G-1', 'HVT-THANHHOA-200G', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('c6601fd9-76a8-478c-aa17-55a8840cf29b', 'HVT-LOT-HVT-THANHHOA-200G-2', 'HVT-THANHHOA-200G', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('b64864ca-57c8-4d3f-afaf-525c175ba78a', 'HVT-SHELF-HVT-THANHHOA-200G', 'HVT-THANHHOA-200G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('d1e20a4e-6166-4854-a763-60e12de886a0', 'HVT-LOT-HVT-SEN-THANGHOA-1', 'HVT-SEN-THANGHOA', 'HTX Chè Thái Nguyên', '2028-02-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('71f63509-ee5c-404b-afe5-eca15beadcb8', 'HVT-LOT-HVT-SEN-THANGHOA-2', 'HVT-SEN-THANGHOA', 'HTX Hương Vân Trà', '2028-06-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('40ef0eff-1310-4f33-af47-94f5edef6774', 'HVT-SHELF-HVT-SEN-THANGHOA', 'HVT-SEN-THANGHOA', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('e34c4c1d-63b3-4b2e-a0e2-1f060d93d335', 'HVT-LOT-HVT-HUONGTRA-100G-1', 'HVT-HUONGTRA-100G', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('29399993-70c3-44e4-a6e4-9b5f663b3f09', 'HVT-LOT-HVT-HUONGTRA-100G-2', 'HVT-HUONGTRA-100G', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('b98598af-75d8-4ff4-a441-1ffcf3c8cc14', 'HVT-SHELF-HVT-HUONGTRA-100G', 'HVT-HUONGTRA-100G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('6eb688c6-983b-4bdd-a590-61e09379bdf6', 'HVT-LOT-HVT-NGOCXUAN-100G-1', 'HVT-NGOCXUAN-100G', 'Bao bì Minh Phát', '2028-08-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('bd756ae9-8fbb-4e68-ac9d-981632417bae', 'HVT-LOT-HVT-NGOCXUAN-100G-2', 'HVT-NGOCXUAN-100G', 'Nội bộ Hương Vân', '2028-12-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('79e26d91-0260-4ccd-a4f2-3d4ddfc3e80c', 'HVT-SHELF-HVT-NGOCXUAN-100G', 'HVT-NGOCXUAN-100G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('56b62767-255b-4e61-a391-71493b310fec', 'HVT-LOT-HVT-NGOCXUAN-200G-1', 'HVT-NGOCXUAN-200G', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('27449e2e-43f8-4ab5-abcc-14b21c3d6554', 'HVT-LOT-HVT-NGOCXUAN-200G-2', 'HVT-NGOCXUAN-200G', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('a6b5f851-28f2-4cb7-a0d2-2dedaa5697b9', 'HVT-SHELF-HVT-NGOCXUAN-200G', 'HVT-NGOCXUAN-200G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('126f7648-8de2-4f49-a472-481fc9fbf781', 'HVT-LOT-HVT-TAMPHUC-100G-1', 'HVT-TAMPHUC-100G', 'HTX Chè Thái Nguyên', '2028-02-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('ad323813-c709-4f51-aa3a-2eef71876701', 'HVT-LOT-HVT-TAMPHUC-100G-2', 'HVT-TAMPHUC-100G', 'HTX Hương Vân Trà', '2028-06-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('f7bd2e9d-ab73-4c2f-aec1-407fddec2cfb', 'HVT-SHELF-HVT-TAMPHUC-100G', 'HVT-TAMPHUC-100G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('b0c2ed76-7588-4161-a69c-eccc0461e6be', 'HVT-LOT-HVT-TAMPHUC-500G-1', 'HVT-TAMPHUC-500G', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('7f536606-0034-43b2-a70c-da525ff175c6', 'HVT-LOT-HVT-TAMPHUC-500G-2', 'HVT-TAMPHUC-500G', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('6814222b-92bc-46ca-a77c-eaa66f98571f', 'HVT-SHELF-HVT-TAMPHUC-500G', 'HVT-TAMPHUC-500G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('c97a7b74-8410-48ba-ade4-c6e417c8ad03', 'HVT-LOT-HVT-LUCBAO-1', 'HVT-LUCBAO', 'Bao bì Minh Phát', '2028-08-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('d70672ca-aa72-4300-a343-a67abe77c29a', 'HVT-LOT-HVT-LUCBAO-2', 'HVT-LUCBAO', 'Nội bộ Hương Vân', '2028-12-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('bc96ed29-26bc-4689-a33b-b24ffd4357cb', 'HVT-SHELF-HVT-LUCBAO', 'HVT-LUCBAO', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('7d37d38b-6150-4a12-abaf-04702ec68580', 'HVT-LOT-HVT-NONTOM-100G-1', 'HVT-NONTOM-100G', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('071b22bb-4c8f-4ebf-acb2-4ca8215bf2f0', 'HVT-LOT-HVT-NONTOM-100G-2', 'HVT-NONTOM-100G', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('c031fe67-bf15-4515-ad38-2720c4ad93fe', 'HVT-SHELF-HVT-NONTOM-100G', 'HVT-NONTOM-100G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('93c1bdb3-d94e-499a-a54e-70f1bee0c05d', 'HVT-LOT-HVT-NONTOM-500G-1', 'HVT-NONTOM-500G', 'HTX Chè Thái Nguyên', '2028-02-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('d8327e25-f84e-4faf-aa5f-22e69816eeeb', 'HVT-LOT-HVT-NONTOM-500G-2', 'HVT-NONTOM-500G', 'HTX Hương Vân Trà', '2028-06-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('f43916e1-cd53-4087-a538-ea14fff4eeb6', 'HVT-SHELF-HVT-NONTOM-500G', 'HVT-NONTOM-500G', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('a9ba4c71-d6b3-4da4-a575-6ec43dc45a91', 'HVT-LOT-HVT-SET-TRONGDONG-1', 'HVT-SET-TRONGDONG', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('20547896-2612-4104-ae60-c8f6a7ec4540', 'HVT-LOT-HVT-SET-TRONGDONG-2', 'HVT-SET-TRONGDONG', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('9e43bf17-1ea8-490d-a730-dc8ef4da952f', 'HVT-SHELF-HVT-SET-TRONGDONG', 'HVT-SET-TRONGDONG', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('fd688e2d-3b19-4a1c-a5d3-b2639df73afd', 'HVT-LOT-HVT-SET-HUONGTRA-DB-1', 'HVT-SET-HUONGTRA-DB', 'Bao bì Minh Phát', '2028-08-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('c6a6ecf7-399f-4562-a333-bcb830b80cd0', 'HVT-LOT-HVT-SET-HUONGTRA-DB-2', 'HVT-SET-HUONGTRA-DB', 'Nội bộ Hương Vân', '2028-12-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('b81114e9-de5d-4d12-a11d-6cad46264cc1', 'HVT-SHELF-HVT-SET-HUONGTRA-DB', 'HVT-SET-HUONGTRA-DB', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('44691146-598b-4f45-aeb5-a638629d5318', 'HVT-LOT-HVT-SET-TUIGAM-1', 'HVT-SET-TUIGAM', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('e5998ab8-17e7-4f16-ab1d-b09c01fdb02c', 'HVT-LOT-HVT-SET-TUIGAM-2', 'HVT-SET-TUIGAM', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('9d50151c-080e-436b-a023-acde299a5f96', 'HVT-SHELF-HVT-SET-TUIGAM', 'HVT-SET-TUIGAM', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('ad99374c-06d6-4e49-acf7-14c5b94bd2b8', 'HVT-LOT-HVT-SET-GO-DA-1', 'HVT-SET-GO-DA', 'HTX Chè Thái Nguyên', '2028-02-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('f46596e5-6b15-4bc0-a8e2-8582fe52b134', 'HVT-LOT-HVT-SET-GO-DA-2', 'HVT-SET-GO-DA', 'HTX Hương Vân Trà', '2028-06-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('ae9dce22-b90d-4948-afff-7513eaa4507d', 'HVT-SHELF-HVT-SET-GO-DA', 'HVT-SET-GO-DA', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('4ca1ac4d-198a-43e7-a6b8-3cadb007cd6c', 'HVT-LOT-HVT-SET-VANGO-1', 'HVT-SET-VANGO', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('d1ea4fa8-3671-43f9-a7bd-c306ecb00caf', 'HVT-LOT-HVT-SET-VANGO-2', 'HVT-SET-VANGO', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('5e86adac-966d-4ed7-a11a-4d7fe4d6133c', 'HVT-SHELF-HVT-SET-VANGO', 'HVT-SET-VANGO', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('4245c390-edc0-4045-a3a7-e664ae592dc6', 'HVT-LOT-HVT-SET-NAPGO-1', 'HVT-SET-NAPGO', 'Bao bì Minh Phát', '2028-08-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('d087aea8-96b1-4af9-a755-5f86ffdd769a', 'HVT-LOT-HVT-SET-NAPGO-2', 'HVT-SET-NAPGO', 'Nội bộ Hương Vân', '2028-12-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('161af21d-797f-4df4-a31e-05583160e44d', 'HVT-SHELF-HVT-SET-NAPGO', 'HVT-SET-NAPGO', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('97ebb185-690d-4a11-a5a6-bc7fdaf3f987', 'HVT-LOT-HVT-SET-DOANVIEN-1', 'HVT-SET-DOANVIEN', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('5e4df25c-545b-4253-afb0-e57a81d551cc', 'HVT-LOT-HVT-SET-DOANVIEN-2', 'HVT-SET-DOANVIEN', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('b482556e-27a9-46ee-ae6b-73cc5aee0527', 'HVT-SHELF-HVT-SET-DOANVIEN', 'HVT-SET-DOANVIEN', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('3b6d45a6-bef3-4127-a261-ed1dcbd813c5', 'HVT-LOT-HVT-KEOTRA-1', 'HVT-KEOTRA', 'HTX Chè Thái Nguyên', '2028-02-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('119475f7-41d1-4aa2-a22b-2b2be2b28fe0', 'HVT-LOT-HVT-KEOTRA-2', 'HVT-KEOTRA', 'HTX Hương Vân Trà', '2028-06-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('28d27455-94c3-4ccc-aac9-37891949d8e3', 'HVT-SHELF-HVT-KEOTRA', 'HVT-KEOTRA', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('c5472f52-7523-4dee-a038-b2fa4f7c5313', 'HVT-LOT-HVT-CHELAM-MATCHA-1', 'HVT-CHELAM-MATCHA', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('e87cf2c7-13ab-4236-a7c8-9306b86bb197', 'HVT-LOT-HVT-CHELAM-MATCHA-2', 'HVT-CHELAM-MATCHA', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('808fcb1c-fc0e-4062-a707-265e0e7f601c', 'HVT-SHELF-HVT-CHELAM-MATCHA', 'HVT-CHELAM-MATCHA', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('75eca397-e5e1-45c2-a3b8-eac4c94bd5d9', 'HVT-LOT-HVT-HOATRA-50-1', 'HVT-HOATRA-50', 'Bao bì Minh Phát', '2028-08-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('184bbc9d-4b58-4f23-a44d-1605ea49d34f', 'HVT-LOT-HVT-HOATRA-50-2', 'HVT-HOATRA-50', 'Nội bộ Hương Vân', '2028-12-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('0e65e7a6-2561-4275-a079-bd0f07a63ee7', 'HVT-SHELF-HVT-HOATRA-50', 'HVT-HOATRA-50', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('24d464d8-6a64-4e33-a30c-03aac3d824b5', 'HVT-LOT-HVT-HOATRA-100-1', 'HVT-HOATRA-100', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('7b01f5c0-1663-46ea-adae-8ee3e74377ee', 'HVT-LOT-HVT-HOATRA-100-2', 'HVT-HOATRA-100', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('dfcbe890-c973-4af1-adbc-32bd087be005', 'HVT-SHELF-HVT-HOATRA-100', 'HVT-HOATRA-100', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('db47b26b-c0bb-4268-a6d7-4b3805f430e3', 'HVT-LOT-HVT-TONG-THUY-TINH-1', 'HVT-TONG-THUY-TINH', 'HTX Chè Thái Nguyên', '2028-02-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('0058302c-339e-4527-a746-208ab7bddca7', 'HVT-LOT-HVT-TONG-THUY-TINH-2', 'HVT-TONG-THUY-TINH', 'HTX Hương Vân Trà', '2028-06-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('3f0b89d3-b1a6-4964-a5f9-a1e32eb6c564', 'HVT-SHELF-HVT-TONG-THUY-TINH', 'HVT-TONG-THUY-TINH', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('18a7d36b-4b4f-4098-af2a-9c918f1edf5c', 'HVT-LOT-HVT-TONG-NAU-DO-1', 'HVT-TONG-NAU-DO', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('72a2870d-bbdd-40f4-addb-ae64f06659e4', 'HVT-LOT-HVT-TONG-NAU-DO-2', 'HVT-TONG-NAU-DO', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('803df4f6-4ba1-483d-a05e-6ea98a5a889b', 'HVT-SHELF-HVT-TONG-NAU-DO', 'HVT-TONG-NAU-DO', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('3825ca44-0d4e-47e9-abe4-7d75f76a3d72', 'HVT-LOT-HVT-TONG-QUAI-GO-1', 'HVT-TONG-QUAI-GO', 'Bao bì Minh Phát', '2028-08-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('b1fc49de-da8a-48fc-a0bf-66c129b3c028', 'HVT-LOT-HVT-TONG-QUAI-GO-2', 'HVT-TONG-QUAI-GO', 'Nội bộ Hương Vân', '2028-12-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('2d52d3e6-dfc9-4f96-a314-25d5ad418488', 'HVT-SHELF-HVT-TONG-QUAI-GO', 'HVT-TONG-QUAI-GO', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('42f35ad1-0012-404e-a115-0e7919335700', 'HVT-LOT-HVT-XUC-TRE-1', 'HVT-XUC-TRE', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('c862cbf8-165e-45e8-a1a7-0016dfd04246', 'HVT-LOT-HVT-XUC-TRE-2', 'HVT-XUC-TRE', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('0c88d0b8-0c2e-4e29-a992-6edb314fe58f', 'HVT-SHELF-HVT-XUC-TRE', 'HVT-XUC-TRE', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('5868da4c-6857-4c92-aeff-e3b09eed24d1', 'HVT-LOT-HVT-XUC-DONG-GO-1', 'HVT-XUC-DONG-GO', 'HTX Chè Thái Nguyên', '2028-02-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('d2329fe5-1ee5-494c-a7dc-1bcbd3e35920', 'HVT-LOT-HVT-XUC-DONG-GO-2', 'HVT-XUC-DONG-GO', 'HTX Hương Vân Trà', '2028-06-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('693a26ac-e5cd-4ba7-aee1-6ba789c6b748', 'HVT-SHELF-HVT-XUC-DONG-GO', 'HVT-XUC-DONG-GO', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('ac5295c6-3fd4-489c-a2ee-00f458364681', 'HVT-LOT-HVT-XUC-GO-NAU-1', 'HVT-XUC-GO-NAU', 'Nội bộ Hương Vân', '2027-11-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('5a9f0bf1-5eb8-48df-aba4-543a433fe745', 'HVT-LOT-HVT-XUC-GO-NAU-2', 'HVT-XUC-GO-NAU', 'HTX Chè Thái Nguyên', '2027-03-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('e9d78d3c-4bd0-4473-ae7f-c7b39b270f5c', 'HVT-SHELF-HVT-XUC-GO-NAU', 'HVT-XUC-GO-NAU', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('fdca5d0f-b6d6-465a-ab0a-f0d4cf26b4b8', 'HVT-LOT-HVT-XUC-VANG-DEN-1', 'HVT-XUC-VANG-DEN', 'Bao bì Minh Phát', '2028-08-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('abae8337-344c-4e0a-a2b3-607bdaea9427', 'HVT-LOT-HVT-XUC-VANG-DEN-2', 'HVT-XUC-VANG-DEN', 'Nội bộ Hương Vân', '2028-12-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('80072274-3596-45e0-a673-b4fb613f8283', 'HVT-SHELF-HVT-XUC-VANG-DEN', 'HVT-XUC-VANG-DEN', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf'),
  ('c9ec3eca-fd12-47c4-ad71-94cebe538185', 'HVT-LOT-HVT-XUC-CHUOI-RONG-1', 'HVT-XUC-CHUOI-RONG', 'HTX Hương Vân Trà', '2027-05-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('2fa4a0d0-a771-4935-ac1b-d288cb9403f4', 'HVT-LOT-HVT-XUC-CHUOI-RONG-2', 'HVT-XUC-CHUOI-RONG', 'Bao bì Minh Phát', '2027-09-28 00:00:00', 'Phase B seed — tồn Kho theo SkuCode Excel', 'Warehouse'),
  ('6128327a-fe85-4dcd-a5dd-9beac5814481', 'HVT-SHELF-HVT-XUC-CHUOI-RONG', 'HVT-XUC-CHUOI-RONG', 'Chuyển kệ nội bộ', NULL, 'Phase B seed — tồn Kệ Hàng POS', 'Shelf');

INSERT INTO WarehouseBatches
  (Id, LotCode, BatchCode, Supplier, ExpiresAt, Note, SourceType, SourceReferenceId,
   SourceReferenceCode, Location, ParentBatchId, SourceBatchId, Status,
   CreatedBy, CreatedAt, UpdatedAt)
SELECT
  b.Id,
  b.LotCode,
  b.LotCode,
  b.Supplier,
  b.ExpiresAt,
  b.Note,
  'hvt_phase_b_seed',
  NULL,
  'HVT-PHASE-B',
  b.Location,
  NULL,
  NULL,
  'active',
  @SEED_USER,
  @NOW,
  @NOW
FROM _phase_b_batches b
INNER JOIN _phase_b_resolved r ON r.SkuCode = b.SkuCode
ON DUPLICATE KEY UPDATE
  Supplier = VALUES(Supplier),
  ExpiresAt = VALUES(ExpiresAt),
  Note = VALUES(Note),
  Location = VALUES(Location),
  Status = 'active',
  UpdatedAt = @NOW;

DROP TEMPORARY TABLE IF EXISTS _phase_b_items;
CREATE TEMPORARY TABLE _phase_b_items (
  Id char(36) NOT NULL PRIMARY KEY,
  WarehouseBatchId char(36) NOT NULL,
  SkuCode varchar(50) NOT NULL,
  Quantity int NOT NULL,
  UnitCost decimal(18,2) NOT NULL
);

INSERT INTO _phase_b_items (Id, WarehouseBatchId, SkuCode, Quantity, UnitCost)
VALUES
  ('6af815ed-a9d8-47ad-ac90-8e1ad76af812', 'cebcdfe9-91e8-4531-a4a4-386a96bc8b95', 'NL-TRA-XANH-G', 25000, 180),
  ('5733c7a0-5cf6-4212-ab06-7f75159fa87f', 'f3d93c53-59c1-4c4f-acae-863dad506b87', 'NL-TRA-XANH-G', 25000, 180),
  ('f507002a-eb07-4bfb-ad67-91d8a7509ef7', 'bfb0e5a0-b5d3-460b-aec1-7cfcf7564ae0', 'NL-HONG-TRA-G', 15000, 220),
  ('d4a3a313-13f8-4bf1-a5cd-d7ac8676b50a', 'd9ea7057-8b5d-4275-a3d3-71d127175b5e', 'NL-HONG-TRA-G', 15000, 220),
  ('a3169ca6-b2f2-452b-a9cf-035f00ff3d05', '12661ac7-5b12-43e3-ab3a-5145eb7595cc', 'NL-HOA-BUOI-G', 4000, 900),
  ('b7bb659a-8a39-44ed-a273-9b6955ec91fb', 'f0164daf-ab28-46e9-a15f-a98ea7236b86', 'NL-HOA-BUOI-G', 4000, 900),
  ('ead879e5-dc46-4fab-ab61-fc6535ad9a75', '890fbd41-5f62-4fa0-ac5d-49658fa2b66c', 'NL-HOA-SEN-G', 4000, 1200),
  ('a6f8ae99-3325-48f5-a14f-5e1d371f6270', '68c9b8af-fdf8-4dbd-aa16-f052bbf4172e', 'NL-HOA-SEN-G', 4000, 1200),
  ('84108225-0c91-40be-a136-2d1defa949df', '992321bd-5f2b-44ed-ac25-ca7ef2677b6e', 'BB-TUI-TRA', 1000, 1500),
  ('40a3135e-f3e4-4a5f-a61e-c18455b3c3e6', '33233cac-123e-4837-aeba-5c4fb1a2532c', 'BB-TUI-TRA', 1000, 1500),
  ('69c18bf2-ca27-4267-a217-849b399988ba', 'd7f01d9e-f4db-44c7-a5b5-04662e01b4ce', 'BB-HOP-GIAY-HVT', 600, 5000),
  ('733791ae-8847-4e84-ad8f-3fe5df1ef558', '7acde412-9fcb-45a2-a981-e073c68809d3', 'BB-HOP-GIAY-HVT', 600, 5000),
  ('164b4969-6013-4780-a6f5-ea7445a27244', 'b44ed5d4-79ca-442c-aba3-a449b438930d', 'BB-HU-SU-HVT', 200, 45000),
  ('b4d94d08-5113-458f-aab5-3d4e6f32a69f', '720a5c50-b3d2-4227-abec-e30f91164951', 'BB-HU-SU-HVT', 200, 45000),
  ('945a560e-0d8d-4bf8-a898-e3f9c8090753', '79d091f8-d3c3-40c5-ab01-4ef1191b6a8d', 'BB-HOP-QUA-HVT', 175, 50000),
  ('bd423c70-c95c-4302-aaaf-ef28a659672e', 'e48ac3b3-175b-4a96-a41d-609848a36fcd', 'BB-HOP-QUA-HVT', 175, 50000),
  ('f0855225-d491-4308-ae2c-0dce867608dc', 'fb114886-0b66-4eae-a223-d8978ed0857a', 'BB-TEM-HVT', 2500, 300),
  ('8ac59308-8bef-4c21-ae58-cecc2c0a2be8', 'dcb86032-8fa5-4f67-a478-a99526bd7ae9', 'BB-TEM-HVT', 2500, 300),
  ('2fb8519d-ced4-44cc-a746-399a5880eeda', 'add9d2fd-83e6-4743-a0a6-0262cb894935', 'HVT-HONGTRA-100G', 45, 75000),
  ('75d8408a-e69b-40a3-a324-c434c8111e09', '43e7c8eb-bf9f-4b07-a3b9-406545bf65b0', 'HVT-HONGTRA-100G', 42, 75000),
  ('37e6bc0f-3d1b-41ce-a8f3-844785e61fe6', 'ae744e11-5bc7-4419-a853-330291754295', 'HVT-HONGTRA-100G', 28, 75000),
  ('d59fd736-e063-4c51-a543-9c252df99d0b', 'b3f2d391-4ef6-4500-a359-2ff8e8a97dc2', 'HVT-HONGTRA-1KG', 17, 750000),
  ('006887e0-14cb-486d-aa58-749c52352036', 'aaa7d543-f14c-4fe7-acf8-32b8eb7232ce', 'HVT-HONGTRA-1KG', 14, 750000),
  ('6ba45294-8df0-4cb0-a130-ad11a9dd1dc0', '77380b03-9e05-4e13-a092-68b1d97dd18c', 'HVT-HONGTRA-1KG', 8, 750000),
  ('dc57e1c9-5dea-420e-a528-291bc1205cc1', '8ebf2f46-2ff9-44b2-ac5d-e78acdf10de7', 'HVT-HONGTRA-50G-HU', 20, 137500),
  ('5f306c11-bd93-4378-a3c9-04b396f2f2cb', '0136bc35-b88e-4b1b-ada4-21abf11dd811', 'HVT-HONGTRA-50G-HU', 17, 137500),
  ('1765ff98-4157-4b8d-a145-787c1cf05a4f', '292c0f2c-3f4f-4090-aad0-c66b81574249', 'HVT-HONGTRA-50G-HU', 12, 137500),
  ('e7b0bac9-8ce5-49da-add1-8eb2f3f7c7ad', '4f17492a-9e17-44f7-a748-0ee153623b25', 'HVT-HOABUOI-100G', 35, 137500),
  ('930dabb7-e480-4bcd-a069-1d5a10f5b335', 'e1c2adb1-f5aa-4cd4-ac68-3dcd3eb556b5', 'HVT-HOABUOI-100G', 32, 137500),
  ('2446aa7b-fbf3-4140-ace3-9027d241f1e9', '054d1c90-8f62-428a-aaa5-dda627919da4', 'HVT-HOABUOI-100G', 22, 137500),
  ('40aaa306-d3bc-42a2-a57c-fce2566670ef', 'c9de88c0-c50d-4561-a1f5-b6de491ac556', 'HVT-HOABUOI-500G', 12, 687500),
  ('9dfb806c-5c84-4b7a-a71c-75f5c89d320b', 'da2cf820-b469-4192-a90b-90395e0d9ab4', 'HVT-HOABUOI-500G', 9, 687500),
  ('5a4615a0-abe4-4df2-a3a6-29e1a7007222', '25e7ba9b-901a-4fce-ae33-227b47e15088', 'HVT-HOABUOI-500G', 6, 687500),
  ('25d707bb-6f6e-4ab5-a9d0-010db3a8e9b8', '72b8bbcc-bfdb-4c1f-a5c6-9ab1616f7ad9', 'HVT-TRAVON-100G', 42, 75000),
  ('593a6ae3-3fbb-4dab-afda-9c11deb178b5', 'd2234c4c-f811-40cd-a42b-f3a8e7fd62ba', 'HVT-TRAVON-100G', 39, 75000),
  ('6fbf6413-24ef-46d1-a7f4-995f31696c40', '654527b3-3def-409f-a3c1-7013488f95a7', 'HVT-TRAVON-100G', 30, 75000),
  ('3c1305ef-60a9-46bf-a676-65bbd6ab0d98', '7f5d3c99-fdd9-472a-a142-3284e8acaed9', 'HVT-TRAVON-500G', 18, 375000),
  ('ce7e7539-815b-485c-a781-54f098237fb4', '94d69432-1666-43de-a6ff-9ed73cbf6cfd', 'HVT-TRAVON-500G', 15, 375000),
  ('a60a22b7-92f9-43da-a91d-dde0a5111a0f', 'afd9234c-2204-4f4e-a7dc-c8ab46afdc37', 'HVT-TRAVON-500G', 10, 375000),
  ('34fa01b6-cc94-430f-a4e1-9cc74d5d524d', '84e23c80-b244-455c-a953-bd097c830947', 'HVT-THAOMOC-50G', 50, 20000),
  ('3c671a74-3997-44da-a2d9-579c6b359d0f', 'f2eb3b98-6150-46df-a5f7-bab163e7a777', 'HVT-THAOMOC-50G', 47, 20000),
  ('2a8471b6-a809-4c19-a166-b8ab491627ca', '0bd994d3-5b3c-44c2-ac5f-339ace271ead', 'HVT-THAOMOC-50G', 35, 20000),
  ('32cb4e53-09a5-45b9-a1de-98cbc671f2be', 'aac59b40-33c2-47c1-aa08-a355bc27b62b', 'HVT-THAOMOC-500G', 20, 200000),
  ('89a968df-2576-4831-a292-3b57642d2fed', '9344083e-e533-4de7-ab6a-7109f7164386', 'HVT-THAOMOC-500G', 17, 200000),
  ('bf052d9d-6975-4508-a790-55d164923eba', '645e2f60-733c-423f-aeb0-19c79a346f91', 'HVT-THAOMOC-500G', 12, 200000),
  ('60f668e3-1db4-4a21-aa8d-5124d1bbfa1b', 'ce99c412-7972-4456-a11b-f2d17541b7ca', 'HVT-THANHHOA-100G', 40, 75000),
  ('2e25f2cf-d0aa-4733-a8e2-06b192a0c62f', 'ba039df6-31bd-49e4-a42b-a37282b66330', 'HVT-THANHHOA-100G', 37, 75000),
  ('6bd17125-15e9-4e6a-a7df-39d9f4af55bc', 'f8ff6cd0-8ba0-4477-ad42-5a98bbb8f973', 'HVT-THANHHOA-100G', 26, 75000),
  ('c828ae9a-3548-4672-a34c-3a247a3ac737', 'ef01932f-b7a8-4a81-a88c-c5a0be3a2deb', 'HVT-THANHHOA-200G', 22, 150000),
  ('cc28b8af-1910-4d48-acb0-9396209747dd', 'c6601fd9-76a8-478c-aa17-55a8840cf29b', 'HVT-THANHHOA-200G', 19, 150000),
  ('2382150e-f986-4337-aa65-13edacefff75', 'b64864ca-57c8-4d3f-afaf-525c175ba78a', 'HVT-THANHHOA-200G', 14, 150000),
  ('ba4f5b8d-3193-4077-aa44-4cc050360dec', 'd1e20a4e-6166-4854-a763-60e12de886a0', 'HVT-SEN-THANGHOA', 30, 60000),
  ('018beb46-0bd1-412f-aa07-ed5261781fcd', '71f63509-ee5c-404b-afe5-eca15beadcb8', 'HVT-SEN-THANGHOA', 27, 60000),
  ('75defd89-2d40-47a6-a7e0-9bfa95013c1e', '40ef0eff-1310-4f33-af47-94f5edef6774', 'HVT-SEN-THANGHOA', 20, 60000),
  ('fef614eb-8f8f-436b-a74b-15d5f066e73b', 'e34c4c1d-63b3-4b2e-a0e2-1f060d93d335', 'HVT-HUONGTRA-100G', 60, 87500),
  ('1c53b248-aec0-48bc-a263-b3d190499679', '29399993-70c3-44e4-a6e4-9b5f663b3f09', 'HVT-HUONGTRA-100G', 57, 87500),
  ('1d41f3dd-f3c7-4911-a856-e83526ee3646', 'b98598af-75d8-4ff4-a441-1ffcf3c8cc14', 'HVT-HUONGTRA-100G', 40, 87500),
  ('abac2db7-06f8-42af-a7d5-a91e81669f25', '6eb688c6-983b-4bdd-a590-61e09379bdf6', 'HVT-NGOCXUAN-100G', 15, 375000),
  ('c42d425a-cb24-4085-ac3b-d383d48e17af', 'bd756ae9-8fbb-4e68-ac9d-981632417bae', 'HVT-NGOCXUAN-100G', 12, 375000),
  ('3f83ec2c-849e-440f-aa82-f0762e28b56d', '79e26d91-0260-4ccd-a4f2-3d4ddfc3e80c', 'HVT-NGOCXUAN-100G', 10, 375000),
  ('1fba9625-5f45-41a6-a58f-140dace79672', '56b62767-255b-4e61-a391-71493b310fec', 'HVT-NGOCXUAN-200G', 9, 750000),
  ('1d0125d1-81a5-4e69-a0d3-c422de490d56', '27449e2e-43f8-4ab5-abcc-14b21c3d6554', 'HVT-NGOCXUAN-200G', 8, 750000),
  ('49834394-efd4-49df-a98d-5a2f82a4f9c7', 'a6b5f851-28f2-4cb7-a0d2-2dedaa5697b9', 'HVT-NGOCXUAN-200G', 5, 750000),
  ('53702de5-4399-45cc-a162-077e5c728e2f', '126f7648-8de2-4f49-a472-481fc9fbf781', 'HVT-TAMPHUC-100G', 45, 75000),
  ('4da0d33e-b625-4c55-a022-881370b7684b', 'ad323813-c709-4f51-aa3a-2eef71876701', 'HVT-TAMPHUC-100G', 42, 75000),
  ('16c9ba5b-b42d-416b-af6e-ce748b382c70', 'f7bd2e9d-ab73-4c2f-aec1-407fddec2cfb', 'HVT-TAMPHUC-100G', 28, 75000),
  ('cb056185-e421-492b-a9ca-d8e1153ef7f2', 'b0c2ed76-7588-4161-a69c-eccc0461e6be', 'HVT-TAMPHUC-500G', 14, 375000),
  ('e26b5f42-2ea6-4404-a29e-431c2ba1f378', '7f536606-0034-43b2-a70c-da525ff175c6', 'HVT-TAMPHUC-500G', 11, 375000),
  ('afdd91d4-2767-4951-af25-fb0fd390aa26', '6814222b-92bc-46ca-a77c-eaa66f98571f', 'HVT-TAMPHUC-500G', 8, 375000),
  ('0ae64e23-09bc-4b7c-a477-685aa676d052', 'c97a7b74-8410-48ba-ade4-c6e417c8ad03', 'HVT-LUCBAO', 8, 1075000),
  ('35ae3e16-05f1-4f86-a335-1b9dc6114cd1', 'd70672ca-aa72-4300-a343-a67abe77c29a', 'HVT-LUCBAO', 8, 1075000),
  ('7ce9fd2e-77de-4608-ae42-7fdaabd0b816', 'bc96ed29-26bc-4689-a33b-b24ffd4357cb', 'HVT-LUCBAO', 4, 1075000),
  ('949b4708-5f01-4a08-a65c-d2b43e590467', '7d37d38b-6150-4a12-abaf-04702ec68580', 'HVT-NONTOM-100G', 20, 200000),
  ('1007edf1-06a6-4542-a829-fb3e455fe1bd', '071b22bb-4c8f-4ebf-acb2-4ca8215bf2f0', 'HVT-NONTOM-100G', 17, 200000),
  ('b03e38bc-2f37-4d3d-a4c8-2914e288d8f4', 'c031fe67-bf15-4515-ad38-2720c4ad93fe', 'HVT-NONTOM-100G', 12, 200000),
  ('1bb29d06-ca5a-46b0-ae7a-aed1a9e9e83d', '93c1bdb3-d94e-499a-a54e-70f1bee0c05d', 'HVT-NONTOM-500G', 8, 1000000),
  ('33cc06ae-359b-45b0-ab31-03ccfa131853', 'd8327e25-f84e-4faf-aa5f-22e69816eeeb', 'HVT-NONTOM-500G', 8, 1000000),
  ('749f828e-0887-45d2-a58e-5c1502cff1d8', 'f43916e1-cd53-4087-a538-ea14fff4eeb6', 'HVT-NONTOM-500G', 4, 1000000),
  ('f38e631c-7d93-4d87-ae04-5d28591042ca', 'a9ba4c71-d6b3-4da4-a575-6ec43dc45a91', 'HVT-SET-TRONGDONG', 15, 125000),
  ('3b270077-6335-4e2d-a7f6-8b71864da599', '20547896-2612-4104-ae60-c8f6a7ec4540', 'HVT-SET-TRONGDONG', 12, 125000),
  ('50a8014d-1b14-48d5-a31f-13bf731fcb6d', '9e43bf17-1ea8-490d-a730-dc8ef4da952f', 'HVT-SET-TRONGDONG', 10, 125000),
  ('d8b38991-7fba-481f-ae04-e590df793058', 'fd688e2d-3b19-4a1c-a5d3-b2639df73afd', 'HVT-SET-HUONGTRA-DB', 10, 425000),
  ('133d16f1-d20b-45a7-a1e9-13f590d305dd', 'c6a6ecf7-399f-4562-a333-bcb830b80cd0', 'HVT-SET-HUONGTRA-DB', 8, 425000),
  ('2fb4df9d-8569-423e-aaa8-c4af6a0743ff', 'b81114e9-de5d-4d12-a11d-6cad46264cc1', 'HVT-SET-HUONGTRA-DB', 6, 425000),
  ('1b49ce57-35d2-424c-ae3f-d3bd189964be', '44691146-598b-4f45-aeb5-a638629d5318', 'HVT-SET-TUIGAM', 9, 400000),
  ('d0a5503b-3fbc-42ec-a700-937baa7f802c', 'e5998ab8-17e7-4f16-ab1d-b09c01fdb02c', 'HVT-SET-TUIGAM', 8, 400000),
  ('780b8b9b-4853-4ac0-a9cf-ff4f1c0b7261', '9d50151c-080e-436b-a023-acde299a5f96', 'HVT-SET-TUIGAM', 6, 400000),
  ('0d3431e8-f33d-40f7-a953-2e170364f982', 'ad99374c-06d6-4e49-acf7-14c5b94bd2b8', 'HVT-SET-GO-DA', 8, 425000),
  ('60c785b1-bcf6-4028-a9cd-03f49d96dd52', 'f46596e5-6b15-4bc0-a8e2-8582fe52b134', 'HVT-SET-GO-DA', 8, 425000),
  ('ee3fcc23-a898-4207-acfa-9179d3041660', 'ae9dce22-b90d-4948-afff-7513eaa4507d', 'HVT-SET-GO-DA', 5, 425000),
  ('3efeae26-6717-409b-a1e0-c98ae98d7eed', '4ca1ac4d-198a-43e7-a6b8-3cadb007cd6c', 'HVT-SET-VANGO', 8, 450000),
  ('1ed16522-39ad-4727-a544-fae4727394bd', 'd1ea4fa8-3671-43f9-a7bd-c306ecb00caf', 'HVT-SET-VANGO', 8, 450000),
  ('66831b05-52f7-4134-af7b-e3e50c822804', '5e86adac-966d-4ed7-a11a-4d7fe4d6133c', 'HVT-SET-VANGO', 5, 450000),
  ('c095f0dd-1d60-49ff-a146-eb4d6cc3a56a', '4245c390-edc0-4045-a3a7-e664ae592dc6', 'HVT-SET-NAPGO', 9, 400000),
  ('11c9ddae-0af9-4e26-abe9-9fdb6c78c439', 'd087aea8-96b1-4af9-a755-5f86ffdd769a', 'HVT-SET-NAPGO', 8, 400000),
  ('cd654f43-7b09-4af7-a4ec-35b4a6ff6877', '161af21d-797f-4df4-a31e-05583160e44d', 'HVT-SET-NAPGO', 6, 400000),
  ('f25e1b62-d3dc-4809-af45-5c09a58c554f', '97ebb185-690d-4a11-a5a6-bc7fdaf3f987', 'HVT-SET-DOANVIEN', 8, 900000),
  ('3c8c6b09-4d59-41b6-a357-7eb639cca13a', '5e4df25c-545b-4253-afb0-e57a81d551cc', 'HVT-SET-DOANVIEN', 8, 900000),
  ('58d154da-5a1d-4abb-a8e0-8a7b364e2641', 'b482556e-27a9-46ee-ae6b-73cc5aee0527', 'HVT-SET-DOANVIEN', 3, 900000),
  ('bdd57fb2-f1ac-458f-a002-7227c6a7472f', '3b6d45a6-bef3-4127-a261-ed1dcbd813c5', 'HVT-KEOTRA', 25, 150000),
  ('d073b6bc-6567-4169-a562-44a9f4987090', '119475f7-41d1-4aa2-a22b-2b2be2b28fe0', 'HVT-KEOTRA', 22, 150000),
  ('56ea0c51-ac2c-4f1a-abcc-09f4504a2e20', '28d27455-94c3-4ccc-aac9-37891949d8e3', 'HVT-KEOTRA', 18, 150000),
  ('2cafce2a-1ed3-47ba-a77b-729a5217b754', 'c5472f52-7523-4dee-a038-b2fa4f7c5313', 'HVT-CHELAM-MATCHA', 35, 47500),
  ('e346e594-0376-4811-aeee-9a7096b36abe', 'e87cf2c7-13ab-4236-a7c8-9306b86bb197', 'HVT-CHELAM-MATCHA', 32, 47500),
  ('27d73d43-0911-4385-a60b-f21a810892ec', '808fcb1c-fc0e-4062-a707-265e0e7f601c', 'HVT-CHELAM-MATCHA', 25, 47500),
  ('df6b9886-ff0e-437b-a720-8b3e9c4f715d', '75eca397-e5e1-45c2-a3b8-eac4c94bd5d9', 'HVT-HOATRA-50', 12, 250000),
  ('1cf5866f-e385-496d-ae04-e4626b49df8e', '184bbc9d-4b58-4f23-a44d-1605ea49d34f', 'HVT-HOATRA-50', 9, 250000),
  ('2415889f-7329-4032-ae95-97ec1a5cf49a', '0e65e7a6-2561-4275-a079-bd0f07a63ee7', 'HVT-HOATRA-50', 8, 250000),
  ('847a0176-236e-4cd5-a462-2721f9319155', '24d464d8-6a64-4e33-a30c-03aac3d824b5', 'HVT-HOATRA-100', 8, 500000),
  ('0166816c-28df-468b-ab4e-44f532ae08e7', '7b01f5c0-1663-46ea-adae-8ee3e74377ee', 'HVT-HOATRA-100', 8, 500000),
  ('c6c1feba-eb7c-45a2-a175-28a8cbbd4bc7', 'dfcbe890-c973-4af1-adbc-32bd087be005', 'HVT-HOATRA-100', 5, 500000),
  ('4e364810-5575-443f-a74c-6758850f846d', 'db47b26b-c0bb-4268-a6d7-4b3805f430e3', 'HVT-TONG-THUY-TINH', 15, 210000),
  ('d540cf56-430d-4d4c-a3e6-e4300e9e64b4', '0058302c-339e-4527-a746-208ab7bddca7', 'HVT-TONG-THUY-TINH', 12, 210000),
  ('4e5f0c83-5d4f-40e5-a809-1d77e6c4dce2', '3f0b89d3-b1a6-4964-a5f9-a1e32eb6c564', 'HVT-TONG-THUY-TINH', 10, 210000),
  ('75dc9e01-8053-464a-a1a6-ccff7c8e0fa5', '18a7d36b-4b4f-4098-af2a-9c918f1edf5c', 'HVT-TONG-NAU-DO', 20, 52500),
  ('7f7d8d6f-c2f5-46ad-a1a3-a2798d89ee48', '72a2870d-bbdd-40f4-addb-ae64f06659e4', 'HVT-TONG-NAU-DO', 17, 52500),
  ('d4c00c81-5f19-4741-ac2f-b0079939d36f', '803df4f6-4ba1-483d-a05e-6ea98a5a889b', 'HVT-TONG-NAU-DO', 14, 52500),
  ('31f2af27-32ef-4981-a4cb-b952c8f555a6', '3825ca44-0d4e-47e9-abe4-7d75f76a3d72', 'HVT-TONG-QUAI-GO', 14, 150000),
  ('53a6287c-bc6f-4495-a360-d3951a802f24', 'b1fc49de-da8a-48fc-a0bf-66c129b3c028', 'HVT-TONG-QUAI-GO', 11, 150000),
  ('8e701df2-6e80-47b6-a396-3c89adf85a54', '2d52d3e6-dfc9-4f96-a314-25d5ad418488', 'HVT-TONG-QUAI-GO', 10, 150000),
  ('6b542f8e-4f2e-42c6-a97b-68fa235b9779', '42f35ad1-0012-404e-a115-0e7919335700', 'HVT-XUC-TRE', 40, 17500),
  ('842e063a-5cdc-45b5-abf9-1ff18ca46757', 'c862cbf8-165e-45e8-a1a7-0016dfd04246', 'HVT-XUC-TRE', 37, 17500),
  ('2b6090e6-c4fd-4afd-a88f-0d6c4df1d770', '0c88d0b8-0c2e-4e29-a992-6edb314fe58f', 'HVT-XUC-TRE', 30, 17500),
  ('51496cce-4b0e-4765-aecc-c644a798dbba', '5868da4c-6857-4c92-aeff-e3b09eed24d1', 'HVT-XUC-DONG-GO', 35, 22500),
  ('915f0566-ca05-4844-a08c-43b19e0f73c8', 'd2329fe5-1ee5-494c-a7dc-1bcbd3e35920', 'HVT-XUC-DONG-GO', 32, 22500),
  ('65f0dfa6-4a63-4cc5-a71a-dee3e3480752', '693a26ac-e5cd-4ba7-aee1-6ba789c6b748', 'HVT-XUC-DONG-GO', 24, 22500),
  ('cf7a84b0-a284-49ad-a997-9146b05cd5e1', 'ac5295c6-3fd4-489c-a2ee-00f458364681', 'HVT-XUC-GO-NAU', 27, 40000),
  ('0c821a90-a2d0-4b84-a567-5ba9ea1c3898', '5a9f0bf1-5eb8-48df-aba4-543a433fe745', 'HVT-XUC-GO-NAU', 24, 40000),
  ('2720755d-9da8-47e5-ad65-d5f07c359d5d', 'e9d78d3c-4bd0-4473-ae7f-c7b39b270f5c', 'HVT-XUC-GO-NAU', 20, 40000),
  ('fa438e48-a08c-49d0-aa1f-9b6f248781ca', 'fdca5d0f-b6d6-465a-ab0a-f0d4cf26b4b8', 'HVT-XUC-VANG-DEN', 17, 100000),
  ('5fdd9628-60b4-4d33-a419-f872b8d9ead1', 'abae8337-344c-4e0a-a2b3-607bdaea9427', 'HVT-XUC-VANG-DEN', 14, 100000),
  ('e7ae49eb-a13d-4bc9-ab78-c3d6b36e9cd7', '80072274-3596-45e0-a673-b4fb613f8283', 'HVT-XUC-VANG-DEN', 12, 100000),
  ('9e58dc88-05a4-4c77-ae50-76e9f19e77cf', 'c9ec3eca-fd12-47c4-ad71-94cebe538185', 'HVT-XUC-CHUOI-RONG', 22, 47500),
  ('46fb1ff7-12fb-47e7-a787-fed7d8e81546', '2fa4a0d0-a771-4935-ac1b-d288cb9403f4', 'HVT-XUC-CHUOI-RONG', 19, 47500),
  ('f4f3c314-ea10-4fed-abf2-f23df3e9c0cf', '6128327a-fe85-4dcd-a5dd-9beac5814481', 'HVT-XUC-CHUOI-RONG', 16, 47500);

INSERT INTO WarehouseBatchItems
  (Id, WarehouseBatchId, SkuId, SkuCode, ProductSnapshotName,
   QuantityOnHand, InitialQuantity, UnitCost, CreatedAt, UpdatedAt)
SELECT
  i.Id,
  i.WarehouseBatchId,
  r.SkuId,
  r.SkuCode,
  r.ProductName,
  i.Quantity,
  i.Quantity,
  i.UnitCost,
  @NOW,
  @NOW
FROM _phase_b_items i
INNER JOIN _phase_b_resolved r ON r.SkuCode = i.SkuCode
INNER JOIN WarehouseBatches wb ON wb.Id = i.WarehouseBatchId
ON DUPLICATE KEY UPDATE
  WarehouseBatchId = VALUES(WarehouseBatchId),
  SkuId = VALUES(SkuId),
  SkuCode = VALUES(SkuCode),
  ProductSnapshotName = VALUES(ProductSnapshotName),
  QuantityOnHand = VALUES(QuantityOnHand),
  InitialQuantity = VALUES(InitialQuantity),
  UnitCost = VALUES(UnitCost),
  UpdatedAt = @NOW;

SELECT COUNT(*) INTO @phase_b_resolved_count FROM _phase_b_resolved;
SELECT COUNT(*) INTO @phase_b_stock_count
FROM SkuStocks ss
INNER JOIN _phase_b_resolved r ON r.SkuId = ss.SkuId;
SELECT COUNT(*) INTO @phase_b_batch_count
FROM WarehouseBatches
WHERE LotCode LIKE 'HVT-LOT-%' OR LotCode LIKE 'HVT-SHELF-%';
SELECT COUNT(*) INTO @phase_b_item_count
FROM WarehouseBatchItems wbi
INNER JOIN WarehouseBatches wb ON wb.Id = wbi.WarehouseBatchId
WHERE wb.LotCode LIKE 'HVT-LOT-%' OR wb.LotCode LIKE 'HVT-SHELF-%';

SELECT
  @phase_b_resolved_count AS ResolvedSkus,
  @phase_b_stock_count AS SkuStockRows,
  @phase_b_batch_count AS SeedBatches,
  @phase_b_item_count AS SeedBatchItems;

-- Done. ExpectedSkus=48, PlannedBatches=135, PlannedItems=135
