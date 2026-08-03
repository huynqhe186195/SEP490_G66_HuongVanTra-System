-- Khai don vi tinh cho 8 nguyen lieu dang hoat dong (hvt_product_db)
--
-- Hien trang: 8 variant NL-* (IsActive=1) KHONG co dong ProductUnits nao.
-- 3 dong ProductUnits UnitName='Kg' duy nhat lai thuoc variant OLD-* da khai tu,
-- va deu sai: ConversionRate=1 (dang le 1000), IsBaseUnit=1 (dang le 0).
--
-- Muc tieu: moi nguyen lieu co 2 don vi
--   - g  : don vi co so (ConversionRate=1, IsBaseUnit=1) - khop InventoryUnit='Gram'
--   - kg : don vi quy doi (ConversionRate=1000, IsBaseUnit=0) - de nhap NCC theo kg
-- IsDirectSell=0 vi nguyen lieu khong ban truc tiep.

START TRANSACTION;

-- 1) Sua 3 dong Kg sai tren variant OLD-* (giu lai de lich su nhat quan)
UPDATE ProductUnits
SET ConversionRate = 1000, IsBaseUnit = 0, IsDirectSell = 0, UpdatedAt = UTC_TIMESTAMP(6)
WHERE LOWER(UnitName) = 'kg' AND ConversionRate = 1;

-- 2) Them don vi co so 'g' cho 8 nguyen lieu dang hoat dong
INSERT INTO ProductUnits (Id, ProductId, VariantId, UnitName, ConversionRate, Price, Barcode, IsDirectSell, IsBaseUnit, CreatedAt, UpdatedAt, IsDeleted)
SELECT UUID(), v.ProductId, v.Id, 'g', 1, NULL, NULL, 0, 1, UTC_TIMESTAMP(6), NULL, 0
FROM ProductVariants v
JOIN Products p ON p.Id = v.ProductId
WHERE v.IsActive = 1
  AND p.InventoryUnit = 'Gram'
  AND NOT EXISTS (
      SELECT 1 FROM ProductUnits u
      WHERE u.VariantId = v.Id AND LOWER(u.UnitName) = 'g' AND u.IsDeleted = 0);

-- 3) Them don vi quy doi 'kg' cho 8 nguyen lieu dang hoat dong
INSERT INTO ProductUnits (Id, ProductId, VariantId, UnitName, ConversionRate, Price, Barcode, IsDirectSell, IsBaseUnit, CreatedAt, UpdatedAt, IsDeleted)
SELECT UUID(), v.ProductId, v.Id, 'kg', 1000, NULL, NULL, 0, 0, UTC_TIMESTAMP(6), NULL, 0
FROM ProductVariants v
JOIN Products p ON p.Id = v.ProductId
WHERE v.IsActive = 1
  AND p.InventoryUnit = 'Gram'
  AND NOT EXISTS (
      SELECT 1 FROM ProductUnits u
      WHERE u.VariantId = v.Id AND LOWER(u.UnitName) = 'kg' AND u.IsDeleted = 0);

COMMIT;

-- Luu y: sau buoc nay, backend van CHUA doc ConversionRate khi nhap NCC.
-- InventoryLogic.NormalizeSupplierReceiptQuantity (dong ~5934) dang hardcode 1000m
-- cho dung cap kg->g. Can sua rieng o tang code neu muon ho tro bao/thung/lang.
