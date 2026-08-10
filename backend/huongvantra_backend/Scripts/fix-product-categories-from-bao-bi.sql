-- Remap CategoryId by SkuCode (ASCII-safe). Root cause fixed in FE applyReferenceCategoriesToSheetData.
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET @NOW = UTC_TIMESTAMP(6);
USE `hvt_product_db`;

-- 9201 Tra xanh Tan Cuong
UPDATE Products p
JOIN (
  SELECT DISTINCT ProductId FROM ProductVariants
  WHERE IsDeleted = 0 AND (
    SkuCode LIKE 'HVT-HONGTRA%'
    OR SkuCode LIKE 'HVT-HOABUOI%'
    OR SkuCode LIKE 'HVT-TRAVON%'
    OR SkuCode LIKE 'HVT-THAOMOC%'
    OR SkuCode LIKE 'HVT-THANHHOA%'
    OR SkuCode LIKE 'HVT-SEN-%'
    OR SkuCode LIKE 'HVT-HUONGTRA%'
    OR SkuCode LIKE 'HVT-NGOCXUAN%'
    OR SkuCode LIKE 'HVT-TAMPHUC%'
    OR SkuCode LIKE 'HVT-LUCBAO%'
    OR SkuCode LIKE 'HVT-NONTOM%'
  )
) v ON v.ProductId = p.Id
SET p.CategoryId = 9201, p.UpdatedAt = @NOW
WHERE p.IsDeleted = 0;

-- 9202 Set Qua
UPDATE Products p
JOIN (
  SELECT DISTINCT ProductId FROM ProductVariants
  WHERE IsDeleted = 0 AND SkuCode LIKE 'HVT-SET-%'
) v ON v.ProductId = p.Id
SET p.CategoryId = 9202, p.UpdatedAt = @NOW
WHERE p.IsDeleted = 0;

-- 9203 Keo Tra
UPDATE Products p
JOIN (
  SELECT DISTINCT ProductId FROM ProductVariants
  WHERE IsDeleted = 0 AND SkuCode IN ('HVT-KEOTRA', 'HVT-CHELAM-MATCHA')
) v ON v.ProductId = p.Id
SET p.CategoryId = 9203, p.UpdatedAt = @NOW
WHERE p.IsDeleted = 0;

-- 9204 Dung Cu Tra
UPDATE Products p
JOIN (
  SELECT DISTINCT ProductId FROM ProductVariants
  WHERE IsDeleted = 0 AND (
    SkuCode LIKE 'HVT-TONG-%'
    OR SkuCode LIKE 'HVT-XUC-%'
  )
) v ON v.ProductId = p.Id
SET p.CategoryId = 9204, p.UpdatedAt = @NOW
WHERE p.IsDeleted = 0;

-- 9205 Hoa Tra
UPDATE Products p
JOIN (
  SELECT DISTINCT ProductId FROM ProductVariants
  WHERE IsDeleted = 0 AND SkuCode LIKE 'HVT-HOATRA%'
) v ON v.ProductId = p.Id
SET p.CategoryId = 9205, p.UpdatedAt = @NOW
WHERE p.IsDeleted = 0;

-- 9207 Tra nguyen lieu
UPDATE Products p
JOIN (
  SELECT DISTINCT ProductId FROM ProductVariants
  WHERE IsDeleted = 0 AND SkuCode LIKE 'NL-%'
) v ON v.ProductId = p.Id
SET p.CategoryId = 9207, p.UpdatedAt = @NOW
WHERE p.IsDeleted = 0;

-- 9208 Bao bi (BB-*)
UPDATE Products p
JOIN (
  SELECT DISTINCT ProductId FROM ProductVariants
  WHERE IsDeleted = 0 AND SkuCode LIKE 'BB-%'
) v ON v.ProductId = p.Id
SET p.CategoryId = 9208, p.UpdatedAt = @NOW
WHERE p.IsDeleted = 0;

SELECT c.Id, c.Name, COUNT(p.Id) AS ProductCount
FROM Categories c
LEFT JOIN Products p ON p.CategoryId = c.Id AND p.IsDeleted = 0
WHERE c.IsDeleted = 0
GROUP BY c.Id, c.Name
ORDER BY c.Id;
