-- =============================================================================
-- Hương Vân Trà — seed thao tác mẫu (đủ dùng, không rác).
-- Điều kiện: đã import/duyệt Excel + chạy Phase B inventory.
-- Không trừ tồn kho (đơn lịch sử chỉ để demo list/báo cáo).
-- Không tạo phiếu NCC Completed (tránh đụng lô/tồn thật).
-- Idempotent theo mã nghiệp vụ cố định.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET @NOW = UTC_TIMESTAMP(6);

SET @SALE_ID = (SELECT Id FROM hvt_user_db.Users WHERE Username = 'sale01' AND IsDeleted = 0 LIMIT 1);
SET @SALE_COD_ID = (SELECT Id FROM hvt_user_db.Users WHERE Username = 'sale_cod01' AND IsDeleted = 0 LIMIT 1);
SET @WH_ID   = (SELECT Id FROM hvt_user_db.Users WHERE Username = 'warehouse01' AND IsDeleted = 0 LIMIT 1);
SET @MGR_ID  = (SELECT Id FROM hvt_user_db.Users WHERE Username = 'manager01' AND IsDeleted = 0 LIMIT 1);

SET @SALE_NAME = (
  SELECT COALESCE(e.FullName, u.Username)
  FROM hvt_user_db.Users u
  LEFT JOIN hvt_user_db.Employees e ON e.UserId = u.Id AND e.IsDeleted = 0
  WHERE u.Id = @SALE_ID LIMIT 1
);
SET @SALE_COD_NAME = (
  SELECT COALESCE(e.FullName, u.Username)
  FROM hvt_user_db.Users u
  LEFT JOIN hvt_user_db.Employees e ON e.UserId = u.Id AND e.IsDeleted = 0
  WHERE u.Id = @SALE_COD_ID LIMIT 1
);
SET @WH_NAME = (
  SELECT COALESCE(e.FullName, u.Username)
  FROM hvt_user_db.Users u
  LEFT JOIN hvt_user_db.Employees e ON e.UserId = u.Id AND e.IsDeleted = 0
  WHERE u.Id = @WH_ID LIMIT 1
);

SET @NCC1 = (SELECT Id FROM hvt_inventory_db.Suppliers WHERE NormalizedSupplierCode = 'NCC-HVT-01' AND IsDeleted = 0 LIMIT 1);
SET @NCC2 = (SELECT Id FROM hvt_inventory_db.Suppliers WHERE NormalizedSupplierCode = 'NCC-HVT-02' AND IsDeleted = 0 LIMIT 1);
SET @NCC3 = (SELECT Id FROM hvt_inventory_db.Suppliers WHERE NormalizedSupplierCode = 'NCC-HVT-03' AND IsDeleted = 0 LIMIT 1);

SET @SKU_NL_TRA   = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'NL-TRA-XANH-G' AND IsDeleted = 0 LIMIT 1);
SET @SKU_NL_HONG  = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'NL-HONG-TRA-G' AND IsDeleted = 0 LIMIT 1);
SET @SKU_NL_BUOI  = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'NL-HOA-BUOI-G' AND IsDeleted = 0 LIMIT 1);
SET @SKU_BB_HOP   = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'BB-HOP-GIAY-HVT' AND IsDeleted = 0 LIMIT 1);
SET @SKU_BB_TUI   = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'BB-TUI-TRA' AND IsDeleted = 0 LIMIT 1);
SET @SKU_BB_TEM   = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'BB-TEM-HVT' AND IsDeleted = 0 LIMIT 1);
SET @SKU_BB_HU    = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'BB-HU-SU-HVT' AND IsDeleted = 0 LIMIT 1);

SET @SKU_HUONG100 = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'HVT-HUONGTRA-100G' AND IsDeleted = 0 LIMIT 1);
SET @SKU_HONG100  = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'HVT-HONGTRA-100G' AND IsDeleted = 0 LIMIT 1);
SET @SKU_TAM100   = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'HVT-TAMPHUC-100G' AND IsDeleted = 0 LIMIT 1);
SET @SKU_KEO      = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'HVT-KEOTRA' AND IsDeleted = 0 LIMIT 1);
SET @SKU_XUC      = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'HVT-XUC-TRE' AND IsDeleted = 0 LIMIT 1);
SET @SKU_SET      = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'HVT-SET-TRONGDONG' AND IsDeleted = 0 LIMIT 1);

-- Fail sớm nếu chưa có catalog Excel / baseline
USE `hvt_product_db`;
CREATE TEMPORARY TABLE IF NOT EXISTS _hvt_sample_ops_assert (ok TINYINT NOT NULL);
DELETE FROM _hvt_sample_ops_assert;
INSERT INTO _hvt_sample_ops_assert (ok)
SELECT CASE
  WHEN @SKU_HUONG100 IS NULL OR @SKU_NL_TRA IS NULL OR @NCC1 IS NULL OR @SALE_ID IS NULL THEN NULL
  ELSE 1
