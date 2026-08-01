-- Read-only audit for Batch 4. This script contains SELECT statements only.
-- It reports legacy and consistency issues; it never changes application data.
--
-- Capability matrix mirrors ProductService.Application/Validation/ProductCapabilityRules.cs
-- and ProductService.Application/Validation/BomCapabilityRules.cs:
--   ProductType in ('THANH_PHAM', 'NGUYEN_LIEU', 'BAO_BI').
--   CanOwnBom      = ProductType = 'THANH_PHAM' AND CanHaveBom = 1 AND IsActive = 1.
--   CanBeComponent = ProductType in ('NGUYEN_LIEU', 'BAO_BI', 'THANH_PHAM')
--                    AND CanBeBomComponent = 1 AND IsActive = 1.
--   For THANH_PHAM both CanBeBomComponent and CanHaveBom are caller-overridable defaults,
--   so a THANH_PHAM component is not a violation by itself.
--   For NGUYEN_LIEU and BAO_BI, CanHaveBom is hard-coded false, so CanHaveBom = 1 is a violation.

-- A. Invalid ProductType and capability matrix violations.
SELECT 'A_INVALID_PRODUCT_TYPE' AS ReportSection, p.Id AS ProductId, p.Name AS ProductName,
       p.ProductType, v.Id AS VariantId, v.SkuCode,
       v.IsPurchasable, v.CanBeBomComponent, v.CanUseInCustom, v.CanHaveBom
FROM Products p
LEFT JOIN ProductVariants v ON v.ProductId = p.Id AND v.IsDeleted = 0
WHERE p.IsDeleted = 0
  AND (p.ProductType IS NULL OR LTRIM(RTRIM(p.ProductType)) = ''
       OR p.ProductType NOT IN ('THANH_PHAM', 'NGUYEN_LIEU', 'BAO_BI'))
UNION ALL
SELECT 'A_CAPABILITY_MATRIX', p.Id, p.Name, p.ProductType, v.Id, v.SkuCode,
       v.IsPurchasable, v.CanBeBomComponent, v.CanUseInCustom, v.CanHaveBom
FROM Products p
JOIN ProductVariants v ON v.ProductId = p.Id AND v.IsDeleted = 0
WHERE p.IsDeleted = 0
  AND p.ProductType IN ('NGUYEN_LIEU', 'BAO_BI')
  AND v.CanHaveBom = 1;

-- B. Operational BOM violations. Only lines with IsRequiredBaseComponent = 0 are operational.
WITH OperationalBomLines AS (
    SELECT b.Id AS BomLineId, b.ProductVariantId, b.MaterialId, b.ComponentVariantId, b.Quantity,
           outputVariant.SkuCode AS OutputSku, outputVariant.IsActive AS OutputIsActive,
           outputVariant.CanHaveBom AS OutputCanHaveBom, outputProduct.ProductType AS OutputProductType,
           componentVariant.SkuCode AS ComponentSku, componentVariant.IsActive AS ComponentIsActive,
           componentVariant.CanBeBomComponent AS ComponentCanBeBomComponent,
           COALESCE(componentProduct.ProductType, materialProduct.ProductType) AS ComponentProductType
    FROM ProductVariantBomLines b
    JOIN ProductVariants outputVariant ON outputVariant.Id = b.ProductVariantId AND outputVariant.IsDeleted = 0
    JOIN Products outputProduct ON outputProduct.Id = outputVariant.ProductId AND outputProduct.IsDeleted = 0
    LEFT JOIN ProductVariants componentVariant ON componentVariant.Id = b.ComponentVariantId AND componentVariant.IsDeleted = 0
    LEFT JOIN Products componentProduct ON componentProduct.Id = componentVariant.ProductId AND componentProduct.IsDeleted = 0
    LEFT JOIN Products materialProduct ON materialProduct.Id = b.MaterialId AND materialProduct.IsDeleted = 0
    WHERE b.IsDeleted = 0 AND b.IsRequiredBaseComponent = 0
)
SELECT 'B_OPERATIONAL_BOM' AS ReportSection, BomLineId, OutputSku, OutputProductType,
       ComponentSku, ComponentProductType, Quantity,
       CASE WHEN OutputProductType <> 'THANH_PHAM' THEN 'OUTPUT_NOT_THANH_PHAM'
            WHEN OutputCanHaveBom = 0 THEN 'OUTPUT_CAN_HAVE_BOM_FALSE'
            WHEN OutputIsActive = 0 THEN 'OUTPUT_INACTIVE'
            WHEN ComponentVariantId IS NOT NULL AND ComponentVariantId = ProductVariantId THEN 'SELF_REFERENCE'
            WHEN ComponentProductType IS NULL
              OR ComponentProductType NOT IN ('NGUYEN_LIEU', 'BAO_BI', 'THANH_PHAM') THEN 'INVALID_COMPONENT_PRODUCT_TYPE'
            WHEN ComponentVariantId IS NOT NULL AND ComponentCanBeBomComponent = 0 THEN 'COMPONENT_CAPABILITY_DISABLED'
            WHEN ComponentVariantId IS NOT NULL AND ComponentIsActive = 0 THEN 'COMPONENT_INACTIVE'
            WHEN Quantity IS NULL OR Quantity <= 0 OR Quantity <> FLOOR(Quantity) THEN 'INVALID_QUANTITY' END AS Violation
