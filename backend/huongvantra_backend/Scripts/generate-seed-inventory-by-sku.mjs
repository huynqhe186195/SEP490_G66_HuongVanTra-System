/**
 * Phase B — Seed inventory-only theo SkuCode (sau khi import/approve Excel catalog).
 *
 * Không INSERT Products / ProductVariants.
 * Lookup ProductVariants.Id theo SkuCode trong hvt_product_db,
 * rồi UPSERT SkuStocks + WarehouseBatches + WarehouseBatchItems.
 *
 * Run:
 *   node generate-seed-inventory-by-sku.mjs
 *   .\\run-seed-inventory-by-sku.ps1
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outFile = path.join(__dirname, 'seed-inventory-by-sku.sql')

const esc = (s) => String(s ?? '').replace(/'/g, "''")

/** Deterministic GUID từ chuỗi (ổn định giữa các lần generate). */
function guidFromKey(key) {
  const hex = createHash('sha1').update(`hvt-inv-seed:${key}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/**
 * Nguyên liệu dụng cụ trà — do fix-tool-product-boms-with-nl.sql tạo ProductVariants.
 * Phase B DELETE mọi lô HVT-LOT-%, nên phải seed lại ở đây nếu không tồn NL sẽ bị xoá trắng.
 */
function toolNlSkus() {
  const SUP_XUC = 'HTX Thủ công dụng cụ trà'
  const SUP_TONG = 'Xưởng gốm sứ Bát Tràng'
  return [
    { seq: 5, code: 'NL-XUC-TRE', name: 'Xúc trà tre (NL)', cost: 20000, wh: 200, sup: SUP_XUC },
    { seq: 6, code: 'NL-XUC-DONG-GO', name: 'Xúc trà đồng cán gỗ (NL)', cost: 25000, wh: 150, sup: SUP_XUC },
    { seq: 7, code: 'NL-XUC-GO-NAU', name: 'Xúc trà gỗ nâu (NL)', cost: 45000, wh: 120, sup: SUP_XUC },
    { seq: 8, code: 'NL-XUC-VANG-DEN', name: 'Xúc trà vàng chuôi đen (NL)', cost: 120000, wh: 80, sup: SUP_XUC },
    { seq: 9, code: 'NL-XUC-CHUOI-RONG', name: 'Xúc trà chuôi rồng (NL)', cost: 55000, wh: 100, sup: SUP_XUC },
    { seq: 10, code: 'NL-TONG-THUY-TINH', name: 'Tống thủy tinh trong (NL)', cost: 250000, wh: 60, sup: SUP_TONG },
    { seq: 11, code: 'NL-TONG-NAU-DO', name: 'Tống nâu đỏ (NL)', cost: 60000, wh: 80, sup: SUP_TONG },
    { seq: 12, code: 'NL-TONG-QUAI-GO', name: 'Tống quai gỗ to (NL)', cost: 180000, wh: 50, sup: SUP_TONG },
  ].map((s) => ({
    code: s.code,
    type: 'NL',
    name: s.name,
    cost: s.cost,
    weightG: 0,
    shelf: 0,
    wh: s.wh,
    fixed: {
      bid: `c10000${String(s.seq).padStart(2, '0')}-0000-4000-8000-${String(s.seq).padStart(12, '0')}`,
      iid: `d10000${String(s.seq).padStart(2, '0')}-0000-4000-8000-${String(s.seq).padStart(12, '0')}`,
      lot: `HVT-LOT-${s.code}-1`,
      sup: s.sup,
      exp: '2028-08-28 00:00:00',
      note: 'Phase B seed — NL dụng cụ trà',
      qty: s.wh,
    },
  }))
}

/**
 * Catalog Excel Hương Vân (Phase A) — chỉ các SkuCode trong file mẫu.
 * type: FG = thành phẩm (có tồn kệ), NL = nguyên liệu, BB = bao bì.
 */
const seedSkus = [
  // Nguyên liệu (Gram)
  { code: 'NL-TRA-XANH-G', type: 'NL', name: 'Trà xanh thô Tân Cương', cost: 180, weightG: 1, shelf: 0, wh: 50000 },
  { code: 'NL-HONG-TRA-G', type: 'NL', name: 'Hồng trà thô Hương Vân', cost: 220, weightG: 1, shelf: 0, wh: 30000 },
  { code: 'NL-HOA-BUOI-G', type: 'NL', name: 'Hoa bưởi sấy', cost: 900, weightG: 1, shelf: 0, wh: 8000 },
  { code: 'NL-HOA-SEN-G', type: 'NL', name: 'Hoa sen sấy', cost: 1200, weightG: 1, shelf: 0, wh: 8000 },
  // Nguyên liệu dụng cụ trà (đếm theo cái, không theo Gram) — do fix-tool-product-boms-with-nl.sql tạo.
  // fixed = 1 lô Kho duy nhất, GUID cố định, không dùng công thức chia 2 lô của NL dạng Gram.
  ...toolNlSkus(),
  // Bao bì
  { code: 'BB-TUI-TRA', type: 'BB', name: 'Túi trà thực phẩm', cost: 1500, weightG: 0, shelf: 0, wh: 2000 },
  { code: 'BB-HOP-GIAY-HVT', type: 'BB', name: 'Hộp giấy Hương Vân', cost: 5000, weightG: 0, shelf: 0, wh: 1200 },
  { code: 'BB-HU-SU-HVT', type: 'BB', name: 'Hũ sứ đựng trà', cost: 45000, weightG: 0, shelf: 0, wh: 400 },
  { code: 'BB-HOP-QUA-HVT', type: 'BB', name: 'Hộp quà cứng Hương Vân', cost: 50000, weightG: 0, shelf: 0, wh: 350 },
  { code: 'BB-TEM-HVT', type: 'BB', name: 'Tem chống giả Hương Vân', cost: 300, weightG: 0, shelf: 0, wh: 5000 },
  // Thành phẩm — trà
  { code: 'HVT-HONGTRA-100G', type: 'FG', name: 'Hồng Trà Hương Vân', cost: 75000, weightG: 0, shelf: 28, wh: 90 },
  { code: 'HVT-HONGTRA-1KG', type: 'FG', name: 'Hồng Trà Hương Vân', cost: 750000, weightG: 0, shelf: 8, wh: 35 },
  { code: 'HVT-HONGTRA-50G-HU', type: 'FG', name: 'Hồng Trà Hũ Sứ 50g', cost: 137500, weightG: 0, shelf: 12, wh: 40 },
  { code: 'HVT-HOABUOI-100G', type: 'FG', name: 'Trà Ướp Hoa Bưởi', cost: 137500, weightG: 0, shelf: 22, wh: 70 },
  { code: 'HVT-HOABUOI-500G', type: 'FG', name: 'Trà Ướp Hoa Bưởi', cost: 687500, weightG: 0, shelf: 6, wh: 24 },
  { code: 'HVT-TRAVON-100G', type: 'FG', name: 'Trà Vón – Trà Ký Ức', cost: 75000, weightG: 0, shelf: 30, wh: 85 },
  { code: 'HVT-TRAVON-500G', type: 'FG', name: 'Trà Vón – Trà Ký Ức', cost: 375000, weightG: 0, shelf: 10, wh: 36 },
  { code: 'HVT-THAOMOC-50G', type: 'FG', name: 'Trà Hoa Thảo Mộc', cost: 20000, weightG: 0, shelf: 35, wh: 100 },
  { code: 'HVT-THAOMOC-500G', type: 'FG', name: 'Trà Hoa Thảo Mộc', cost: 200000, weightG: 0, shelf: 12, wh: 40 },
  { code: 'HVT-THANHHOA-100G', type: 'FG', name: 'Thanh Hoa Trà', cost: 75000, weightG: 0, shelf: 26, wh: 80 },
  { code: 'HVT-THANHHOA-200G', type: 'FG', name: 'Thanh Hoa Trà', cost: 150000, weightG: 0, shelf: 14, wh: 45 },
  { code: 'HVT-SEN-THANGHOA', type: 'FG', name: 'Trà Sen Sấy Thăng Hoa', cost: 60000, weightG: 0, shelf: 20, wh: 60 },
  { code: 'HVT-HUONGTRA-100G', type: 'FG', name: 'Hương Trà Hương Vân', cost: 87500, weightG: 0, shelf: 40, wh: 120 },
  { code: 'HVT-NGOCXUAN-100G', type: 'FG', name: 'Ngọc Xuân Trà – Trà Đinh', cost: 375000, weightG: 0, shelf: 10, wh: 30 },
  { code: 'HVT-NGOCXUAN-200G', type: 'FG', name: 'Ngọc Xuân Trà – Trà Đinh', cost: 750000, weightG: 0, shelf: 5, wh: 18 },
  { code: 'HVT-TAMPHUC-100G', type: 'FG', name: 'Tam Phúc Trà – Trà Móc Câu', cost: 75000, weightG: 0, shelf: 28, wh: 90 },
  { code: 'HVT-TAMPHUC-500G', type: 'FG', name: 'Tam Phúc Trà – Trà Móc Câu', cost: 375000, weightG: 0, shelf: 8, wh: 28 },
  { code: 'HVT-LUCBAO', type: 'FG', name: 'Trà Lục Bảo', cost: 1075000, weightG: 0, shelf: 4, wh: 12 },
  { code: 'HVT-NONTOM-100G', type: 'FG', name: 'Hộp Trà Nõn Tôm Cao Cấp', cost: 200000, weightG: 0, shelf: 12, wh: 40 },
  { code: 'HVT-NONTOM-500G', type: 'FG', name: 'Hộp Trà Nõn Tôm Cao Cấp', cost: 1000000, weightG: 0, shelf: 4, wh: 14 },
  // Set quà
  { code: 'HVT-SET-TRONGDONG', type: 'FG', name: 'Hộp Trà Trống Đồng Hương Vân', cost: 125000, weightG: 0, shelf: 10, wh: 30 },
  { code: 'HVT-SET-HUONGTRA-DB', type: 'FG', name: 'Hộp Hương Trà Đặc Biệt', cost: 425000, weightG: 0, shelf: 6, wh: 20 },
  { code: 'HVT-SET-TUIGAM', type: 'FG', name: 'Túi Gấm Trà Cao Cấp', cost: 400000, weightG: 0, shelf: 6, wh: 18 },
  { code: 'HVT-SET-GO-DA', type: 'FG', name: 'Hộp Trà Gỗ Bọc Da Cao Cấp', cost: 425000, weightG: 0, shelf: 5, wh: 16 },
  { code: 'HVT-SET-VANGO', type: 'FG', name: 'Hộp Trà Vân Gỗ Cao Cấp', cost: 450000, weightG: 0, shelf: 5, wh: 16 },
  { code: 'HVT-SET-NAPGO', type: 'FG', name: 'Hộp Trà Nắp Gỗ Cao Cấp', cost: 400000, weightG: 0, shelf: 6, wh: 18 },
  { code: 'HVT-SET-DOANVIEN', type: 'FG', name: 'Hộp Trà Đoàn Viên Cao Cấp', cost: 900000, weightG: 0, shelf: 3, wh: 10 },
  // Kẹo / hoa trà
  { code: 'HVT-KEOTRA', type: 'FG', name: 'Kẹo Trà Hương Vân', cost: 150000, weightG: 0, shelf: 18, wh: 50 },
  { code: 'HVT-CHELAM-MATCHA', type: 'FG', name: 'Chè Lam Matcha', cost: 47500, weightG: 0, shelf: 25, wh: 70 },
  { code: 'HVT-HOATRA-50', type: 'FG', name: 'Hoa Trà Hương Vân', cost: 250000, weightG: 0, shelf: 8, wh: 24 },
  { code: 'HVT-HOATRA-100', type: 'FG', name: 'Hoa Trà Hương Vân', cost: 500000, weightG: 0, shelf: 5, wh: 16 },
  // Dụng cụ
  { code: 'HVT-TONG-THUY-TINH', type: 'FG', name: 'Tống Thủy Tinh Trong', cost: 210000, weightG: 0, shelf: 10, wh: 30 },
  { code: 'HVT-TONG-NAU-DO', type: 'FG', name: 'Tống Nâu Đỏ', cost: 52500, weightG: 0, shelf: 14, wh: 40 },
  { code: 'HVT-TONG-QUAI-GO', type: 'FG', name: 'Tống Quai Gỗ To', cost: 150000, weightG: 0, shelf: 10, wh: 28 },
  { code: 'HVT-XUC-TRE', type: 'FG', name: 'Xúc Trà Tre', cost: 17500, weightG: 0, shelf: 30, wh: 80 },
  { code: 'HVT-XUC-DONG-GO', type: 'FG', name: 'Xúc Trà Đồng Cán Gỗ Lẻ', cost: 22500, weightG: 0, shelf: 24, wh: 70 },
  { code: 'HVT-XUC-GO-NAU', type: 'FG', name: 'Xúc Trà Gỗ Nâu', cost: 40000, weightG: 0, shelf: 20, wh: 55 },
  { code: 'HVT-XUC-VANG-DEN', type: 'FG', name: 'Xúc Trà Vàng Chuôi Đen', cost: 100000, weightG: 0, shelf: 12, wh: 35 },
  { code: 'HVT-XUC-CHUOI-RONG', type: 'FG', name: 'Xúc Trà Chuôi Rồng', cost: 47500, weightG: 0, shelf: 16, wh: 45 },
]

const suppliers = [
  'HTX Chè Thái Nguyên',
  'HTX Hương Vân Trà',
  'Bao bì Minh Phát',
  'Nội bộ Hương Vân',
]

const batches = []
const items = []
let bi = 0

for (const s of seedSkus) {
  if (s.fixed) {
    const f = s.fixed
    batches.push({
      bid: f.bid, lot: f.lot, code: s.code, type: s.type,
      sup: f.sup, exp: f.exp, loc: 'Warehouse', note: f.note,
    })
    items.push({ iid: f.iid, bid: f.bid, code: s.code, name: s.name, qty: f.qty, cost: s.cost })
    continue
  }

  // 2 lô Kho
  for (let b = 1; b <= 2; b++) {
    bi++
    const lot = `HVT-LOT-${s.code}-${b}`.slice(0, 50)
    const bid = guidFromKey(`batch:${lot}`)
    const iid = guidFromKey(`item:${lot}`)
    const expY = 2027 + ((bi + b) % 2)
    const expM = String(((bi * 3 + b) % 12) + 1).padStart(2, '0')
    const qty = s.type === 'FG'
      ? Math.max(8, Math.floor(s.wh / 2) - (b - 1) * 3)
      : s.type === 'NL'
        ? Math.max(1000, Math.floor(s.wh / 2))
        : Math.max(50, Math.floor(s.wh / 2))
    batches.push({
      bid, lot, code: s.code, type: s.type,
      sup: suppliers[bi % suppliers.length],
      exp: `${expY}-${expM}-28 00:00:00`,
      loc: 'Warehouse',
      note: 'Phase B seed — tồn Kho theo SkuCode Excel',
    })
    items.push({ iid, bid, code: s.code, name: s.name, qty, cost: s.cost })
  }

  // 1 lô Kệ cho thành phẩm bán POS
  if (s.type === 'FG' && s.shelf > 0) {
    bi++
    const lot = `HVT-SHELF-${s.code}`.slice(0, 50)
    const bid = guidFromKey(`batch:${lot}`)
    const iid = guidFromKey(`item:${lot}`)
    batches.push({
      bid, lot, code: s.code, type: s.type,
      sup: 'Chuyển kệ nội bộ',
      exp: null,
      loc: 'Shelf',
      note: 'Phase B seed — tồn Kệ Hàng POS',
    })
    items.push({ iid, bid, code: s.code, name: s.name, qty: s.shelf, cost: s.cost })
  }
}

const skuValues = seedSkus.map((s) =>
  `  ('${esc(s.code)}', '${esc(s.type)}', '${esc(s.name)}', ${s.cost}, ${s.weightG}, ${s.shelf}, ${s.wh})`
).join(',\n')

const lines = []
lines.push(`-- =============================================================================
-- Phase B — Seed inventory-only theo SkuCode (KHÔNG tạo Product/SKU)
-- Prerequisites:
--   1) ProductService + InventoryService đã migrate
--   2) Đã chạy seed-hvt-categories
--   3) Đã import + approve Excel catalog Hương Vân (SkuCode HVT-*/NL-*/BB-*)
-- Runner:
--   .\\Scripts\\run-seed-inventory-by-sku.ps1
-- Idempotent: xóa lô HVT-LOT-* / HVT-SHELF-* rồi insert lại; UPSERT SkuStocks.
-- BOM: không seed — dùng BOM từ Excel approve.
-- Soft-deprecated: seed-catalog-inventory-realistic.sql (Matcha/Ceylon path cũ).
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET @NOW = UTC_TIMESTAMP(6);
SET @SEED_USER = '00000000-0000-0000-0000-000000000000';