END;
-- Nếu thiếu prerequisite, INSERT trên sẽ fail vì ok NULL.

SET @PROD_NL_TRA  = (SELECT ProductId FROM hvt_product_db.ProductVariants WHERE Id = @SKU_NL_TRA);
SET @PROD_NL_HONG = (SELECT ProductId FROM hvt_product_db.ProductVariants WHERE Id = @SKU_NL_HONG);
SET @PROD_BB_HOP  = (SELECT ProductId FROM hvt_product_db.ProductVariants WHERE Id = @SKU_BB_HOP);

SET @NAME_NL_TRA  = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_NL_TRA);
SET @NAME_NL_HONG = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_NL_HONG);
SET @NAME_NL_BUOI = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_NL_BUOI);
SET @NAME_BB_HOP  = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_BB_HOP);
SET @NAME_BB_TUI  = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_BB_TUI);
SET @NAME_BB_TEM  = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_BB_TEM);
SET @NAME_BB_HU   = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_BB_HU);
SET @NAME_HUONG   = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_HUONG100);
SET @NAME_HONG    = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_HONG100);
SET @NAME_TAM     = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_TAM100);
SET @NAME_KEO     = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_KEO);
SET @NAME_XUC     = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_XUC);
SET @NAME_SET     = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_SET);

SET @PRICE_HUONG = (SELECT RetailPrice FROM hvt_product_db.ProductVariants WHERE Id=@SKU_HUONG100);
SET @COST_HUONG  = (SELECT CostPrice FROM hvt_product_db.ProductVariants WHERE Id=@SKU_HUONG100);
SET @PRICE_HONG  = (SELECT RetailPrice FROM hvt_product_db.ProductVariants WHERE Id=@SKU_HONG100);
SET @COST_HONG   = (SELECT CostPrice FROM hvt_product_db.ProductVariants WHERE Id=@SKU_HONG100);
SET @PRICE_TAM   = (SELECT RetailPrice FROM hvt_product_db.ProductVariants WHERE Id=@SKU_TAM100);
SET @COST_TAM    = (SELECT CostPrice FROM hvt_product_db.ProductVariants WHERE Id=@SKU_TAM100);
SET @PRICE_KEO   = (SELECT RetailPrice FROM hvt_product_db.ProductVariants WHERE Id=@SKU_KEO);
SET @COST_KEO    = (SELECT CostPrice FROM hvt_product_db.ProductVariants WHERE Id=@SKU_KEO);
SET @PRICE_XUC   = (SELECT RetailPrice FROM hvt_product_db.ProductVariants WHERE Id=@SKU_XUC);
SET @COST_XUC    = (SELECT CostPrice FROM hvt_product_db.ProductVariants WHERE Id=@SKU_XUC);
SET @PRICE_SET   = (SELECT RetailPrice FROM hvt_product_db.ProductVariants WHERE Id=@SKU_SET);
SET @COST_SET    = (SELECT CostPrice FROM hvt_product_db.ProductVariants WHERE Id=@SKU_SET);

SET @UNIT_NL = (SELECT InventoryUnit FROM hvt_product_db.Products p JOIN hvt_product_db.ProductVariants v ON v.ProductId=p.Id WHERE v.Id=@SKU_NL_TRA);
SET @UNIT_BB = (SELECT InventoryUnit FROM hvt_product_db.Products p JOIN hvt_product_db.ProductVariants v ON v.ProductId=p.Id WHERE v.Id=@SKU_BB_HOP);

SET @PROMO10 = (SELECT Id FROM hvt_order_db.Promotions WHERE PromoCode = 'HVT10' AND IsDeleted = 0 LIMIT 1);

SET @KH1 = (SELECT Id FROM hvt_customer_db.Customers WHERE CustomerCode='KH-HVT-001' AND IsDeleted=0 LIMIT 1);
SET @KH2 = (SELECT Id FROM hvt_customer_db.Customers WHERE CustomerCode='KH-HVT-002' AND IsDeleted=0 LIMIT 1);
SET @KH3 = (SELECT Id FROM hvt_customer_db.Customers WHERE CustomerCode='KH-HVT-003' AND IsDeleted=0 LIMIT 1);
SET @KH5 = (SELECT Id FROM hvt_customer_db.Customers WHERE CustomerCode='KH-HVT-005' AND IsDeleted=0 LIMIT 1);
SET @KH1_NAME = (SELECT FullName FROM hvt_customer_db.Customers WHERE Id=@KH1);
SET @KH2_NAME = (SELECT FullName FROM hvt_customer_db.Customers WHERE Id=@KH2);
SET @KH3_NAME = (SELECT FullName FROM hvt_customer_db.Customers WHERE Id=@KH3);
SET @KH5_NAME = (SELECT FullName FROM hvt_customer_db.Customers WHERE Id=@KH5);

-- -----------------------------------------------------------------------------
-- 1) SupplierProducts — map NL/BB với NCC
-- -----------------------------------------------------------------------------
USE `hvt_inventory_db`;