FROM OperationalBomLines
WHERE OutputProductType <> 'THANH_PHAM'
   OR OutputCanHaveBom = 0
   OR OutputIsActive = 0
   OR (ComponentVariantId IS NOT NULL AND ComponentVariantId = ProductVariantId)
   OR ComponentProductType IS NULL
   OR ComponentProductType NOT IN ('NGUYEN_LIEU', 'BAO_BI', 'THANH_PHAM')
   OR (ComponentVariantId IS NOT NULL AND ComponentCanBeBomComponent = 0)
   OR (ComponentVariantId IS NOT NULL AND ComponentIsActive = 0)
   OR Quantity IS NULL OR Quantity <= 0 OR Quantity <> FLOOR(Quantity);

-- B2. Duplicate component inside the same output SKU.
SELECT 'B_DUPLICATE_COMPONENT' AS ReportSection, outputVariant.Id AS OutputVariantId,
       outputVariant.SkuCode AS OutputSku, b.MaterialId, b.ComponentVariantId,
       COUNT(*) AS LineCount, 'DUPLICATE_COMPONENT' AS Violation
FROM ProductVariantBomLines b
JOIN ProductVariants outputVariant ON outputVariant.Id = b.ProductVariantId AND outputVariant.IsDeleted = 0
WHERE b.IsDeleted = 0 AND b.IsRequiredBaseComponent = 0
GROUP BY outputVariant.Id, outputVariant.SkuCode, b.MaterialId, b.ComponentVariantId
HAVING COUNT(*) > 1;

-- C. Legacy required-base lines. They are always reported, never accepted as new business data.
SELECT 'C_LEGACY_REQUIRED_BASE' AS ReportSection, b.Id AS BomLineId, outputVariant.SkuCode AS OutputSku,
       componentVariant.SkuCode AS ComponentSku, b.Quantity, outputVariant.ConversionRate,
       CASE WHEN componentVariant.ProductId = outputVariant.ProductId THEN 'SAME_PRODUCT' ELSE 'OTHER_PRODUCT' END AS ProductRelation,
       CASE WHEN componentVariant.IsBaseUnitVariant = 1 THEN 'POINTS_TO_BASE' ELSE 'NOT_BASE_VARIANT' END AS BaseRelation,
       CASE WHEN b.Quantity = outputVariant.ConversionRate THEN 'QUANTITY_MATCHES_RATE' ELSE 'QUANTITY_DIFFERS_RATE' END AS QuantityRelation
FROM ProductVariantBomLines b
JOIN ProductVariants outputVariant ON outputVariant.Id = b.ProductVariantId AND outputVariant.IsDeleted = 0
LEFT JOIN ProductVariants componentVariant ON componentVariant.Id = b.ComponentVariantId AND componentVariant.IsDeleted = 0
WHERE b.IsDeleted = 0 AND b.IsRequiredBaseComponent = 1;

-- D. Derived SKU configuration and BOM consistency against the base operational BOM.
SELECT 'D_DERIVED_CONFIGURATION' AS ReportSection, derived.Id AS DerivedVariantId, derived.SkuCode AS DerivedSku,
       baseVariant.Id AS BaseVariantId, baseVariant.SkuCode AS BaseSku, derived.ConversionRate,
       CASE WHEN derived.BaseVariantId IS NULL THEN 'BASE_VARIANT_MISSING'
            WHEN baseVariant.Id IS NULL THEN 'BASE_VARIANT_INVALID'
            WHEN baseVariant.ProductId <> derived.ProductId THEN 'BASE_VARIANT_OTHER_PRODUCT'
            WHEN baseVariant.IsActive = 0 THEN 'BASE_VARIANT_INACTIVE'
            WHEN baseVariant.IsBaseUnitVariant <> 1 OR baseVariant.BaseVariantId IS NOT NULL THEN 'BASE_VARIANT_NOT_BASE'
            WHEN derived.ConversionRate IS NULL OR derived.ConversionRate <= 0
              OR derived.ConversionRate <> FLOOR(derived.ConversionRate) THEN 'CONVERSION_RATE_INVALID' END AS Violation
