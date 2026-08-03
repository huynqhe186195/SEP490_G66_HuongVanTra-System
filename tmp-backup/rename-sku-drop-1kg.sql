-- Doi ten SKU nguyen lieu: bo hau to '-1KG' + doi VariantName '1kg' -> 'Theo gram'
-- Backup truoc khi chay: tmp-backup/before-sku-rename.sql (593KB, 3 DB)
--
-- Ly do: hau to -1KG va VariantName '1kg' la tan du mo hinh cu (SKU = quy cach dong goi).
-- He thong nay luu nguyen lieu roi theo gram (InventoryUnit='Gram'), vi du NL-ATISO-1KG
-- ton 598000 = 598 kg chu khong phai 598 nghin tui 1kg. Ten cu gay hieu nham tren UI.
--
-- 11 ma bi doi (8 dang hoat dong + 3 variant OLD-* da khai tu):
--   NL-ATISO-1KG      -> NL-ATISO
--   NL-DUONGPHEN-1KG  -> NL-DUONGPHEN
--   NL-HOALAI-1KG     -> NL-HOALAI
--   NL-HOASEN-1KG     -> NL-HOASEN
--   NL-OLONG-1KG      -> NL-OLONG
--   NL-PHUNHI-1KG     -> NL-PHUNHI
--   NL-SHAN-1KG       -> NL-SHAN
--   NL-TRAXANH-1KG    -> NL-TRAXANH
--   OLD-20000000-NL-{HOASEN,OLONG,TRAXANH}-1KG -> bo hau to tuong ung
--
-- Da kiem tra truoc khi chay:
--   * IX_ProductVariants_SkuCode la UNIQUE -> khong ma moi nao trung (TrungMaMoi=0 ca 11 dong)
--   * Tong 109 dong tren 12 bang co du lieu khop
--
-- Pham vi: doi DONG BO moi cot SkuCode (ke ca trong phieu lich su).
-- Ly do doi ca phieu cu: SkuCode la ma dinh danh de tra cuu, khong phai so tien/so luong.
-- Neu giu ma cu trong phieu, mo phieu cu se tra khong ra san pham nao -> te hon.
-- KHONG dong toi cac cot *SnapshotName (ten san pham) vi chung khong chua ma SKU.

START TRANSACTION;

-- ============ hvt_product_db ============
UPDATE hvt_product_db.ProductVariants
SET SkuCode = LEFT(SkuCode, CHAR_LENGTH(SkuCode) - 4),
    VariantName = 'Theo gram',
    UpdatedAt = UTC_TIMESTAMP(6)
WHERE SkuCode LIKE '%-1KG';

UPDATE hvt_product_db.RetailPriceChangeRequests
SET SkuCode = LEFT(SkuCode, CHAR_LENGTH(SkuCode) - 4)
WHERE SkuCode LIKE '%-1KG';

-- ============ hvt_inventory_db ============
UPDATE hvt_inventory_db.SkuStocks
SET SkuCode = LEFT(SkuCode, CHAR_LENGTH(SkuCode) - 4)
WHERE SkuCode LIKE '%-1KG';

UPDATE hvt_inventory_db.WarehouseBatchItems
SET SkuCode = LEFT(SkuCode, CHAR_LENGTH(SkuCode) - 4)
WHERE SkuCode LIKE '%-1KG';

UPDATE hvt_inventory_db.InventoryLedgerEntries
SET SkuCode = LEFT(SkuCode, CHAR_LENGTH(SkuCode) - 4)
WHERE SkuCode LIKE '%-1KG';

UPDATE hvt_inventory_db.StocktakeRequestItems
SET SkuCode = LEFT(SkuCode, CHAR_LENGTH(SkuCode) - 4)
WHERE SkuCode LIKE '%-1KG';

UPDATE hvt_inventory_db.SupplierReceiptItems
SET SkuCode = LEFT(SkuCode, CHAR_LENGTH(SkuCode) - 4)
WHERE SkuCode LIKE '%-1KG';

UPDATE hvt_inventory_db.StockImportSlipLines
SET SkuCode = LEFT(SkuCode, CHAR_LENGTH(SkuCode) - 4)
WHERE SkuCode LIKE '%-1KG';

UPDATE hvt_inventory_db.StockExportSlipLines
SET SkuCode = LEFT(SkuCode, CHAR_LENGTH(SkuCode) - 4)
WHERE SkuCode LIKE '%-1KG';

UPDATE hvt_inventory_db.StockExportBatchAllocations
SET SkuCode = LEFT(SkuCode, CHAR_LENGTH(SkuCode) - 4)
WHERE SkuCode LIKE '%-1KG';

UPDATE hvt_inventory_db.ProductionOrderLines
SET MaterialSkuCode = LEFT(MaterialSkuCode, CHAR_LENGTH(MaterialSkuCode) - 4)
WHERE MaterialSkuCode LIKE '%-1KG';

UPDATE hvt_inventory_db.SupplierProducts
SET SkuCodeSnapshot = LEFT(SkuCodeSnapshot, CHAR_LENGTH(SkuCodeSnapshot) - 4)
WHERE SkuCodeSnapshot LIKE '%-1KG';

-- ============ hvt_order_db ============
UPDATE hvt_order_db.CustomBundleIngredients
SET MaterialSkuCode = LEFT(MaterialSkuCode, CHAR_LENGTH(MaterialSkuCode) - 4)
WHERE MaterialSkuCode LIKE '%-1KG';

-- Cac bang con lai co cot SkuCode nhung 0 dong khop, khong can UPDATE:
--   inv: ProductionOrderOutputLines, ReturnInspections, ShelfReplenishmentSuggestionItems,
--        StockAdjustmentRequestItems, StockExportSlips, StockImportSlips,
--        StockTransferLines, SupplierReturnRequestItems
--   ord: PromotionScopes

COMMIT;