INSERT INTO SupplierProducts
  (Id, SupplierId, SkuId, SkuCodeSnapshot, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SupplierItemCode, NormalizedSupplierItemCode, SupplierItemName, QuotedPrice, MinimumOrderQuantity,
   LeadTimeDays, IsPrimarySource, Note, IsActive, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-2001-4000-8000-000000000001', @NCC1, @SKU_NL_TRA, 'NL-TRA-XANH-G', @NAME_NL_TRA, 'NGUYEN_LIEU', @UNIT_NL,
       'TC-TRA-XANH', 'TC-TRA-XANH', 'Trà xanh thô Tân Cương', 180.00, 1000, 3, 1, 'Nguồn chính', 1, @NOW, @NOW
WHERE @SKU_NL_TRA IS NOT NULL AND NOT EXISTS (SELECT 1 FROM SupplierProducts WHERE Id='bbbbbbbb-2001-4000-8000-000000000001');

INSERT INTO SupplierProducts
  (Id, SupplierId, SkuId, SkuCodeSnapshot, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SupplierItemCode, NormalizedSupplierItemCode, SupplierItemName, QuotedPrice, MinimumOrderQuantity,
   LeadTimeDays, IsPrimarySource, Note, IsActive, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-2001-4000-8000-000000000002', @NCC1, @SKU_NL_HONG, 'NL-HONG-TRA-G', @NAME_NL_HONG, 'NGUYEN_LIEU', @UNIT_NL,
       'TC-HONG-TRA', 'TC-HONG-TRA', 'Hồng trà thô', 220.00, 1000, 3, 1, NULL, 1, @NOW, @NOW
WHERE @SKU_NL_HONG IS NOT NULL AND NOT EXISTS (SELECT 1 FROM SupplierProducts WHERE Id='bbbbbbbb-2001-4000-8000-000000000002');

INSERT INTO SupplierProducts
  (Id, SupplierId, SkuId, SkuCodeSnapshot, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SupplierItemCode, NormalizedSupplierItemCode, SupplierItemName, QuotedPrice, MinimumOrderQuantity,
   LeadTimeDays, IsPrimarySource, Note, IsActive, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-2001-4000-8000-000000000003', @NCC1, @SKU_NL_BUOI, 'NL-HOA-BUOI-G', @NAME_NL_BUOI, 'NGUYEN_LIEU', @UNIT_NL,
       'TC-HOA-BUOI', 'TC-HOA-BUOI', 'Hoa bưởi sấy', 900.00, 200, 5, 1, NULL, 1, @NOW, @NOW
WHERE @SKU_NL_BUOI IS NOT NULL AND NOT EXISTS (SELECT 1 FROM SupplierProducts WHERE Id='bbbbbbbb-2001-4000-8000-000000000003');

INSERT INTO SupplierProducts
  (Id, SupplierId, SkuId, SkuCodeSnapshot, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SupplierItemCode, NormalizedSupplierItemCode, SupplierItemName, QuotedPrice, MinimumOrderQuantity,
   LeadTimeDays, IsPrimarySource, Note, IsActive, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-2001-4000-8000-000000000004', @NCC2, @SKU_BB_HOP, 'BB-HOP-GIAY-HVT', @NAME_BB_HOP, 'BAO_BI', @UNIT_BB,
       'MP-HOP-100', 'MP-HOP-100', 'Hộp giấy 100g', 5000.00, 100, 7, 1, NULL, 1, @NOW, @NOW
WHERE @SKU_BB_HOP IS NOT NULL AND NOT EXISTS (SELECT 1 FROM SupplierProducts WHERE Id='bbbbbbbb-2001-4000-8000-000000000004');

INSERT INTO SupplierProducts
  (Id, SupplierId, SkuId, SkuCodeSnapshot, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SupplierItemCode, NormalizedSupplierItemCode, SupplierItemName, QuotedPrice, MinimumOrderQuantity,
   LeadTimeDays, IsPrimarySource, Note, IsActive, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-2001-4000-8000-000000000005', @NCC2, @SKU_BB_TUI, 'BB-TUI-TRA', @NAME_BB_TUI, 'BAO_BI', @UNIT_BB,
       'MP-TUI', 'MP-TUI', 'Túi trà', 1500.00, 200, 7, 1, NULL, 1, @NOW, @NOW
WHERE @SKU_BB_TUI IS NOT NULL AND NOT EXISTS (SELECT 1 FROM SupplierProducts WHERE Id='bbbbbbbb-2001-4000-8000-000000000005');

INSERT INTO SupplierProducts
  (Id, SupplierId, SkuId, SkuCodeSnapshot, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SupplierItemCode, NormalizedSupplierItemCode, SupplierItemName, QuotedPrice, MinimumOrderQuantity,
   LeadTimeDays, IsPrimarySource, Note, IsActive, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-2001-4000-8000-000000000006', @NCC2, @SKU_BB_TEM, 'BB-TEM-HVT', @NAME_BB_TEM, 'BAO_BI', @UNIT_BB,
       'MP-TEM', 'MP-TEM', 'Tem chống giả', 300.00, 500, 5, 1, NULL, 1, @NOW, @NOW
WHERE @SKU_BB_TEM IS NOT NULL AND NOT EXISTS (SELECT 1 FROM SupplierProducts WHERE Id='bbbbbbbb-2001-4000-8000-000000000006');

INSERT INTO SupplierProducts
  (Id, SupplierId, SkuId, SkuCodeSnapshot, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SupplierItemCode, NormalizedSupplierItemCode, SupplierItemName, QuotedPrice, MinimumOrderQuantity,
   LeadTimeDays, IsPrimarySource, Note, IsActive, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-2001-4000-8000-000000000007', @NCC3, @SKU_BB_HU, 'BB-HU-SU-HVT', @NAME_BB_HU, 'BAO_BI', @UNIT_BB,
       'BT-HU50', 'BT-HU50', 'Hũ sứ 50g', 45000.00, 20, 10, 1, NULL, 1, @NOW, @NOW
WHERE @SKU_BB_HU IS NOT NULL AND NOT EXISTS (SELECT 1 FROM SupplierProducts WHERE Id='bbbbbbbb-2001-4000-8000-000000000007');

-- -----------------------------------------------------------------------------
-- 2) Phiếu nhập NCC — 1 Draft + 1 PendingApproval (không Completed)
-- -----------------------------------------------------------------------------
SET @RCP_DRAFT = 'aaaaaaaa-3001-4000-8000-000000000001';
SET @RCP_PEND  = 'aaaaaaaa-3001-4000-8000-000000000002';

INSERT INTO SupplierReceipts
  (Id, ReceiptCode, SupplierName, SupplierReference, SupplierDocumentNumber, SupplierDocumentDate,
   ReceivedDate, Note, Status, CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
   SubmittedBy, SubmittedAt, ReviewedBy, ReviewedByName, ReviewedByRoleName, ReviewedAt, ReviewNote,
   StockImportSlipId, StockImportSlipCode, SupplierId, DeliveredByName, OriginalDocumentReference,
   TotalAmount, SupplierNameSnapshot, SupplierCodeSnapshot)
SELECT @RCP_DRAFT, 'PN-HVT-DEMO-01', 'Nông hộ trà Tân Cương', 'PO-DEMO-01', 'HD-DEMO-01', DATE_SUB(@NOW, INTERVAL 1 DAY),
       DATE_SUB(@NOW, INTERVAL 1 DAY), 'Phiếu nháp demo', 'Draft', @WH_ID, @WH_NAME, 'Warehouse', @NOW, @NOW,
       NULL, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, NULL, @NCC1, 'Nguyễn Văn Giao', NULL,
       470000.00, 'Nông hộ trà Tân Cương', 'NCC-HVT-01'
WHERE NOT EXISTS (SELECT 1 FROM SupplierReceipts WHERE ReceiptCode = 'PN-HVT-DEMO-01');

INSERT INTO SupplierReceiptItems
  (Id, SupplierReceiptId, SkuId, SkuCode, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SubmittedUnit, SubmittedQuantity, Quantity, UnitCost, LotCode, ManufacturedAt, ExpiresAt,
   ActualReceivedQuantity, QualityNote, WarehouseBatchId, WarehouseBatchLotCode,
   WarehouseQtyBefore, WarehouseQtyAfter, ShelfQtyBefore, ShelfQtyAfter, CreatedAt, UpdatedAt,
   DocumentQuantity, LineAmount)
SELECT 'cccccccc-3001-4000-8000-000000000001', @RCP_DRAFT, @SKU_NL_TRA, 'NL-TRA-XANH-G', @NAME_NL_TRA, 'NGUYEN_LIEU', @UNIT_NL,
       @UNIT_NL, 2000, 2000, 180.00, 'LOT-DEMO-TRA-01', DATE_SUB(@NOW, INTERVAL 10 DAY), DATE_ADD(@NOW, INTERVAL 365 DAY),
       2000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, @NOW, @NOW, 2000, 360000.00
WHERE EXISTS (SELECT 1 FROM SupplierReceipts WHERE Id=@RCP_DRAFT)
  AND NOT EXISTS (SELECT 1 FROM SupplierReceiptItems WHERE Id='cccccccc-3001-4000-8000-000000000001');

INSERT INTO SupplierReceiptItems
  (Id, SupplierReceiptId, SkuId, SkuCode, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SubmittedUnit, SubmittedQuantity, Quantity, UnitCost, LotCode, ManufacturedAt, ExpiresAt,
   ActualReceivedQuantity, QualityNote, WarehouseBatchId, WarehouseBatchLotCode,
   WarehouseQtyBefore, WarehouseQtyAfter, ShelfQtyBefore, ShelfQtyAfter, CreatedAt, UpdatedAt,
   DocumentQuantity, LineAmount)
SELECT 'cccccccc-3001-4000-8000-000000000002', @RCP_DRAFT, @SKU_NL_HONG, 'NL-HONG-TRA-G', @NAME_NL_HONG, 'NGUYEN_LIEU', @UNIT_NL,
       @UNIT_NL, 500, 500, 220.00, 'LOT-DEMO-HONG-01', DATE_SUB(@NOW, INTERVAL 8 DAY), DATE_ADD(@NOW, INTERVAL 365 DAY),
       500, NULL, NULL, NULL, NULL, NULL, NULL, NULL, @NOW, @NOW, 500, 110000.00
WHERE EXISTS (SELECT 1 FROM SupplierReceipts WHERE Id=@RCP_DRAFT)
  AND @SKU_NL_HONG IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM SupplierReceiptItems WHERE Id='cccccccc-3001-4000-8000-000000000002');

INSERT INTO SupplierReceipts
  (Id, ReceiptCode, SupplierName, SupplierReference, SupplierDocumentNumber, SupplierDocumentDate,
   ReceivedDate, Note, Status, CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
   SubmittedBy, SubmittedAt, ReviewedBy, ReviewedByName, ReviewedByRoleName, ReviewedAt, ReviewNote,
   StockImportSlipId, StockImportSlipCode, SupplierId, DeliveredByName, OriginalDocumentReference,
   TotalAmount, SupplierNameSnapshot, SupplierCodeSnapshot)
SELECT @RCP_PEND, 'PN-HVT-DEMO-02', 'Công ty Bao bì Minh Phát', 'PO-DEMO-02', 'HD-DEMO-02', DATE_SUB(@NOW, INTERVAL 2 DAY),
       DATE_SUB(@NOW, INTERVAL 1 DAY), 'Chờ duyệt demo', 'PendingApproval', @WH_ID, @WH_NAME, 'Warehouse',
       DATE_SUB(@NOW, INTERVAL 1 DAY), @NOW, @WH_ID, DATE_SUB(@NOW, INTERVAL 1 DAY),
       NULL, NULL, NULL, NULL, NULL,
       NULL, NULL, @NCC2, 'Trần Thị Giao', NULL,
       650000.00, 'Công ty Bao bì Minh Phát', 'NCC-HVT-02'
WHERE NOT EXISTS (SELECT 1 FROM SupplierReceipts WHERE ReceiptCode = 'PN-HVT-DEMO-02');

INSERT INTO SupplierReceiptItems
  (Id, SupplierReceiptId, SkuId, SkuCode, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SubmittedUnit, SubmittedQuantity, Quantity, UnitCost, LotCode, ManufacturedAt, ExpiresAt,
   ActualReceivedQuantity, QualityNote, WarehouseBatchId, WarehouseBatchLotCode,
   WarehouseQtyBefore, WarehouseQtyAfter, ShelfQtyBefore, ShelfQtyAfter, CreatedAt, UpdatedAt,
   DocumentQuantity, LineAmount)
SELECT 'cccccccc-3001-4000-8000-000000000003', @RCP_PEND, @SKU_BB_HOP, 'BB-HOP-GIAY-HVT', @NAME_BB_HOP, 'BAO_BI', @UNIT_BB,
       @UNIT_BB, 100, 100, 5000.00, 'LOT-DEMO-HOP-01', NULL, NULL,
       100, NULL, NULL, NULL, NULL, NULL, NULL, NULL, @NOW, @NOW, 100, 500000.00
WHERE EXISTS (SELECT 1 FROM SupplierReceipts WHERE Id=@RCP_PEND)
  AND @SKU_BB_HOP IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM SupplierReceiptItems WHERE Id='cccccccc-3001-4000-8000-000000000003');

INSERT INTO SupplierReceiptItems
  (Id, SupplierReceiptId, SkuId, SkuCode, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SubmittedUnit, SubmittedQuantity, Quantity, UnitCost, LotCode, ManufacturedAt, ExpiresAt,
   ActualReceivedQuantity, QualityNote, WarehouseBatchId, WarehouseBatchLotCode,
   WarehouseQtyBefore, WarehouseQtyAfter, ShelfQtyBefore, ShelfQtyAfter, CreatedAt, UpdatedAt,
   DocumentQuantity, LineAmount)
SELECT 'cccccccc-3001-4000-8000-000000000004', @RCP_PEND, @SKU_BB_TUI, 'BB-TUI-TRA', @NAME_BB_TUI, 'BAO_BI', @UNIT_BB,
       @UNIT_BB, 100, 100, 1500.00, 'LOT-DEMO-TUI-01', NULL, NULL,
       100, NULL, NULL, NULL, NULL, NULL, NULL, NULL, @NOW, @NOW, 100, 150000.00
WHERE EXISTS (SELECT 1 FROM SupplierReceipts WHERE Id=@RCP_PEND)
  AND @SKU_BB_TUI IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM SupplierReceiptItems WHERE Id='cccccccc-3001-4000-8000-000000000004');

-- -----------------------------------------------------------------------------
-- 3) BOM mẫu — 2 thành phẩm
-- -----------------------------------------------------------------------------
USE `hvt_product_db`;

INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, CreatedAt, UpdatedAt, IsDeleted, ComponentVariantId, IsRequiredBaseComponent)
SELECT @SKU_HUONG100, @PROD_NL_TRA, 100.0000, @NOW, @NOW, 0, @SKU_NL_TRA, 1
WHERE @SKU_HUONG100 IS NOT NULL AND @PROD_NL_TRA IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ProductVariantBomLines
    WHERE ProductVariantId=@SKU_HUONG100 AND ComponentVariantId=@SKU_NL_TRA AND IsDeleted=0
  );

INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, CreatedAt, UpdatedAt, IsDeleted, ComponentVariantId, IsRequiredBaseComponent)
SELECT @SKU_HUONG100, @PROD_BB_HOP, 1.0000, @NOW, @NOW, 0, @SKU_BB_HOP, 0
WHERE @SKU_HUONG100 IS NOT NULL AND @PROD_BB_HOP IS NOT NULL AND @SKU_BB_HOP IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ProductVariantBomLines
    WHERE ProductVariantId=@SKU_HUONG100 AND ComponentVariantId=@SKU_BB_HOP AND IsDeleted=0
  );

INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, CreatedAt, UpdatedAt, IsDeleted, ComponentVariantId, IsRequiredBaseComponent)
SELECT @SKU_HONG100, @PROD_NL_HONG, 100.0000, @NOW, @NOW, 0, @SKU_NL_HONG, 1
WHERE @SKU_HONG100 IS NOT NULL AND @PROD_NL_HONG IS NOT NULL AND @SKU_NL_HONG IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ProductVariantBomLines
    WHERE ProductVariantId=@SKU_HONG100 AND ComponentVariantId=@SKU_NL_HONG AND IsDeleted=0
  );

INSERT INTO ProductVariantBomLines
  (ProductVariantId, MaterialId, Quantity, CreatedAt, UpdatedAt, IsDeleted, ComponentVariantId, IsRequiredBaseComponent)