FROM ProductVariants derived
LEFT JOIN ProductVariants baseVariant ON baseVariant.Id = derived.BaseVariantId AND baseVariant.IsDeleted = 0
WHERE derived.IsDeleted = 0 AND derived.IsBaseUnitVariant = 0
  AND (derived.BaseVariantId IS NULL OR baseVariant.Id IS NULL OR baseVariant.ProductId <> derived.ProductId
       OR baseVariant.IsActive = 0
       OR baseVariant.IsBaseUnitVariant <> 1 OR baseVariant.BaseVariantId IS NOT NULL
       OR derived.ConversionRate IS NULL OR derived.ConversionRate <= 0
       OR derived.ConversionRate <> FLOOR(derived.ConversionRate));

-- D2. A derived BOM must never contain its own base SKU as a component.
SELECT 'D_DERIVED_BASE_COMPONENT' AS ReportSection, derived.Id AS DerivedVariantId, derived.SkuCode AS DerivedSku,
       baseVariant.Id AS BaseVariantId, baseVariant.SkuCode AS BaseSku, derivedLine.Id AS DerivedBomLineId,
       derivedLine.Quantity, 'DERIVED_BOM_CONTAINS_BASE_SKU' AS Violation
FROM ProductVariants derived
JOIN ProductVariants baseVariant ON baseVariant.Id = derived.BaseVariantId AND baseVariant.IsDeleted = 0
JOIN ProductVariantBomLines derivedLine ON derivedLine.ProductVariantId = derived.Id AND derivedLine.IsDeleted = 0
WHERE derived.IsDeleted = 0 AND derived.IsBaseUnitVariant = 0
  AND derivedLine.ComponentVariantId = baseVariant.Id;

-- D3. Duplicate component inside the same derived SKU.
SELECT 'D_DERIVED_DUPLICATE_LINE' AS ReportSection, derived.Id AS DerivedVariantId, derived.SkuCode AS DerivedSku,
       derivedLine.MaterialId, derivedLine.ComponentVariantId,
       COUNT(*) AS LineCount, 'DUPLICATE_COMPONENT' AS Violation
FROM ProductVariants derived
JOIN ProductVariantBomLines derivedLine ON derivedLine.ProductVariantId = derived.Id AND derivedLine.IsDeleted = 0
WHERE derived.IsDeleted = 0 AND derived.IsBaseUnitVariant = 0
GROUP BY derived.Id, derived.SkuCode, derivedLine.MaterialId, derivedLine.ComponentVariantId
HAVING COUNT(*) > 1;

-- D4. Expected versus actual derived BOM quantities. Expected = base line quantity * ConversionRate.
WITH ExpectedDerivedBomLines AS (
    SELECT derived.Id AS DerivedVariantId, derived.SkuCode AS DerivedSku,
           baseVariant.SkuCode AS BaseSku, baseLine.Id AS BaseBomLineId,
           baseLine.ComponentVariantId, baseLine.MaterialId,
           baseLine.Quantity * derived.ConversionRate AS ExpectedQuantity
    FROM ProductVariants derived
    JOIN ProductVariants baseVariant ON baseVariant.Id = derived.BaseVariantId AND baseVariant.IsDeleted = 0
    JOIN ProductVariantBomLines baseLine ON baseLine.ProductVariantId = baseVariant.Id
        AND baseLine.IsDeleted = 0 AND baseLine.IsRequiredBaseComponent = 0
    WHERE derived.IsDeleted = 0 AND derived.IsBaseUnitVariant = 0
), ActualDerivedBomLines AS (
    SELECT derived.Id AS DerivedVariantId, derived.SkuCode AS DerivedSku,
           baseVariant.SkuCode AS BaseSku, derivedLine.Id AS DerivedBomLineId,
           derivedLine.ComponentVariantId, derivedLine.MaterialId,
           derivedLine.Quantity AS DerivedQuantity, derivedLine.IsRequiredBaseComponent
    FROM ProductVariants derived
    JOIN ProductVariants baseVariant ON baseVariant.Id = derived.BaseVariantId AND baseVariant.IsDeleted = 0
    JOIN ProductVariantBomLines derivedLine ON derivedLine.ProductVariantId = derived.Id
        AND derivedLine.IsDeleted = 0
    WHERE derived.IsDeleted = 0 AND derived.IsBaseUnitVariant = 0
)
SELECT 'D_DERIVED_BOM_MISMATCH' AS ReportSection, expected.DerivedSku, expected.BaseSku,
       NULL AS DerivedBomLineId, expected.BaseBomLineId,
       NULL AS DerivedQuantity, expected.ExpectedQuantity,
       'MISSING_DERIVED_LINE' AS Violation
