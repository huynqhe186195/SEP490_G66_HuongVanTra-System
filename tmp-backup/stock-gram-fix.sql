-- Huong A: quy ton kho nguyen lieu tu don vi "bao 1kg" ve gram
-- Pham vi: cac SKU nguyen lieu dang co WeightInGrams = 1000
-- Sau khi chay: 1 don vi ton = 1 gram, dong bo voi Product.InventoryUnit = 'Gram'

SET SESSION sql_mode = 'STRICT_ALL_TABLES';

DROP TEMPORARY TABLE IF EXISTS tmp_kg_skus;
CREATE TEMPORARY TABLE tmp_kg_skus (SkuId CHAR(36) PRIMARY KEY);
INSERT INTO tmp_kg_skus (SkuId)
SELECT Id FROM hvt_product_db.ProductVariants WHERE WeightInGrams = 1000;

START TRANSACTION;

-- 1) Ton kho tong hop
UPDATE hvt_inventory_db.SkuStocks s
JOIN tmp_kg_skus k ON k.SkuId = s.SkuId
SET s.QuantityOnHand             = s.QuantityOnHand * 1000,
    s.WarehouseQuantityOnHand    = s.WarehouseQuantityOnHand * 1000,
    s.ReservedQuantity           = s.ReservedQuantity * 1000,
    s.LowStockThreshold          = s.LowStockThreshold * 1000,
    s.ShelfLowStockThreshold     = s.ShelfLowStockThreshold * 1000,
    s.WarehouseLowStockThreshold = s.WarehouseLowStockThreshold * 1000,
    s.WeightInGrams              = 1,
    s.UpdatedAt                  = UTC_TIMESTAMP(6);

-- 2) Ton theo lo + gia von don vi
UPDATE hvt_inventory_db.WarehouseBatchItems bi
JOIN tmp_kg_skus k ON k.SkuId = bi.SkuId
SET bi.InitialQuantity = bi.InitialQuantity * 1000,
    bi.QuantityOnHand  = bi.QuantityOnHand * 1000,
    bi.UnitCost        = bi.UnitCost / 1000,
    bi.UpdatedAt       = UTC_TIMESTAMP(6);

-- 3) So cai ton kho (ban ghi lich su phai khop voi ton moi)
UPDATE hvt_inventory_db.InventoryLedgerEntries e
JOIN tmp_kg_skus k ON k.SkuId = e.SkuId
SET e.QuantityDelta  = e.QuantityDelta * 1000,
    e.QuantityBefore = e.QuantityBefore * 1000,
    e.QuantityAfter  = e.QuantityAfter * 1000,
    e.Note = CONCAT(COALESCE(e.Note, ''), ' [quy doi kg->g 2026-08-03]');

-- 4) Dong phieu xuat kho nguyen lieu
UPDATE hvt_inventory_db.StockExportSlipLines l
JOIN tmp_kg_skus k ON k.SkuId = l.SkuId
SET l.Quantity           = l.Quantity * 1000,
    l.WarehouseQtyBefore = l.WarehouseQtyBefore * 1000,
    l.WarehouseQtyAfter  = l.WarehouseQtyAfter * 1000;

-- 5) Phan bo lo trong phieu xuat
UPDATE hvt_inventory_db.StockExportBatchAllocations a
JOIN hvt_inventory_db.StockExportSlipLines l ON l.Id = a.StockExportSlipLineId
JOIN tmp_kg_skus k ON k.SkuId = l.SkuId
SET a.Quantity = a.Quantity * 1000;

-- 6) Phieu xuat tong cua lenh san xuat (toan bo dong deu la nguyen lieu)
UPDATE hvt_inventory_db.StockExportSlips
SET Quantity           = Quantity * 1000,
    WarehouseQtyBefore = WarehouseQtyBefore * 1000,
    WarehouseQtyAfter  = WarehouseQtyAfter * 1000
WHERE ExportType = 'production' AND SkuCode = 'MULTI';

-- 7) Dinh muc da hoach dinh trong lenh san xuat
UPDATE hvt_inventory_db.ProductionOrderLines pl
JOIN tmp_kg_skus k ON k.SkuId = pl.MaterialSkuId
SET pl.PlannedQuantity = pl.PlannedQuantity * 1000;

-- 8) Dong kiem ke nguyen lieu
UPDATE hvt_inventory_db.StocktakeRequestItems si
JOIN tmp_kg_skus k ON k.SkuId = si.SkuId
SET si.SystemQuantitySnapshot = si.SystemQuantitySnapshot * 1000,
    si.ActualQuantity         = si.ActualQuantity * 1000,
    si.Variance               = si.Variance * 1000,
    si.WarehouseQtyBefore     = si.WarehouseQtyBefore * 1000,
    si.WarehouseQtyAfter      = si.WarehouseQtyAfter * 1000,
    si.ShelfQtyBefore         = si.ShelfQtyBefore * 1000,
    si.ShelfQtyAfter          = si.ShelfQtyAfter * 1000;

-- 9) Catalog: 1 don vi ton = 1 gram, gia va nguong quy theo gram
UPDATE hvt_product_db.ProductVariants v
JOIN tmp_kg_skus k ON k.SkuId = v.Id
SET v.WeightInGrams = 1,
    v.CostPrice     = v.CostPrice / 1000,
    v.RetailPrice   = v.RetailPrice / 1000,
    v.MinStock      = v.MinStock * 1000,
    v.MaxStock      = v.MaxStock * 1000,
    v.UpdatedAt     = UTC_TIMESTAMP(6);

-- 10) Nhan don vi co so cua san pham nguyen lieu
UPDATE hvt_product_db.Products
SET BaseUnit = 'g', UpdatedAt = UTC_TIMESTAMP(6)
WHERE InventoryUnit = 'Gram'
  AND ProductType = 'NGUYEN_LIEU'
  AND BaseUnit = 'Kg';

COMMIT;

DROP TEMPORARY TABLE IF EXISTS tmp_kg_skus;