SELECT @SKU_HONG100, @PROD_BB_HOP, 1.0000, @NOW, @NOW, 0, @SKU_BB_HOP, 0
WHERE @SKU_HONG100 IS NOT NULL AND @PROD_BB_HOP IS NOT NULL AND @SKU_BB_HOP IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ProductVariantBomLines
    WHERE ProductVariantId=@SKU_HONG100 AND ComponentVariantId=@SKU_BB_HOP AND IsDeleted=0
  );

-- -----------------------------------------------------------------------------
-- 4) Đơn hàng mẫu — 4 POS Completed + 1 COD Processing (không trừ tồn)
-- -----------------------------------------------------------------------------
USE `hvt_order_db`;

-- O1: POS cash, 2 dòng
SET @O1 = 'dddddddd-4001-4000-8000-000000000001';
SET @O1_TOTAL = (@PRICE_HUONG * 2) + @PRICE_XUC;
INSERT INTO Orders
  (Id, OrderCode, CustomerId, CustomerSnapshotName, EmployeeId, EmployeeSnapshotName,
   OrderChannel, OrderKind, OrderStatus, InventorySyncStatus,
   TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount,
   ShippingAddress, Note, CreatedAt, UpdatedAt, IsDeleted, IdempotencyKey)
SELECT @O1, 'HVT-SAMPLE-001', @KH1, @KH1_NAME, @SALE_ID, @SALE_NAME,
       'POS', 'Sale', 'Completed', 'Synced',
       @O1_TOTAL, 0, NULL, NULL, 0, @O1_TOTAL,
       NULL, 'Đơn POS demo tiền mặt', DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), 0, 'seed-hvt-sample-001'
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode='HVT-SAMPLE-001');