FROM ExpectedDerivedBomLines expected
LEFT JOIN ActualDerivedBomLines actual ON actual.DerivedVariantId = expected.DerivedVariantId
  AND ((actual.ComponentVariantId = expected.ComponentVariantId)
       OR (actual.ComponentVariantId IS NULL AND expected.ComponentVariantId IS NULL
           AND actual.MaterialId = expected.MaterialId))
WHERE actual.DerivedBomLineId IS NULL
UNION ALL
SELECT 'D_DERIVED_BOM_MISMATCH', expected.DerivedSku, expected.BaseSku,
       actual.DerivedBomLineId, expected.BaseBomLineId,
       actual.DerivedQuantity, expected.ExpectedQuantity,
       CASE WHEN actual.IsRequiredBaseComponent = 1 THEN 'LEGACY_REQUIRED_BASE_LINE'
            ELSE 'QUANTITY_MISMATCH' END
FROM ExpectedDerivedBomLines expected
JOIN ActualDerivedBomLines actual ON actual.DerivedVariantId = expected.DerivedVariantId
  AND ((actual.ComponentVariantId = expected.ComponentVariantId)
       OR (actual.ComponentVariantId IS NULL AND expected.ComponentVariantId IS NULL
           AND actual.MaterialId = expected.MaterialId))
WHERE actual.IsRequiredBaseComponent = 1 OR actual.DerivedQuantity <> expected.ExpectedQuantity
UNION ALL
SELECT 'D_DERIVED_BOM_MISMATCH', actual.DerivedSku, actual.BaseSku,
       actual.DerivedBomLineId, NULL AS BaseBomLineId,
       actual.DerivedQuantity, NULL AS ExpectedQuantity,
       CASE WHEN actual.IsRequiredBaseComponent = 1 THEN 'LEGACY_REQUIRED_BASE_LINE'
            ELSE 'EXTRA_DERIVED_LINE' END
FROM ActualDerivedBomLines actual
LEFT JOIN ExpectedDerivedBomLines expected ON expected.DerivedVariantId = actual.DerivedVariantId
  AND ((expected.ComponentVariantId = actual.ComponentVariantId)
       OR (expected.ComponentVariantId IS NULL AND actual.ComponentVariantId IS NULL
           AND expected.MaterialId = actual.MaterialId))
WHERE expected.BaseBomLineId IS NULL;

-- E. MaterialId ambiguity and ComponentVariantId ownership mismatch.
SELECT 'E_MATERIAL_AMBIGUITY' AS ReportSection, b.Id AS BomLineId, b.MaterialId, b.ComponentVariantId,
       COUNT(activeVariant.Id) AS ActiveSkuCount,
       CASE WHEN COUNT(activeVariant.Id) = 0 THEN 'MATERIAL_HAS_NO_ACTIVE_SKU'
            WHEN COUNT(activeVariant.Id) > 1 THEN 'MATERIAL_HAS_MULTIPLE_ACTIVE_SKU' END AS Violation
FROM ProductVariantBomLines b
LEFT JOIN ProductVariants activeVariant ON activeVariant.ProductId = b.MaterialId AND activeVariant.IsDeleted = 0 AND activeVariant.IsActive = 1
WHERE b.IsDeleted = 0 AND b.MaterialId IS NOT NULL
GROUP BY b.Id, b.MaterialId, b.ComponentVariantId
HAVING COUNT(activeVariant.Id) <> 1;

SELECT 'E_COMPONENT_VARIANT_OWNERSHIP' AS ReportSection, b.Id AS BomLineId, b.MaterialId, b.ComponentVariantId,
       componentVariant.ProductId AS ComponentProductId, 'COMPONENT_VARIANT_NOT_OWNED_BY_MATERIAL' AS Violation
FROM ProductVariantBomLines b
JOIN ProductVariants componentVariant ON componentVariant.Id = b.ComponentVariantId AND componentVariant.IsDeleted = 0
WHERE b.IsDeleted = 0 AND b.MaterialId IS NOT NULL AND componentVariant.ProductId <> b.MaterialId;
