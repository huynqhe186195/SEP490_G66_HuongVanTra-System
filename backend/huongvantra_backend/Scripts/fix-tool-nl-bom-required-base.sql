-- =============================================================================
-- Fix: NL dụng cụ trà không vào bán-trước-trừ-sau vì IsRequiredBaseComponent=1
-- → ProductService bom-catalog loại bỏ dòng đó → Inventory không trừ NL.
--
-- Windows:
--   docker cp backend/huongvantra_backend/Scripts/fix-tool-nl-bom-required-base.sql hvt-mysql:/tmp/fix-nl-bom.sql
--   docker exec hvt-mysql mysql -uhvtuser -phvtpass123 --default-character-set=utf8mb4 -e "source /tmp/fix-nl-bom.sql"
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET @NOW = UTC_TIMESTAMP(6);

USE `hvt_product_db`;

UPDATE ProductVariantBomLines b
INNER JOIN ProductVariants fv
  ON fv.Id = b.ProductVariantId AND fv.IsDeleted = 0
INNER JOIN ProductVariants cv
  ON cv.Id = b.ComponentVariantId AND cv.IsDeleted = 0
SET
  b.IsRequiredBaseComponent = 0,
  b.UpdatedAt = @NOW
WHERE b.IsDeleted = 0
  AND b.IsRequiredBaseComponent = 1
  AND (fv.SkuCode LIKE 'HVT-XUC-%' OR fv.SkuCode LIKE 'HVT-TONG-%')
  AND (cv.SkuCode LIKE 'NL-XUC-%' OR cv.SkuCode LIKE 'NL-TONG-%');

-- Đảm bảo TP dụng cụ có thể mang BOM vận hành; NL có thể làm component
UPDATE ProductVariants v
SET
  v.CanHaveBom = 1,
  v.UpdatedAt = @NOW
WHERE v.IsDeleted = 0
  AND (v.SkuCode LIKE 'HVT-XUC-%' OR v.SkuCode LIKE 'HVT-TONG-%');

UPDATE ProductVariants v
SET
  v.CanBeBomComponent = 1,
  v.IsSellable = 0,
  v.UpdatedAt = @NOW
WHERE v.IsDeleted = 0
  AND (v.SkuCode LIKE 'NL-XUC-%' OR v.SkuCode LIKE 'NL-TONG-%');

SELECT fv.SkuCode AS FinishedSku, cv.SkuCode AS ComponentSku,
       b.Quantity, b.IsRequiredBaseComponent
FROM ProductVariantBomLines b
JOIN ProductVariants fv ON fv.Id = b.ProductVariantId AND fv.IsDeleted = 0
JOIN ProductVariants cv ON cv.Id = b.ComponentVariantId AND cv.IsDeleted = 0
WHERE b.IsDeleted = 0
  AND (fv.SkuCode LIKE 'HVT-XUC-%' OR fv.SkuCode LIKE 'HVT-TONG-%')
ORDER BY fv.SkuCode, cv.SkuCode;