INSERT INTO OrderDetails
  (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, CategorySnapshotName, Quantity, CostPrice,
   ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted, IsGift)
SELECT '22222222-4001-4000-8000-000000000001', @O1, @SKU_HUONG100, @NAME_HUONG, 'HVT-HUONGTRA-100G', 'Trà', 2, @COST_HUONG,
       0, @PRICE_HUONG, @PRICE_HUONG*2, DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), 0, 0
WHERE EXISTS (SELECT 1 FROM Orders WHERE Id=@O1)
  AND NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id='22222222-4001-4000-8000-000000000001');

INSERT INTO OrderDetails
  (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, CategorySnapshotName, Quantity, CostPrice,
   ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted, IsGift)
SELECT '22222222-4001-4000-8000-000000000002', @O1, @SKU_XUC, @NAME_XUC, 'HVT-XUC-TRE', 'Dụng cụ', 1, @COST_XUC,
       0, @PRICE_XUC, @PRICE_XUC, DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), 0, 0
WHERE EXISTS (SELECT 1 FROM Orders WHERE Id=@O1) AND @SKU_XUC IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id='22222222-4001-4000-8000-000000000002');

INSERT INTO Payments
  (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt,
   TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-4001-4000-8000-000000000001', @O1, 'Cash', @O1_TOTAL, 'Success', NULL, 0,
       DATE_SUB(@NOW, INTERVAL 3 DAY), NULL, NULL, DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), 0