-- Toan bo temp table nam trong inventory_db de khong mat khi chuyen schema.
USE \`hvt_inventory_db\`;

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
${skuValues};

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

-- MESSAGE_TEXT cua SIGNAL toi da 128 ky tu, nen in danh sach thieu ra result set truoc khi abort.
SELECT SkuCode AS MissingSkuCode FROM _phase_b_missing;

DROP PROCEDURE IF EXISTS sp_phase_b_require_catalog;
DELIMITER $$
CREATE PROCEDURE sp_phase_b_require_catalog()
BEGIN
  DECLARE msg VARCHAR(128);
  IF IFNULL(@phase_b_missing_count, 0) > 0 THEN
    SET msg = LEFT(CONCAT(
      'Phase B aborted: missing ', @phase_b_missing_count,
      ' SkuCode(s) - xem danh sach MissingSkuCode o tren.'
    ), 128);
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
${batches.map((b) => {
  const exp = b.exp ? `'${b.exp}'` : 'NULL'
  return `  ('${b.bid}', '${esc(b.lot)}', '${esc(b.code)}', '${esc(b.sup)}', ${exp}, '${esc(b.note)}', '${b.loc}')`
}).join(',\n')};

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
${items.map((it) =>
  `  ('${it.iid}', '${it.bid}', '${esc(it.code)}', ${it.qty}, ${it.cost})`
).join(',\n')};

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

-- Done. ExpectedSkus=${seedSkus.length}, PlannedBatches=${batches.length}, PlannedItems=${items.length}
`)

fs.writeFileSync(outFile, lines.join('\n'), 'utf8')
console.log(`Wrote ${outFile}`)
console.log(`ExpectedSkus=${seedSkus.length} Batches=${batches.length} Items=${items.length}`)
console.log(`Size=${fs.statSync(outFile).size} bytes`)
