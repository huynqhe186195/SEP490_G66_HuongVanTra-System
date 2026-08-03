/**
 * Generates seed-catalog-inventory-realistic.sql
 * Large Hương Vân Trà catalog + inventory sample (no auth/users).
 * Run: node generate-seed-catalog-inventory.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outFile = path.join(__dirname, 'seed-catalog-inventory-realistic.sql')

const guid = (n) =>
  `${n.toString(16).padStart(8, '0')}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`

const esc = (s) => String(s ?? '').replace(/'/g, "''")

const finished = [
  { n: 'Trà Sen Tây Hồ', o: 'Hà Nội', f: 'Thanh tao, hương sen', d: 'Trà xanh ướp hoa sen Tây Hồ thủ công.', packs: [100, 250], cost: [95000, 220000], retail: [185000, 420000], code: 'HVT-SEN', cat: 9101 },
  { n: 'Trà Ô Long Cao Sơn', o: 'Lâm Đồng', f: 'Ngọt hậu, hương hoa quả', d: 'Ô long vùng cao sao thủ công.', packs: [100, 250], cost: [78000, 175000], retail: [155000, 335000], code: 'HVT-OLONG', cat: 9101 },
  { n: 'Trà Shan Tuyết Lào Cai', o: 'Lào Cai', f: 'Hậu vị ngọt, vị núi', d: 'Shan tuyết cổ thụ vùng biên.', packs: [100, 200], cost: [120000, 210000], retail: [245000, 430000], code: 'HVT-SHAN', cat: 9101 },
  { n: 'Trà Lài Thái Nguyên', o: 'Thái Nguyên', f: 'Thơm hoa lài', d: 'Trà xanh ướp hoa lài tươi.', packs: [100, 250], cost: [65000, 145000], retail: [135000, 285000], code: 'HVT-LAI', cat: 9101 },
  { n: 'Hồng Trà Đại Hồng Bào', o: 'Phúc Kiến', f: 'Đậm đà, mật ong', d: 'Hồng trà cao cấp Đại Hồng Bào.', packs: [100, 200], cost: [110000, 200000], retail: [220000, 395000], code: 'HVT-DHB', cat: 9101 },
  { n: 'Bạch Trà Bạch Hào Ngân Châm', o: 'Phúc Châu', f: 'Nhẹ, thanh', d: 'Bạch trà bạc kim châm.', packs: [50, 100], cost: [140000, 260000], retail: [280000, 520000], code: 'HVT-BACH', cat: 9101 },
  { n: 'Phổ Nhĩ Chín 2019', o: 'Vân Nam', f: 'Êm, gỗ già', d: 'Phổ nhĩ chín lên men 2019.', packs: [100, 357], cost: [90000, 280000], retail: [180000, 560000], code: 'HVT-PHUNHI', cat: 9101 },
  { n: 'Trà Atiso Đà Lạt', o: 'Lâm Đồng', f: 'Mát, thảo mộc', d: 'Atiso sấy lạnh Đà Lạt.', packs: [100, 200], cost: [45000, 80000], retail: [95000, 165000], code: 'HVT-ATISO', cat: 9102 },
  { n: 'Trà Hoa Cúc Chi', o: 'Việt Nam', f: 'Thơm nhẹ, dịu', d: 'Hoa cúc chi sấy khô.', packs: [50, 100], cost: [35000, 65000], retail: [75000, 135000], code: 'HVT-CUC', cat: 9102 },
  { n: 'Trà Gừng Mật Ong', o: 'Việt Nam', f: 'Ấm, ngọt', d: 'Gừng sấy phối mật ong.', packs: [100, 200], cost: [40000, 72000], retail: [85000, 155000], code: 'HVT-GUNG', cat: 9102 },
  { n: 'Matcha Uji Grade A', o: 'Nhật Bản', f: 'Umami, xanh', d: 'Matcha nghiền đá grade A.', packs: [50, 100], cost: [180000, 340000], retail: [360000, 680000], code: 'HVT-MATCHA', cat: 9101 },
  { n: 'Earl Grey Classic', o: 'Sri Lanka', f: 'Bergamot', d: 'Trà đen ướp tinh dầu bergamot.', packs: [100, 200], cost: [70000, 130000], retail: [145000, 270000], code: 'HVT-EARL', cat: 9101 },
  { n: 'Trà Đào Đà Lạt', o: 'Lâm Đồng', f: 'Đào chín', d: 'Trà xanh ướp đào Đà Lạt.', packs: [100, 250], cost: [55000, 120000], retail: [115000, 245000], code: 'HVT-DAO', cat: 9101 },
  { n: 'Trà Đen Ceylon OP', o: 'Sri Lanka', f: 'Đậm, chát nhẹ', d: 'Ceylon Orange Pekoe.', packs: [100, 250], cost: [60000, 135000], retail: [125000, 265000], code: 'HVT-CEYLON', cat: 9101 },
  { n: 'Trà Nhài Long Châu', o: 'Việt Nam', f: 'Hoa nhài nồng', d: 'Trà nhài ướp nhiều lần.', packs: [100, 250], cost: [70000, 155000], retail: [145000, 305000], code: 'HVT-NHAI', cat: 9101 },
  { n: 'Set Quà Trà Tứ Quý', o: 'Việt Nam', f: null, d: 'Set 4 loại trà hộp quà.', packs: [1], cost: [320000], retail: [590000], code: 'HVT-SET-TQ', cat: 9103, piece: true },
  { n: 'Ấm Tử Sa Mini 150ml', o: 'Nghi Hưng', f: null, d: 'Ấm tử sa nhỏ pha trà đơn.', packs: [1], cost: [180000], retail: [350000], code: 'HVT-AM-TUSA', cat: 9104, piece: true },
  { n: 'Ly Sứ Men Ngọc', o: 'Việt Nam', f: null, d: 'Ly sứ men ngọc.', packs: [1, 2], cost: [45000, 80000], retail: [95000, 165000], code: 'HVT-LY-NGOC', cat: 9104, piece: true },
  { n: 'Trà Ô Long Nhân Sâm', o: 'Đài Loan', f: 'Nhân sâm, ngọt', d: 'Ô long phối nhân sâm.', packs: [100, 200], cost: [150000, 280000], retail: [295000, 545000], code: 'HVT-OL-NS', cat: 9101 },
  { n: 'Trà Xanh Thái Nguyên Đặc Biệt', o: 'Thái Nguyên', f: 'Chát nhẹ, hậu ngọt', d: 'Búp một tôm hai lá.', packs: [100, 250], cost: [85000, 190000], retail: [170000, 365000], code: 'HVT-TN-DB', cat: 9101 },
]

const materials = [
  { n: 'Trà xanh thô Thái Nguyên', o: 'Thái Nguyên', d: 'Búp trà xanh nguyên liệu.', code: 'NL-TRAXANH', cat: 9106, c: 125000, r: 180000 },
  { n: 'Lá ô long thô Lâm Đồng', o: 'Lâm Đồng', d: 'Ô long sao sơ nguyên liệu.', code: 'NL-OLONG', cat: 9106, c: 98000, r: 150000 },
  { n: 'Hoa sen khô Tây Hồ', o: 'Hà Nội', d: 'Cánh sen khô ướp trà.', code: 'NL-HOASEN', cat: 9107, c: 360000, r: 520000 },
  { n: 'Hoa lài khô', o: 'Việt Nam', d: 'Hoa lài sấy dùng ướp.', code: 'NL-HOALAI', cat: 9107, c: 280000, r: 400000 },
  { n: 'Đường phèn hạt', o: 'Việt Nam', d: 'Đường phèn phụ gia.', code: 'NL-DUONGPHEN', cat: 9107, c: 28000, r: 45000 },
  { n: 'Atiso khô cánh', o: 'Đà Lạt', d: 'Cánh atiso sấy.', code: 'NL-ATISO', cat: 9106, c: 85000, r: 130000 },
  { n: 'Búp trà shan tuyết', o: 'Lào Cai', d: 'Búp shan nguyên liệu.', code: 'NL-SHAN', cat: 9106, c: 210000, r: 300000 },
  { n: 'Lá phổ nhĩ thô', o: 'Vân Nam', d: 'Lá phổ nhĩ lên men.', code: 'NL-PHUNHI', cat: 9106, c: 75000, r: 110000 },
]

const packaging = [
  { n: 'Túi zip kraft 100g', d: 'Túi kraft có zipper.', code: 'BB-ZIP-100', c: 800 },
  { n: 'Túi zip kraft 250g', d: 'Túi kraft 250g.', code: 'BB-ZIP-250', c: 1200 },
  { n: 'Hộp giấy cứng nhỏ', d: 'Hộp giấy in logo HVT.', code: 'BB-HOP-NHO', c: 3500 },
  { n: 'Tem chống giả HVT', d: 'Tem hologram.', code: 'BB-TEM', c: 200 },
  { n: 'Túi nilon thực phẩm', d: 'Túi lót trong.', code: 'BB-NILON', c: 150 },
  { n: 'Hộp quà cứng lớn', d: 'Hộp set quà.', code: 'BB-HOP-LON', c: 12000 },
]

const suppliers = [
  ['a4000000-0000-4000-8000-000000000001', 'HTX Chè Thái Nguyên', '0988111222', 'thai.nguyen@htx.vn', 'Thái Nguyên', 'Trà xanh/ô long thô'],
  ['a4000000-0000-4000-8000-000000000002', 'Công ty TNHH Sen Tây Hồ', '0909333444', 'sen@tayho.vn', 'Tây Hồ, Hà Nội', 'Hoa sen ướp'],
  ['a4000000-0000-4000-8000-000000000003', 'Đà Lạt Farm Atiso', '0912555666', 'atiso@dalat.vn', 'Đà Lạt', 'Atiso / thảo mộc'],
  ['a4000000-0000-4000-8000-000000000004', 'Bao bì Minh Phát', '0933777888', 'sales@minhphat.vn', 'Bình Dương', 'Túi zip, hộp giấy'],
  ['a4000000-0000-4000-8000-000000000005', 'Import Tea Asia', '02873001234', 'order@teasia.import', 'TP.HCM', 'Matcha, Earl Grey, Ceylon'],
]

let pi = 1
let vi = 1
const products = []
const skus = []

for (const p of finished) {
  const prodId = guid(0xa1000000 + pi)
  const parent = p.packs.length > 1 ? 1 : 0
  const baseUnit = p.piece ? 'cái' : 'hộp'
  const flavor = p.f ? `'${esc(p.f)}'` : 'NULL'
  products.push({
    sql: `  ('${prodId}', ${p.cat}, 'THANH_PHAM', '${esc(p.n)}', '${esc(p.o)}', ${flavor}, NULL,\n   '${esc(p.d)}', '${baseUnit}', 'Piece', NULL, NULL, ${parent}, 1, @NOW, @NOW, @NOW, 0)`,
  })
  p.packs.forEach((w, i) => {
    const skuId = guid(0xa2000000 + vi)
    const suffix = p.piece ? (w === 1 ? '' : `-${w}`) : `-${w}G`
    const code = `${p.code}${suffix}`
    const vname = p.piece ? (w === 1 ? '1 cái' : `${w} cái`) : `Gói ${w}g`
    const barcode = `8934673${String(200000 + vi).padStart(6, '0')}`
    const shelf = Math.max(6, 42 - (vi % 19))
    const wh = Math.max(25, 160 - (vi % 37))
    skus.push({
      skuId, prodId, code, barcode, vname, cost: p.cost[i], retail: p.retail[i],
      wg: p.piece ? 0 : w, shelf, wh, type: 'FG', name: p.n, sell: 1, pts: 1, sync: true,
      min: 5, max: 300,
    })
    vi++
  })
  pi++
}

for (const m of materials) {
  const prodId = guid(0xa1000000 + pi)
  products.push({
    sql: `  ('${prodId}', ${m.cat}, 'NGUYEN_LIEU', '${esc(m.n)}', '${esc(m.o)}', NULL, NULL,\n   '${esc(m.d)}', 'Kg', 'Gram', 1000.0000, 'g', 0, 1, NULL, @NOW, @NOW, 0)`,
  })
  const skuId = guid(0xa2000000 + vi)
  skus.push({
    skuId, prodId, code: `${m.code}-1KG`, barcode: `8934673${String(300000 + vi).padStart(6, '0')}`,
    vname: 'Theo gram', cost: m.c, retail: m.r, wg: 1000, shelf: 0, wh: Math.max(40, 55 + vi),
    type: 'NL', name: m.n, sell: 0, pts: 0, sync: false, min: 20, max: 2000,
  })
  vi++; pi++
}

for (const m of packaging) {
  const prodId = guid(0xa1000000 + pi)
  products.push({
    sql: `  ('${prodId}', 9108, 'BAO_BI', '${esc(m.n)}', NULL, NULL, NULL,\n   '${esc(m.d)}', 'cái', 'Piece', 1.0000, 'cái', 0, 1, NULL, @NOW, @NOW, 0)`,
  })
  const skuId = guid(0xa2000000 + vi)
  skus.push({
    skuId, prodId, code: m.code, barcode: `8934673${String(400000 + vi).padStart(6, '0')}`,
    vname: 'Theo chiếc', cost: m.c, retail: 0, wg: 0, shelf: 0, wh: Math.max(200, 400 + vi * 5),
    type: 'BB', name: m.n, sell: 0, pts: 0, sync: false, min: 50, max: 5000,
  })
  vi++; pi++
}

const fgBom = skus.filter((s) => s.type === 'FG').slice(0, 8)
const nlTea = skus.find((s) => s.code === 'NL-TRAXANH')
const bbZip = skus.find((s) => s.code === 'BB-ZIP-100')
const bbHop = skus.find((s) => s.code === 'BB-HOP-NHO')

const supplierNames = suppliers.map((s) => s[1])
let bi = 1
const batches = []
const items = []
for (const s of skus) {
  for (let b = 1; b <= 2; b++) {
    const bid = guid(0xa3000000 + bi)
    const iid = guid(0xa3500000 + bi)
    const lot = `HVT-LOT-${s.code}-${b}`.slice(0, 50)
    const sup = supplierNames[bi % supplierNames.length]
    const expY = 2026 + ((bi + b) % 2)
    const expM = String(((bi * 3 + b * 2) % 12) + 1).padStart(2, '0')
    const qty = s.type === 'FG'
      ? Math.max(12, Math.floor(s.wh / 2) - (b - 1) * 4)
      : s.type === 'NL'
        ? Math.max(15, Math.floor(s.wh / 2))
        : Math.max(80, Math.floor(s.wh / 2))
    batches.push({ bid, lot, sup, exp: `${expY}-${expM}-28 00:00:00`, loc: 'Warehouse', note: 'Seed HVT realistic kho' })
    items.push({ iid, bid, skuId: s.skuId, code: s.code, name: s.name, qty, cost: s.cost })
    bi++
  }
  if (s.type === 'FG' && s.shelf > 0) {
    const bid = guid(0xa3000000 + bi)
    const iid = guid(0xa3500000 + bi)
    const lot = `HVT-SHELF-${s.code}`.slice(0, 50)
    batches.push({ bid, lot, sup: 'Chuyển kệ nội bộ', exp: null, loc: 'Shelf', note: 'Seed HVT tồn kệ POS' })
    items.push({ iid, bid, skuId: s.skuId, code: s.code, name: s.name, qty: s.shelf, cost: s.cost })
    bi++
  }
}

const lines = []
lines.push(`-- =============================================================================
-- Hương Vân Trà — Seed catalog + tồn kho mẫu LỚN (KHÔNG auth / tài khoản / khách / đơn)
-- Namespace: category 91xx · SKU HVT-* · lot HVT-LOT-* / HVT-SHELF-*
-- Chạy sau migrate ProductService + InventoryService:
--   .\\Scripts\\run-seed-catalog-inventory.ps1
-- Idempotent: ON DUPLICATE KEY UPDATE + xóa lô HVT-* trước khi insert lại.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET @NOW = UTC_TIMESTAMP(6);
SET @SEED_USER = '00000000-0000-0000-0000-000000000000';

USE \`hvt_product_db\`;

INSERT INTO Categories
  (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
VALUES
  (9101, 'Trà thành phẩm', 'Trà đóng gói bán lẻ / POS', NULL, 1, @NOW, @NOW, @NOW, 0),
  (9102, 'Trà thảo mộc', 'Atiso, hoa cúc, gừng…', NULL, 1, @NOW, @NOW, @NOW, 0),
  (9103, 'Quà tặng & set', 'Set quà, combo', NULL, 1, @NOW, @NOW, @NOW, 0),
  (9104, 'Dụng cụ pha trà', 'Ấm, ly, phụ kiện', NULL, 1, @NOW, @NOW, @NOW, 0),
  (9105, 'Nguyên liệu sản xuất', 'NL thô kho tổng', NULL, 1, NULL, @NOW, @NOW, 0),
  (9106, 'Trà nguyên liệu', 'NL trà lá', 9105, 1, NULL, @NOW, @NOW, 0),
  (9107, 'Phụ gia NL', 'Đường, hoa ướp…', 9105, 1, NULL, @NOW, @NOW, 0),
  (9108, 'Bao bì sản xuất', 'Túi, hộp, tem', NULL, 1, NULL, @NOW, @NOW, 0)
ON DUPLICATE KEY UPDATE
  Name=VALUES(Name), Description=VALUES(Description), ParentId=VALUES(ParentId),
  IsActive=1, UpdatedAt=@NOW, IsDeleted=0;

INSERT INTO Products
  (Id, CategoryId, ProductType, Name, Origin, FlavorProfile, BrewingGuide, Description,
   BaseUnit, InventoryUnit, WeightValue, WeightUnit, IsVariantParent, IsActive,
   SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
VALUES
${products.map((p) => p.sql).join(',\n')}
ON DUPLICATE KEY UPDATE
  CategoryId=VALUES(CategoryId), ProductType=VALUES(ProductType), Name=VALUES(Name),
  Origin=VALUES(Origin), FlavorProfile=VALUES(FlavorProfile), Description=VALUES(Description),
  BaseUnit=VALUES(BaseUnit), InventoryUnit=VALUES(InventoryUnit), WeightValue=VALUES(WeightValue),
  WeightUnit=VALUES(WeightUnit), IsVariantParent=VALUES(IsVariantParent), IsActive=1,
  SyncedToStoreAt=VALUES(SyncedToStoreAt), UpdatedAt=@NOW, IsDeleted=0;

-- SkuCode va Barcode deu co UNIQUE index. Neu mot ban ghi cu (seed doi truoc, Id khac)
-- dang giu cung SkuCode/Barcode thi ON DUPLICATE KEY UPDATE se ghi vao ban ghi cu thay vi
-- tao Id namespace HVT-*, khien BOM va ton kho tham chieu ProductVariantId khong ton tai
-- (ERROR 1452 tren FK_ProductVariantBomLines_ProductVariants_ProductVariantId).
-- Giai phong hai khoa nay truoc khi insert; soft-delete chu khong xoa hang de khong pha FK.
DROP TEMPORARY TABLE IF EXISTS _seed_variant_keys;
CREATE TEMPORARY TABLE _seed_variant_keys (
  Id char(36) NOT NULL PRIMARY KEY,
  SkuCode varchar(50) NOT NULL,
  Barcode varchar(100) NULL
);
INSERT INTO _seed_variant_keys (Id, SkuCode, Barcode) VALUES
${skus.map((s) => `  ('${s.skuId}', '${s.code}', '${s.barcode}')`).join(',\n')};

UPDATE ProductVariants v
JOIN _seed_variant_keys k
  ON (v.SkuCode = k.SkuCode OR (v.Barcode IS NOT NULL AND v.Barcode = k.Barcode))
SET v.SkuCode = CONCAT('OLD-', LEFT(v.Id, 8), '-', LEFT(v.SkuCode, 30)),
    v.Barcode = NULL,
    v.IsActive = 0,
    v.IsDeleted = 1,
    v.UpdatedAt = @NOW
WHERE v.Id <> k.Id;

DROP TEMPORARY TABLE _seed_variant_keys;

-- IsPurchasable mac dinh 0 trong DB. Seed bat 1 cho moi SKU de chung xuat hien
-- trong danh muc "mat hang cung ung" cua nha cung cap.
INSERT INTO ProductVariants
  (Id, ProductId, SkuCode, Barcode, VariantName, OptionValuesJson, CostPrice, RetailPrice,
   MinStock, MaxStock, IsSellable, IsPurchasable, AllowRewardPoints, IsActive, ImageUrl, WeightInGrams,
   SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
VALUES
${skus.map((s) => {
  const sync = s.sync ? '@NOW' : 'NULL'
  return `  ('${s.skuId}', '${s.prodId}', '${s.code}', '${s.barcode}', '${esc(s.vname)}', '{"sku":"${s.code}"}', ${s.cost}, ${s.retail}, ${s.min}, ${s.max}, ${s.sell}, 1, ${s.pts}, 1, NULL, ${s.wg}, ${sync}, @NOW, @NOW, 0)`
}).join(',\n')}
ON DUPLICATE KEY UPDATE
  ProductId=VALUES(ProductId), Barcode=VALUES(Barcode), VariantName=VALUES(VariantName),
  CostPrice=VALUES(CostPrice), RetailPrice=VALUES(RetailPrice), MinStock=VALUES(MinStock),
  MaxStock=VALUES(MaxStock), IsSellable=VALUES(IsSellable), IsPurchasable=VALUES(IsPurchasable),
  AllowRewardPoints=VALUES(AllowRewardPoints),
  IsActive=1, WeightInGrams=VALUES(WeightInGrams), SyncedToStoreAt=VALUES(SyncedToStoreAt),
  UpdatedAt=@NOW, IsDeleted=0;

DELETE FROM ProductVariantBomLines
WHERE ProductVariantId IN (
${fgBom.map((s) => `  '${s.skuId}'`).join(',\n')}
);

INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, CreatedAt, UpdatedAt, IsDeleted)
VALUES
${fgBom.flatMap((fg) => {
  const qty = fg.wg > 0 ? fg.wg : 100
  return [
    `  ('${fg.skuId}', '${nlTea.prodId}', ${qty}.0000, @NOW, @NOW, 0)`,
    `  ('${fg.skuId}', '${bbZip.prodId}', 1.0000, @NOW, @NOW, 0)`,
    `  ('${fg.skuId}', '${bbHop.prodId}', 1.0000, @NOW, @NOW, 0)`,
  ]
}).join(',\n')};

USE \`hvt_inventory_db\`;

-- Note: bang Suppliers (migration 20260722100000) co the chua apply tren DB cu.
-- Seed dung ten NCC dang text tren WarehouseBatches.Supplier (khong can bang Suppliers).

INSERT INTO SkuStocks
  (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand,
   LowStockThreshold, WarehouseLowStockThreshold, ShelfLowStockThreshold, CreatedAt, UpdatedAt)
VALUES
${skus.map((s) =>
  `  ('${s.skuId}', '${s.code}', ${s.wg}, ${s.shelf}, ${s.wh}, 10, 30, 10, @NOW, @NOW)`
).join(',\n')}
ON DUPLICATE KEY UPDATE
  SkuCode=VALUES(SkuCode), WeightInGrams=VALUES(WeightInGrams),
  QuantityOnHand=VALUES(QuantityOnHand), WarehouseQuantityOnHand=VALUES(WarehouseQuantityOnHand),
  LowStockThreshold=VALUES(LowStockThreshold), WarehouseLowStockThreshold=VALUES(WarehouseLowStockThreshold),
  ShelfLowStockThreshold=VALUES(ShelfLowStockThreshold), UpdatedAt=@NOW;

DELETE wbi FROM WarehouseBatchItems wbi
INNER JOIN WarehouseBatches wb ON wb.Id = wbi.WarehouseBatchId
WHERE wb.LotCode LIKE 'HVT-LOT-%' OR wb.LotCode LIKE 'HVT-SHELF-%';

DELETE FROM WarehouseBatches
WHERE LotCode LIKE 'HVT-LOT-%' OR LotCode LIKE 'HVT-SHELF-%';

-- BatchCode do migration moi hon them vao: NOT NULL + UNIQUE, khong co default.
-- Dung chinh LotCode lam BatchCode cho du lieu seed (unique, <= 50 ky tu).
INSERT INTO WarehouseBatches
  (Id, LotCode, BatchCode, Supplier, ExpiresAt, Note, SourceType, SourceReferenceId,
   SourceReferenceCode, Location, ParentBatchId, SourceBatchId, Status,
   CreatedBy, CreatedAt, UpdatedAt)
VALUES
${batches.map((b) => {
  const exp = b.exp ? `'${b.exp}'` : 'NULL'
  return `  ('${b.bid}', '${esc(b.lot)}', '${esc(b.lot)}', '${esc(b.sup)}', ${exp}, '${esc(b.note)}', 'hvt_seed', NULL,\n   'HVT-SEED', '${b.loc}', NULL, NULL, 'active', @SEED_USER, @NOW, @NOW)`
}).join(',\n')}
ON DUPLICATE KEY UPDATE
  Supplier=VALUES(Supplier), ExpiresAt=VALUES(ExpiresAt), Note=VALUES(Note),
  Location=VALUES(Location), Status='active', UpdatedAt=@NOW;

INSERT INTO WarehouseBatchItems
  (Id, WarehouseBatchId, SkuId, SkuCode, ProductSnapshotName,
   QuantityOnHand, InitialQuantity, UnitCost, CreatedAt, UpdatedAt)
VALUES
${items.map((it) =>
  `  ('${it.iid}', '${it.bid}', '${it.skuId}', '${it.code}', '${esc(it.name)}', ${it.qty}, ${it.qty}, ${it.cost}, @NOW, @NOW)`
).join(',\n')}
ON DUPLICATE KEY UPDATE
  WarehouseBatchId=VALUES(WarehouseBatchId), SkuId=VALUES(SkuId), SkuCode=VALUES(SkuCode),
  ProductSnapshotName=VALUES(ProductSnapshotName), QuantityOnHand=VALUES(QuantityOnHand),
  InitialQuantity=VALUES(InitialQuantity), UnitCost=VALUES(UnitCost), UpdatedAt=@NOW;

-- Done. Products=${products.length}, SKUs=${skus.length}, Batches=${batches.length}, BatchItems=${items.length}
`)

fs.writeFileSync(outFile, lines.join('\n'), 'utf8')
console.log(`Wrote ${outFile}`)
console.log(`Products=${products.length} SKUs=${skus.length} Batches=${batches.length} Items=${items.length}`)
console.log(`Size=${fs.statSync(outFile).size} bytes`)