WHERE EXISTS (SELECT 1 FROM Orders WHERE Id=@O1)
  AND NOT EXISTS (SELECT 1 FROM Payments WHERE Id='33333333-4001-4000-8000-000000000001');

-- O2: POS + promo HVT10
SET @O2 = 'dddddddd-4001-4000-8000-000000000002';
SET @O2_GROSS = @PRICE_SET + @PRICE_KEO;
SET @O2_DISC = LEAST(ROUND(@O2_GROSS * 0.10, 2), 100000.00);
SET @O2_FINAL = @O2_GROSS - @O2_DISC;
INSERT INTO Orders
  (Id, OrderCode, CustomerId, CustomerSnapshotName, EmployeeId, EmployeeSnapshotName,
   OrderChannel, OrderKind, OrderStatus, InventorySyncStatus,
   TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount,
   ShippingAddress, Note, CreatedAt, UpdatedAt, IsDeleted, IdempotencyKey)
SELECT @O2, 'HVT-SAMPLE-002', @KH3, @KH3_NAME, @SALE_ID, @SALE_NAME,
       'POS', 'Sale', 'Completed', 'Synced',
       @O2_GROSS, @O2_DISC, @PROMO10, 'HVT10', @O2_DISC, @O2_FINAL,
       NULL, 'Đơn POS demo có khuyến mãi HVT10', DATE_SUB(@NOW, INTERVAL 2 DAY), DATE_SUB(@NOW, INTERVAL 2 DAY), 0, 'seed-hvt-sample-002'
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode='HVT-SAMPLE-002');

INSERT INTO OrderDetails
  (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, CategorySnapshotName, Quantity, CostPrice,
   ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted, IsGift)
SELECT '22222222-4001-4000-8000-000000000003', @O2, @SKU_SET, @NAME_SET, 'HVT-SET-TRONGDONG', 'Set quà', 1, @COST_SET,
       0, @PRICE_SET, @PRICE_SET, DATE_SUB(@NOW, INTERVAL 2 DAY), DATE_SUB(@NOW, INTERVAL 2 DAY), 0, 0
WHERE EXISTS (SELECT 1 FROM Orders WHERE Id=@O2) AND @SKU_SET IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id='22222222-4001-4000-8000-000000000003');

INSERT INTO OrderDetails
  (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, CategorySnapshotName, Quantity, CostPrice,
   ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted, IsGift)
SELECT '22222222-4001-4000-8000-000000000004', @O2, @SKU_KEO, @NAME_KEO, 'HVT-KEOTRA', 'Kẹo trà', 1, @COST_KEO,
       0, @PRICE_KEO, @PRICE_KEO, DATE_SUB(@NOW, INTERVAL 2 DAY), DATE_SUB(@NOW, INTERVAL 2 DAY), 0, 0
WHERE EXISTS (SELECT 1 FROM Orders WHERE Id=@O2) AND @SKU_KEO IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id='22222222-4001-4000-8000-000000000004');

INSERT INTO Payments
  (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt,
   TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-4001-4000-8000-000000000002', @O2, 'VietQR', @O2_FINAL, 'Success', 'QR-DEMO-002', 0,
       DATE_SUB(@NOW, INTERVAL 2 DAY), NULL, NULL, DATE_SUB(@NOW, INTERVAL 2 DAY), DATE_SUB(@NOW, INTERVAL 2 DAY), 0
WHERE EXISTS (SELECT 1 FROM Orders WHERE Id=@O2)
  AND NOT EXISTS (SELECT 1 FROM Payments WHERE Id='33333333-4001-4000-8000-000000000002');

-- O3: POS walk-in nhỏ
SET @O3 = 'dddddddd-4001-4000-8000-000000000003';
SET @O3_TOTAL = @PRICE_HONG + @PRICE_TAM;
INSERT INTO Orders
  (Id, OrderCode, CustomerId, CustomerSnapshotName, EmployeeId, EmployeeSnapshotName,
   OrderChannel, OrderKind, OrderStatus, InventorySyncStatus,
   TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount,
   ShippingAddress, Note, CreatedAt, UpdatedAt, IsDeleted, IdempotencyKey)
SELECT @O3, 'HVT-SAMPLE-003', @KH2, @KH2_NAME, @SALE_ID, @SALE_NAME,
       'POS', 'Sale', 'Completed', 'Synced',
       @O3_TOTAL, 0, NULL, NULL, 0, @O3_TOTAL,
       NULL, 'Đơn POS demo hồng trà + tam phúc', DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0, 'seed-hvt-sample-003'
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode='HVT-SAMPLE-003');

INSERT INTO OrderDetails
  (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, CategorySnapshotName, Quantity, CostPrice,
   ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted, IsGift)
