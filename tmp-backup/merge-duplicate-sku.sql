-- Gop 3 SKU trung ma dang chia doi ton kho (NL-TRAXANH-1KG, NL-HOASEN-1KG, NL-OLONG-1KG)
-- Backup truoc khi chay: tmp-backup/inventory-before-sku-merge.sql
-- DB: hvt_inventory_db
--
-- Nguon goc loi: ProductService doi ma 3 variant cu thanh OLD-* + IsActive=0,
-- nhung InventoryService khong nhan duoc cap nhat => SkuStocks giu 2 ban ghi cung SkuCode.
-- SkuCode KHONG unique nen ton tai duoc.
--
-- Anh xa cu -> moi:
--   20000000-...-000000000011  ->  a2000027-...  (NL-TRAXANH-1KG)  +141000 g
--   20000000-...-000000000012  ->  a2000029-...  (NL-HOASEN-1KG)   + 58000 g
--   20000000-...-000000000013  ->  a2000028-...  (NL-OLONG-1KG)    +120000 g
--
-- KHONG dong toi StocktakeRequestItems: 6 dong gan SkuId cu deu Variance=0,
-- khong sinh phieu xuat/nhap, va 1 trong 2 phieu da Completed (khong sua lich su).

START TRANSACTION;

-- 1) Cong don ton kho tu ban ghi cu sang ban ghi moi
UPDATE SkuStocks n
JOIN SkuStocks o ON o.SkuCode = n.SkuCode AND o.SkuId <> n.SkuId
SET n.WarehouseQuantityOnHand = n.WarehouseQuantityOnHand + o.WarehouseQuantityOnHand,
    n.QuantityOnHand          = n.QuantityOnHand + o.QuantityOnHand,
    n.ReservedQuantity        = n.ReservedQuantity + o.ReservedQuantity,
    n.UpdatedAt               = UTC_TIMESTAMP(6)
WHERE n.SkuId IN ('a2000027-0000-4000-8000-0000a2000027',
                  'a2000028-0000-4000-8000-0000a2000028',
                  'a2000029-0000-4000-8000-0000a2000029')
  AND o.SkuId IN ('20000000-0000-0000-0000-000000000011',
                  '20000000-0000-0000-0000-000000000012',
                  '20000000-0000-0000-0000-000000000013');

-- 2) Tro SkuId cu -> moi tren cac bang tham chieu
--    FEFO tra lo theo WarehouseBatchItems.SkuId (WarehouseBatchRepository.cs:81),
--    nen buoc nay bat buoc de 4 lo cu xuat duoc.
UPDATE WarehouseBatchItems SET SkuId='a2000027-0000-4000-8000-0000a2000027' WHERE SkuId='20000000-0000-0000-0000-000000000011';
UPDATE WarehouseBatchItems SET SkuId='a2000029-0000-4000-8000-0000a2000029' WHERE SkuId='20000000-0000-0000-0000-000000000012';
UPDATE WarehouseBatchItems SET SkuId='a2000028-0000-4000-8000-0000a2000028' WHERE SkuId='20000000-0000-0000-0000-000000000013';

UPDATE InventoryLedgerEntries SET SkuId='a2000027-0000-4000-8000-0000a2000027' WHERE SkuId='20000000-0000-0000-0000-000000000011';
UPDATE InventoryLedgerEntries SET SkuId='a2000029-0000-4000-8000-0000a2000029' WHERE SkuId='20000000-0000-0000-0000-000000000012';
UPDATE InventoryLedgerEntries SET SkuId='a2000028-0000-4000-8000-0000a2000028' WHERE SkuId='20000000-0000-0000-0000-000000000013';

UPDATE StockExportSlipLines SET SkuId='a2000027-0000-4000-8000-0000a2000027' WHERE SkuId='20000000-0000-0000-0000-000000000011';
UPDATE StockExportSlipLines SET SkuId='a2000029-0000-4000-8000-0000a2000029' WHERE SkuId='20000000-0000-0000-0000-000000000012';
UPDATE StockExportSlipLines SET SkuId='a2000028-0000-4000-8000-0000a2000028' WHERE SkuId='20000000-0000-0000-0000-000000000013';

-- 3) Xoa ban ghi ton kho cu (khong co khoa ngoai nao tro toi SkuStocks - da kiem tra)
DELETE FROM SkuStocks
WHERE SkuId IN ('20000000-0000-0000-0000-000000000011',
                '20000000-0000-0000-0000-000000000012',
                '20000000-0000-0000-0000-000000000013');

COMMIT;

-- Ket qua ky vong sau khi chay:
--   NL-TRAXANH-1KG (a2000027) : 2.235.000 g  (4 lo)
--   NL-HOASEN-1KG  (a2000029) : 1.654.000 g  (4 lo)
--   NL-OLONG-1KG   (a2000028) : 1.014.000 g  (4 lo)