SELECT '22222222-4001-4000-8000-000000000005', @O3, @SKU_HONG100, @NAME_HONG, 'HVT-HONGTRA-100G', 'Trà', 1, @COST_HONG,
       0, @PRICE_HONG, @PRICE_HONG, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0, 0
WHERE EXISTS (SELECT 1 FROM Orders WHERE Id=@O3) AND @SKU_HONG100 IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id='22222222-4001-4000-8000-000000000005');

INSERT INTO OrderDetails
  (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, CategorySnapshotName, Quantity, CostPrice,
   ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted, IsGift)
SELECT '22222222-4001-4000-8000-000000000006', @O3, @SKU_TAM100, @NAME_TAM, 'HVT-TAMPHUC-100G', 'Trà', 1, @COST_TAM,
       0, @PRICE_TAM, @PRICE_TAM, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0, 0
WHERE EXISTS (SELECT 1 FROM Orders WHERE Id=@O3) AND @SKU_TAM100 IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id='22222222-4001-4000-8000-000000000006');

INSERT INTO Payments
  (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt,
   TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-4001-4000-8000-000000000003', @O3, 'Cash', @O3_TOTAL, 'Success', NULL, 0,
       DATE_SUB(@NOW, INTERVAL 1 DAY), NULL, NULL, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE EXISTS (SELECT 1 FROM Orders WHERE Id=@O3)
  AND NOT EXISTS (SELECT 1 FROM Payments WHERE Id='33333333-4001-4000-8000-000000000003');

-- O4: COD mẫu thuộc sale_cod01 (để Sale COD thấy báo cáo cuối ngày)
SET @O4 = 'dddddddd-4001-4000-8000-000000000004';
SET @O4_TOTAL = @PRICE_HUONG * 3;
SET @ADDR = (SELECT CONCAT(AddressLine, ', ', Ward, ', ', District, ', ', Province)
             FROM hvt_customer_db.CustomerAddresses
             WHERE CustomerId=@KH5 AND IsDeleted=0 ORDER BY IsDefault DESC LIMIT 1);
SET @O4_EMP_ID = COALESCE(@SALE_COD_ID, @SALE_ID);
SET @O4_EMP_NAME = COALESCE(@SALE_COD_NAME, @SALE_NAME);
INSERT INTO Orders
  (Id, OrderCode, CustomerId, CustomerSnapshotName, EmployeeId, EmployeeSnapshotName,
   OrderChannel, OrderKind, OrderStatus, InventorySyncStatus,
   TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount,
   ShippingAddress, Note, CreatedAt, UpdatedAt, IsDeleted, IdempotencyKey)
SELECT @O4, 'HVT-SAMPLE-004', @KH5, @KH5_NAME, @O4_EMP_ID, @O4_EMP_NAME,
       'COD', 'Sale', 'Processing', 'PendingDeduction',
       @O4_TOTAL, 0, NULL, NULL, 0, @O4_TOTAL,
       COALESCE(@ADDR, '45 Lê Lợi, Quận 1, TP.HCM'), 'Đơn COD demo chờ giao', DATE_SUB(@NOW, INTERVAL 6 HOUR), @NOW, 0, 'seed-hvt-sample-004'
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode='HVT-SAMPLE-004')
  AND @O4_EMP_ID IS NOT NULL;

-- Nếu đơn COD mẫu đã seed trước đó dưới sale01, chuyển về sale_cod01 khi có tài
UPDATE Orders
SET EmployeeId = @O4_EMP_ID,
    EmployeeSnapshotName = @O4_EMP_NAME,
    UpdatedAt = @NOW
WHERE OrderCode = 'HVT-SAMPLE-004'
  AND @SALE_COD_ID IS NOT NULL
  AND EmployeeId <> @SALE_COD_ID;
INSERT INTO OrderDetails
  (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, CategorySnapshotName, Quantity, CostPrice,
   ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted, IsGift)
SELECT '22222222-4001-4000-8000-000000000007', @O4, @SKU_HUONG100, @NAME_HUONG, 'HVT-HUONGTRA-100G', 'Trà', 3, @COST_HUONG,
       0, @PRICE_HUONG, @PRICE_HUONG*3, DATE_SUB(@NOW, INTERVAL 6 HOUR), @NOW, 0, 0
WHERE EXISTS (SELECT 1 FROM Orders WHERE Id=@O4)
  AND NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id='22222222-4001-4000-8000-000000000007');

INSERT INTO Payments
  (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt,
   TransferQrExpiresAtUtc, CodDebtSettlementJson, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-4001-4000-8000-000000000004', @O4, 'COD', @O4_TOTAL, 'Pending', NULL, 0,
       NULL, NULL, NULL, DATE_SUB(@NOW, INTERVAL 6 HOUR), @NOW, 0
WHERE EXISTS (SELECT 1 FROM Orders WHERE Id=@O4)
  AND NOT EXISTS (SELECT 1 FROM Payments WHERE Id='33333333-4001-4000-8000-000000000004');
