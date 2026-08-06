-- =============================================================================
-- Hương Vân Trà — seed mở rộng: ca/quỹ, kiểm kê, trả hàng, PN Completed.
-- Chạy SAU seed-hvt-sample-ops.sql. Idempotent.
-- PN Completed + trả NCC Completed có cập nhật tồn Kho (số lượng nhỏ, có kiểm soát).
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET @NOW = UTC_TIMESTAMP(6);
SET @TODAY = CURDATE();
SET @WEEK_START = DATE_SUB(@TODAY, INTERVAL WEEKDAY(@TODAY) DAY);

SET @SALE_ID = (SELECT Id FROM hvt_user_db.Users WHERE Username = 'sale01' AND IsDeleted = 0 LIMIT 1);
SET @WH_ID   = (SELECT Id FROM hvt_user_db.Users WHERE Username = 'warehouse01' AND IsDeleted = 0 LIMIT 1);
SET @MGR_ID  = (SELECT Id FROM hvt_user_db.Users WHERE Username = 'manager01' AND IsDeleted = 0 LIMIT 1);

SET @SALE_NAME = (
  SELECT COALESCE(e.FullName, u.Username)
  FROM hvt_user_db.Users u
  LEFT JOIN hvt_user_db.Employees e ON e.UserId = u.Id AND e.IsDeleted = 0
  WHERE u.Id = @SALE_ID LIMIT 1
);
SET @WH_NAME = (
  SELECT COALESCE(e.FullName, u.Username)
  FROM hvt_user_db.Users u
  LEFT JOIN hvt_user_db.Employees e ON e.UserId = u.Id AND e.IsDeleted = 0
  WHERE u.Id = @WH_ID LIMIT 1
);
SET @MGR_NAME = (
  SELECT COALESCE(e.FullName, u.Username)
  FROM hvt_user_db.Users u
  LEFT JOIN hvt_user_db.Employees e ON e.UserId = u.Id AND e.IsDeleted = 0
  WHERE u.Id = @MGR_ID LIMIT 1
);

SET @TPL_SHELF = (SELECT Id FROM hvt_user_db.ShiftTemplates WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000001' AND IsDeleted = 0 LIMIT 1);
SET @TPL_WH    = (SELECT Id FROM hvt_user_db.ShiftTemplates WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000003' AND IsDeleted = 0 LIMIT 1);

SET @NCC1 = (SELECT Id FROM hvt_inventory_db.Suppliers WHERE NormalizedSupplierCode = 'NCC-HVT-01' AND IsDeleted = 0 LIMIT 1);

SET @SKU_NL_TRA   = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'NL-TRA-XANH-G' AND IsDeleted = 0 LIMIT 1);
SET @SKU_HUONG100 = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'HVT-HUONGTRA-100G' AND IsDeleted = 0 LIMIT 1);
SET @SKU_XUC      = (SELECT Id FROM hvt_product_db.ProductVariants WHERE SkuCode = 'HVT-XUC-TRE' AND IsDeleted = 0 LIMIT 1);

USE `hvt_product_db`;
CREATE TEMPORARY TABLE IF NOT EXISTS _hvt_ops_ext_assert (ok TINYINT NOT NULL);
DELETE FROM _hvt_ops_ext_assert;
INSERT INTO _hvt_ops_ext_assert (ok)
SELECT CASE
  WHEN @SALE_ID IS NULL OR @WH_ID IS NULL OR @SKU_NL_TRA IS NULL OR @NCC1 IS NULL OR @TPL_SHELF IS NULL THEN NULL
  ELSE 1
END;

SET @NAME_NL_TRA = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_NL_TRA);
SET @NAME_HUONG  = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_HUONG100);
SET @NAME_XUC    = (SELECT CONCAT(p.Name, ' - ', COALESCE(v.VariantName, v.SkuCode)) FROM hvt_product_db.ProductVariants v JOIN hvt_product_db.Products p ON p.Id=v.ProductId WHERE v.Id=@SKU_XUC);
SET @UNIT_NL = (SELECT InventoryUnit FROM hvt_product_db.Products p JOIN hvt_product_db.ProductVariants v ON v.ProductId=p.Id WHERE v.Id=@SKU_NL_TRA);
SET @UNIT_FG = (SELECT InventoryUnit FROM hvt_product_db.Products p JOIN hvt_product_db.ProductVariants v ON v.ProductId=p.Id WHERE v.Id=@SKU_HUONG100);

SET @WH_QTY_NL = (SELECT WarehouseQuantityOnHand FROM hvt_inventory_db.SkuStocks WHERE SkuId=@SKU_NL_TRA LIMIT 1);
SET @SH_QTY_NL = (SELECT QuantityOnHand FROM hvt_inventory_db.SkuStocks WHERE SkuId=@SKU_NL_TRA LIMIT 1);
SET @WH_QTY_HUONG = (SELECT WarehouseQuantityOnHand FROM hvt_inventory_db.SkuStocks WHERE SkuId=@SKU_HUONG100 LIMIT 1);
SET @SH_QTY_HUONG = (SELECT QuantityOnHand FROM hvt_inventory_db.SkuStocks WHERE SkuId=@SKU_HUONG100 LIMIT 1);

SET @PN_QTY = 1000;
SET @THN_QTY = 100;

-- -----------------------------------------------------------------------------
-- 1) Ca làm việc + quỹ POS
-- -----------------------------------------------------------------------------
USE `hvt_user_db`;

SET @WIN_ID = 'aaaaaaaa-6001-4000-8000-000000000001';
INSERT INTO ShiftRegistrationWindows
  (Id, WeekStart, OpensAt, ClosesAt, IsManuallyClosed, OpenedByUserId, ClosedByUserId, ClosedAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT @WIN_ID, @WEEK_START,
       TIMESTAMP(@WEEK_START, '00:00:00'),
       TIMESTAMP(DATE_ADD(@WEEK_START, INTERVAL 7 DAY), '23:59:59'),
       0, @MGR_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ShiftRegistrationWindows WHERE WeekStart = @WEEK_START AND IsDeleted = 0);

SET @SLOT_SHELF = 'aaaaaaaa-6001-4000-8000-000000000011';
SET @SLOT_WH    = 'aaaaaaaa-6001-4000-8000-000000000012';

INSERT INTO ShiftSlots (Id, TemplateId, WorkDate, Status, CreatedAt, UpdatedAt, IsDeleted)
SELECT @SLOT_SHELF, @TPL_SHELF, @TODAY, 'Open', @NOW, @NOW, 0
WHERE NOT EXISTS (
  SELECT 1 FROM ShiftSlots WHERE TemplateId=@TPL_SHELF AND WorkDate=@TODAY AND IsDeleted=0
);

-- Nếu slot đã tồn tại từ UI, lấy Id thật
SET @SLOT_SHELF = (
  SELECT Id FROM ShiftSlots WHERE TemplateId=@TPL_SHELF AND WorkDate=@TODAY AND IsDeleted=0 LIMIT 1
);

INSERT INTO ShiftSlots (Id, TemplateId, WorkDate, Status, CreatedAt, UpdatedAt, IsDeleted)
SELECT @SLOT_WH, @TPL_WH, @TODAY, 'Open', @NOW, @NOW, 0
WHERE @TPL_WH IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM ShiftSlots WHERE TemplateId=@TPL_WH AND WorkDate=@TODAY AND IsDeleted=0
);
SET @SLOT_WH = (
  SELECT Id FROM ShiftSlots WHERE TemplateId=@TPL_WH AND WorkDate=@TODAY AND IsDeleted=0 LIMIT 1
);

INSERT INTO ShiftRegistrations
  (Id, SlotId, UserId, StaffName, RoleName, Status, RegisteredAt, ReviewedAt, ReviewedByUserId, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-6001-4000-8000-000000000021', @SLOT_SHELF, @SALE_ID, @SALE_NAME, 'SalePos',
       'Approved', DATE_SUB(@NOW, INTERVAL 2 HOUR), DATE_SUB(@NOW, INTERVAL 90 MINUTE), @MGR_ID, @NOW, @NOW, 0
WHERE @SLOT_SHELF IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ShiftRegistrations WHERE SlotId=@SLOT_SHELF AND UserId=@SALE_ID AND IsDeleted=0
  );

INSERT INTO ShiftRegistrations
  (Id, SlotId, UserId, StaffName, RoleName, Status, RegisteredAt, ReviewedAt, ReviewedByUserId, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-6001-4000-8000-000000000022', @SLOT_WH, @WH_ID, @WH_NAME, 'Warehouse',
       'Approved', DATE_SUB(@NOW, INTERVAL 2 HOUR), DATE_SUB(@NOW, INTERVAL 90 MINUTE), @MGR_ID, @NOW, @NOW, 0
WHERE @SLOT_WH IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ShiftRegistrations WHERE SlotId=@SLOT_WH AND UserId=@WH_ID AND IsDeleted=0
  );

SET @TPL_SHELF_NAME = (SELECT Name FROM ShiftTemplates WHERE Id=@TPL_SHELF LIMIT 1);
SET @SHIFT_LABEL = CONCAT(COALESCE(@TPL_SHELF_NAME, 'Ca quầy'), ' · ', DATE_FORMAT(@TODAY, '%d/%m/%Y'));

USE `hvt_order_db`;

-- Phiên quỹ đang mở hôm nay
INSERT INTO PosCashSessions
  (Id, Status, OpeningCash, CashSalesTotal, CashRefundTotal, OrderCount, Note,
   OpenedByUserId, OpenedByName, OpenedByRole, ShiftSlotId, ShiftLabel, OpenedAt,
   CountedCash, ExpectedCash, Variance, VarianceNote,
   ClosedByUserId, ClosedByName, ClosedAt, IsDeleted, CreatedAt, UpdatedAt)
SELECT 'eeeeeeee-6001-4000-8000-000000000001', 'Open', 2000000.00, 0, 0, 0, 'Quỹ ca demo đang mở',
       @SALE_ID, @SALE_NAME, 'SalePos', @SLOT_SHELF, @SHIFT_LABEL, DATE_SUB(@NOW, INTERVAL 1 HOUR),
       NULL, NULL, NULL, NULL,
       NULL, NULL, NULL, 0, @NOW, @NOW
WHERE NOT EXISTS (
  SELECT 1 FROM PosCashSessions
  WHERE OpenedByUserId=@SALE_ID AND Status='Open' AND IsDeleted=0
);

-- Phiên quỹ đã đóng hôm trước (để có lịch sử)
INSERT INTO PosCashSessions
  (Id, Status, OpeningCash, CashSalesTotal, CashRefundTotal, OrderCount, Note,
   OpenedByUserId, OpenedByName, OpenedByRole, ShiftSlotId, ShiftLabel, OpenedAt,
   CountedCash, ExpectedCash, Variance, VarianceNote,
   ClosedByUserId, ClosedByName, ClosedAt, IsDeleted, CreatedAt, UpdatedAt)
SELECT 'eeeeeeee-6001-4000-8000-000000000002', 'Closed', 1500000.00, 385000.00, 0, 1, 'Quỹ ca demo đã chốt',
       @SALE_ID, @SALE_NAME, 'SalePos', NULL, CONCAT('Ca demo · ', DATE_FORMAT(DATE_SUB(@TODAY, INTERVAL 1 DAY), '%d/%m/%Y')),
       DATE_SUB(@NOW, INTERVAL 1 DAY),
       1885000.00, 1885000.00, 0, NULL,
       @SALE_ID, @SALE_NAME, DATE_SUB(@NOW, INTERVAL 20 HOUR), 0, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 20 HOUR)
WHERE NOT EXISTS (SELECT 1 FROM PosCashSessions WHERE Id='eeeeeeee-6001-4000-8000-000000000002');

-- -----------------------------------------------------------------------------
-- 2) Phiếu NCC Completed + lô + phiếu nhập kho + sổ kho (+ tồn)
-- -----------------------------------------------------------------------------
USE `hvt_inventory_db`;

SET @RCP_DONE = 'aaaaaaaa-3001-4000-8000-000000000003';
SET @RCP_ITEM = 'cccccccc-3001-4000-8000-000000000005';
SET @BATCH_ID = 'aaaaaaaa-5001-4000-8000-000000000001';
SET @BATCH_ITEM = 'aaaaaaaa-5001-4000-8000-000000000011';
SET @IMPORT_ID = 'aaaaaaaa-5001-4000-8000-000000000002';
SET @IMPORT_LINE = 'aaaaaaaa-5001-4000-8000-000000000012';
SET @LEDGER_ID = 'aaaaaaaa-5001-4000-8000-000000000013';
SET @BATCH_CODE = 'SR-CCCCCCCC300140008000000000000005';
SET @LOT_CODE = 'NCC-LOT-TRA-DEMO-03';
SET @IMPORT_CODE = 'PN-SEED-DEMO-03';

-- Chỉ tăng tồn nếu chưa seed phiếu này
SET @DO_PN = IF(EXISTS(SELECT 1 FROM SupplierReceipts WHERE ReceiptCode='PN-HVT-DEMO-03'), 0, 1);

INSERT INTO WarehouseBatches
  (Id, LotCode, Supplier, ExpiresAt, Note, Status, CreatedBy, CreatedAt, UpdatedAt,
   SourceType, SourceReferenceId, SourceReferenceCode, Location, ParentBatchId, SourceBatchId,
   BatchCode, SupplierId, SkuId, NormalizedSupplierLotCode, ManufactureDate)
SELECT @BATCH_ID, @LOT_CODE, 'Nông hộ trà Tân Cương', DATE_ADD(@NOW, INTERVAL 365 DAY),
       'Lô từ PN Completed demo', 'active', @WH_ID, @NOW, @NOW,
       'supplier_receipt', @RCP_DONE, 'PN-HVT-DEMO-03', 'Warehouse', NULL, NULL,
       @BATCH_CODE, @NCC1, @SKU_NL_TRA, UPPER(@LOT_CODE), DATE_SUB(@NOW, INTERVAL 5 DAY)
WHERE @DO_PN = 1;

INSERT INTO WarehouseBatchItems
  (Id, WarehouseBatchId, SkuId, SkuCode, ProductSnapshotName, QuantityOnHand, InitialQuantity, UnitCost, CreatedAt, UpdatedAt)
SELECT @BATCH_ITEM, @BATCH_ID, @SKU_NL_TRA, 'NL-TRA-XANH-G', @NAME_NL_TRA, @PN_QTY, @PN_QTY, 180.00, @NOW, @NOW
WHERE @DO_PN = 1;

UPDATE SkuStocks
SET WarehouseQuantityOnHand = WarehouseQuantityOnHand + @PN_QTY,
    UpdatedAt = @NOW
WHERE SkuId = @SKU_NL_TRA AND @DO_PN = 1;

SET @WH_AFTER_PN = (SELECT WarehouseQuantityOnHand FROM SkuStocks WHERE SkuId=@SKU_NL_TRA LIMIT 1);
SET @WH_BEFORE_PN = @WH_AFTER_PN - IF(@DO_PN=1, @PN_QTY, 0);

INSERT INTO SupplierReceipts
  (Id, ReceiptCode, SupplierName, SupplierReference, SupplierDocumentNumber, SupplierDocumentDate,
   ReceivedDate, Note, Status, CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
   SubmittedBy, SubmittedAt, ReviewedBy, ReviewedByName, ReviewedByRoleName, ReviewedAt, ReviewNote,
   StockImportSlipId, StockImportSlipCode, SupplierId, DeliveredByName, OriginalDocumentReference,
   TotalAmount, SupplierNameSnapshot, SupplierCodeSnapshot)
SELECT @RCP_DONE, 'PN-HVT-DEMO-03', 'Nông hộ trà Tân Cương', 'PO-DEMO-03', 'HD-DEMO-03', DATE_SUB(@NOW, INTERVAL 3 DAY),
       DATE_SUB(@NOW, INTERVAL 2 DAY), 'Phiếu nhập đã duyệt demo', 'Completed', @WH_ID, @WH_NAME, 'Warehouse',
       DATE_SUB(@NOW, INTERVAL 3 DAY), @NOW, @WH_ID, DATE_SUB(@NOW, INTERVAL 2 DAY),
       @MGR_ID, @MGR_NAME, 'Manager', DATE_SUB(@NOW, INTERVAL 2 DAY), 'Duyệt seed demo',
       @IMPORT_ID, @IMPORT_CODE, @NCC1, 'Nguyễn Văn Giao', NULL,
       (@PN_QTY * 180.00), 'Nông hộ trà Tân Cương', 'NCC-HVT-01'
WHERE @DO_PN = 1;

INSERT INTO SupplierReceiptItems
  (Id, SupplierReceiptId, SkuId, SkuCode, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   SubmittedUnit, SubmittedQuantity, Quantity, UnitCost, LotCode, ManufacturedAt, ExpiresAt,
   ActualReceivedQuantity, QualityNote, WarehouseBatchId, WarehouseBatchLotCode,
   WarehouseQtyBefore, WarehouseQtyAfter, ShelfQtyBefore, ShelfQtyAfter, CreatedAt, UpdatedAt,
   DocumentQuantity, LineAmount)
SELECT @RCP_ITEM, @RCP_DONE, @SKU_NL_TRA, 'NL-TRA-XANH-G', @NAME_NL_TRA, 'NGUYEN_LIEU', @UNIT_NL,
       @UNIT_NL, @PN_QTY, @PN_QTY, 180.00, @LOT_CODE, DATE_SUB(@NOW, INTERVAL 5 DAY), DATE_ADD(@NOW, INTERVAL 365 DAY),
       @PN_QTY, 'Đạt', @BATCH_ID, @BATCH_CODE,
       @WH_BEFORE_PN, @WH_AFTER_PN, COALESCE(@SH_QTY_NL,0), COALESCE(@SH_QTY_NL,0), @NOW, @NOW,
       @PN_QTY, (@PN_QTY * 180.00)
WHERE @DO_PN = 1;

INSERT INTO StockImportSlips
  (Id, ImportCode, ImportType, SkuId, SkuCode, ProductSnapshotName, Quantity,
   WarehouseQtyBefore, WarehouseQtyAfter, StoreQtyBefore, StoreQtyAfter,
   WarehouseBatchId, WarehouseBatchLotCode, ProductionOrderId, ProductionCode, Note,
   CreatedBy, CreatedAt, CreatedById, CreatedByName, CreatedByRoleName,
   SupplierReceiptId, SupplierReceiptCode, ReferenceId, ReferenceType, ReferenceCode)
SELECT @IMPORT_ID, @IMPORT_CODE, 'supplier_receipt', @SKU_NL_TRA, 'NL-TRA-XANH-G', @NAME_NL_TRA, @PN_QTY,
       @WH_BEFORE_PN, @WH_AFTER_PN, COALESCE(@SH_QTY_NL,0), COALESCE(@SH_QTY_NL,0),
       @BATCH_ID, @BATCH_CODE, NULL, NULL, 'Import từ PN-HVT-DEMO-03',
       @WH_ID, DATE_SUB(@NOW, INTERVAL 2 DAY), @WH_ID, @WH_NAME, 'Warehouse',
       @RCP_DONE, 'PN-HVT-DEMO-03', @RCP_DONE, 'SupplierReceipt', 'PN-HVT-DEMO-03'
WHERE @DO_PN = 1;

INSERT INTO StockImportSlipLines
  (Id, StockImportSlipId, SkuId, SkuCode, ProductSnapshotName, Quantity,
   WarehouseQtyBefore, WarehouseQtyAfter, StoreQtyBefore, StoreQtyAfter,
   WarehouseBatchId, WarehouseBatchLotCode, ProductionOrderOutputLineId, Note, CreatedAt, DestinationLocation)
SELECT @IMPORT_LINE, @IMPORT_ID, @SKU_NL_TRA, 'NL-TRA-XANH-G', @NAME_NL_TRA, @PN_QTY,
       @WH_BEFORE_PN, @WH_AFTER_PN, COALESCE(@SH_QTY_NL,0), COALESCE(@SH_QTY_NL,0),
       @BATCH_ID, @BATCH_CODE, NULL, NULL, DATE_SUB(@NOW, INTERVAL 2 DAY), 'Warehouse'
WHERE @DO_PN = 1;

INSERT INTO InventoryLedgerEntries
  (Id, TransactionGroupId, OccurredAtUtc, SkuId, SkuCode, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   Location, QuantityBefore, QuantityDelta, QuantityAfter, TransactionType, SourceLocation, DestinationLocation,
   ReferenceType, ReferenceId, ReferenceCode, BatchId, LotCode, ActorId, ActorName, ActorRole, Reason, Note, CorrelationId)
SELECT @LEDGER_ID, 'aaaaaaaa-5001-4000-8000-000000000099', DATE_SUB(@NOW, INTERVAL 2 DAY),
       @SKU_NL_TRA, 'NL-TRA-XANH-G', @NAME_NL_TRA, 'NGUYEN_LIEU', @UNIT_NL,
       'Warehouse', @WH_BEFORE_PN, @PN_QTY, @WH_AFTER_PN, 'SupplierReceipt', 'Supplier', 'Warehouse',
       'SupplierReceipt', @RCP_DONE, 'PN-HVT-DEMO-03', @BATCH_ID, @LOT_CODE,
       @MGR_ID, @MGR_NAME, 'Manager', 'Phiếu nhập đã duyệt demo', NULL, CAST(@RCP_DONE AS CHAR)
WHERE @DO_PN = 1;

-- Nếu đã seed trước đó, đảm bảo biến batch/receipt trỏ đúng
SET @RCP_DONE = COALESCE((SELECT Id FROM SupplierReceipts WHERE ReceiptCode='PN-HVT-DEMO-03' LIMIT 1), @RCP_DONE);
SET @BATCH_ID = COALESCE((SELECT WarehouseBatchId FROM SupplierReceiptItems WHERE SupplierReceiptId=@RCP_DONE LIMIT 1), @BATCH_ID);
SET @BATCH_CODE = COALESCE((SELECT WarehouseBatchLotCode FROM SupplierReceiptItems WHERE SupplierReceiptId=@RCP_DONE LIMIT 1), @BATCH_CODE);
SET @LOT_CODE = COALESCE((SELECT LotCode FROM SupplierReceiptItems WHERE SupplierReceiptId=@RCP_DONE LIMIT 1), @LOT_CODE);

-- -----------------------------------------------------------------------------
-- 3) Kiểm kê — 1 Draft + 1 Completed (variance 0, không chỉnh tồn)
-- -----------------------------------------------------------------------------
SET @KK1 = 'aaaaaaaa-7001-4000-8000-000000000001';
SET @KK2 = 'aaaaaaaa-7001-4000-8000-000000000002';

INSERT INTO StocktakeRequests
  (Id, RequestCode, Location, CountDate, Reason, Note, Status,
   CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
   SubmittedBy, SubmittedAt, ReviewedBy, ReviewedByName, ReviewedByRoleName, ReviewedAt, ReviewNote)
SELECT @KK1, 'KK-HVT-DEMO-01', 'Shelf', @NOW, 'Kiểm kê định kỳ demo', 'Nháp kiểm kê kệ', 'Draft',
       @WH_ID, @WH_NAME, 'Warehouse', @NOW, @NOW,
       NULL, NULL, NULL, NULL, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM StocktakeRequests WHERE RequestCode='KK-HVT-DEMO-01');

INSERT INTO StocktakeRequestItems
  (Id, StocktakeRequestId, SkuId, SkuCode, SkuSnapshotName, ProductTypeSnapshot, InventoryUnitSnapshot,
   SystemQuantitySnapshot, ActualQuantity, Variance, ReasonCode, Note,
   WarehouseQtyBefore, WarehouseQtyAfter, ShelfQtyBefore, ShelfQtyAfter,
   StockExportSlipId, StockExportSlipCode, StockImportSlipId, StockImportSlipCode, WarehouseBatchId, WarehouseBatchLotCode)
SELECT 'bbbbbbbb-7001-4000-8000-000000000001', @KK1, @SKU_HUONG100, 'HVT-HUONGTRA-100G', @NAME_HUONG, 'THANH_PHAM', @UNIT_FG,
       COALESCE(@SH_QTY_HUONG,0), COALESCE(@SH_QTY_HUONG,0), 0, 'DATA_ENTRY_ERROR', NULL,
       NULL, NULL, COALESCE(@SH_QTY_HUONG,0), COALESCE(@SH_QTY_HUONG,0),
       NULL, NULL, NULL, NULL, NULL, NULL
WHERE EXISTS (SELECT 1 FROM StocktakeRequests WHERE Id=@KK1)
  AND @SKU_HUONG100 IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM StocktakeRequestItems WHERE Id='bbbbbbbb-7001-4000-8000-000000000001');

INSERT INTO StocktakeRequests
  (Id, RequestCode, Location, CountDate, Reason, Note, Status,
   CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
   SubmittedBy, SubmittedAt, ReviewedBy, ReviewedByName, ReviewedByRoleName, ReviewedAt, ReviewNote)
SELECT @KK2, 'KK-HVT-DEMO-02', 'Warehouse', DATE_SUB(@NOW, INTERVAL 1 DAY), 'Đối chiếu kho demo', 'Đã duyệt khớp số', 'Completed',
       @WH_ID, @WH_NAME, 'Warehouse', DATE_SUB(@NOW, INTERVAL 1 DAY), @NOW,
       @WH_ID, DATE_SUB(@NOW, INTERVAL 20 HOUR), @MGR_ID, @MGR_NAME, 'Manager', DATE_SUB(@NOW, INTERVAL 18 HOUR), 'Khớp tồn'
WHERE NOT EXISTS (SELECT 1 FROM StocktakeRequests WHERE RequestCode='KK-HVT-DEMO-02');

SET @WH_QTY_NL_NOW = (SELECT WarehouseQuantityOnHand FROM SkuStocks WHERE SkuId=@SKU_NL_TRA LIMIT 1);

INSERT INTO StocktakeRequestItems
  (Id, StocktakeRequestId, SkuId, SkuCode, SkuSnapshotName, ProductTypeSnapshot, InventoryUnitSnapshot,
   SystemQuantitySnapshot, ActualQuantity, Variance, ReasonCode, Note,
   WarehouseQtyBefore, WarehouseQtyAfter, ShelfQtyBefore, ShelfQtyAfter,
   StockExportSlipId, StockExportSlipCode, StockImportSlipId, StockImportSlipCode, WarehouseBatchId, WarehouseBatchLotCode)
SELECT 'bbbbbbbb-7001-4000-8000-000000000002', @KK2, @SKU_NL_TRA, 'NL-TRA-XANH-G', @NAME_NL_TRA, 'NGUYEN_LIEU', @UNIT_NL,
       COALESCE(@WH_QTY_NL_NOW,0), COALESCE(@WH_QTY_NL_NOW,0), 0, 'DATA_ENTRY_ERROR', NULL,
       COALESCE(@WH_QTY_NL_NOW,0), COALESCE(@WH_QTY_NL_NOW,0), COALESCE(@SH_QTY_NL,0), COALESCE(@SH_QTY_NL,0),
       NULL, NULL, NULL, NULL, NULL, NULL
WHERE EXISTS (SELECT 1 FROM StocktakeRequests WHERE Id=@KK2)
  AND NOT EXISTS (SELECT 1 FROM StocktakeRequestItems WHERE Id='bbbbbbbb-7001-4000-8000-000000000002');

-- -----------------------------------------------------------------------------
-- 4) Trả hàng NCC Completed (trừ tồn nhỏ từ lô PN demo) + trả hàng khách
-- -----------------------------------------------------------------------------
SET @THN_ID = 'aaaaaaaa-8001-4000-8000-000000000001';
SET @DO_THN = IF(EXISTS(SELECT 1 FROM SupplierReturnRequests WHERE ReturnCode='THN-HVT-DEMO-01'), 0, 1);

SET @WH_BEFORE_THN = (SELECT WarehouseQuantityOnHand FROM SkuStocks WHERE SkuId=@SKU_NL_TRA LIMIT 1);
SET @BATCH_QTY_BEFORE = (SELECT QuantityOnHand FROM WarehouseBatchItems WHERE WarehouseBatchId=@BATCH_ID AND SkuId=@SKU_NL_TRA LIMIT 1);

UPDATE WarehouseBatchItems
SET QuantityOnHand = QuantityOnHand - @THN_QTY,
    UpdatedAt = @NOW
WHERE WarehouseBatchId = @BATCH_ID AND SkuId = @SKU_NL_TRA AND @DO_THN = 1
  AND QuantityOnHand >= @THN_QTY;

UPDATE SkuStocks
SET WarehouseQuantityOnHand = WarehouseQuantityOnHand - @THN_QTY,
    UpdatedAt = @NOW
WHERE SkuId = @SKU_NL_TRA AND @DO_THN = 1
  AND WarehouseQuantityOnHand >= @THN_QTY;

SET @WH_AFTER_THN = (SELECT WarehouseQuantityOnHand FROM SkuStocks WHERE SkuId=@SKU_NL_TRA LIMIT 1);

INSERT INTO SupplierReturnRequests
  (Id, ReturnCode, SupplierReceiptId, SupplierReceiptCode, SupplierName, SupplierReference,
   Reason, Note, Status, CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
   ReviewedBy, ReviewedByName, ReviewedByRoleName, ReviewedAt, ReviewNote, DefectReasonCode, OperationId)
SELECT @THN_ID, 'THN-HVT-DEMO-01', @RCP_DONE, 'PN-HVT-DEMO-03', 'Nông hộ trà Tân Cương', 'PO-DEMO-03',
       'Hàng ẩm nhẹ khi nhận', 'Trả một phần lô demo', 'Completed', @WH_ID, @WH_NAME, 'Warehouse', @NOW, @NOW,
       @WH_ID, @WH_NAME, 'Warehouse', @NOW, NULL, 'DAMAGED_ON_ARRIVAL', 'aaaaaaaa-8001-4000-8000-000000000099'
WHERE @DO_THN = 1 AND @RCP_DONE IS NOT NULL;

INSERT INTO SupplierReturnRequestItems
  (Id, SupplierReturnRequestId, SkuId, SkuCode, SkuSnapshotName, Quantity,
   WarehouseBatchId, WarehouseBatchLotCode,
   WarehouseQtyBefore, WarehouseQtyAfter, ShelfQtyBefore, ShelfQtyAfter,
   StockExportSlipId, StockExportSlipCode, Note)
SELECT 'bbbbbbbb-8001-4000-8000-000000000001', @THN_ID, @SKU_NL_TRA, 'NL-TRA-XANH-G', @NAME_NL_TRA, @THN_QTY,
       @BATCH_ID, @BATCH_CODE,
       @WH_BEFORE_THN, @WH_AFTER_THN, COALESCE(@SH_QTY_NL,0), COALESCE(@SH_QTY_NL,0),
       NULL, NULL, 'Trả 100g demo'
WHERE @DO_THN = 1;

INSERT INTO InventoryLedgerEntries
  (Id, TransactionGroupId, OccurredAtUtc, SkuId, SkuCode, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
   Location, QuantityBefore, QuantityDelta, QuantityAfter, TransactionType, SourceLocation, DestinationLocation,
   ReferenceType, ReferenceId, ReferenceCode, BatchId, LotCode, ActorId, ActorName, ActorRole, Reason, Note, CorrelationId)
SELECT 'aaaaaaaa-8001-4000-8000-000000000013', 'aaaaaaaa-8001-4000-8000-000000000098', @NOW,
       @SKU_NL_TRA, 'NL-TRA-XANH-G', @NAME_NL_TRA, 'NGUYEN_LIEU', @UNIT_NL,
       'Warehouse', @WH_BEFORE_THN, -@THN_QTY, @WH_AFTER_THN, 'SupplierReturn', 'Warehouse', 'Supplier',
       'SupplierReturn', @THN_ID, 'THN-HVT-DEMO-01', @BATCH_ID, @LOT_CODE,
       @WH_ID, @WH_NAME, 'Warehouse', 'Hàng ẩm nhẹ khi nhận', NULL, CAST(@THN_ID AS CHAR)
WHERE @DO_THN = 1;

-- Trả hàng khách (chỉ bản ghi Order — không cộng tồn, đúng hướng Phase J)
USE `hvt_order_db`;

SET @SRC_ORDER = (SELECT Id FROM Orders WHERE OrderCode='HVT-SAMPLE-001' AND IsDeleted=0 LIMIT 1);
SET @SRC_DETAIL = (
  SELECT Id FROM OrderDetails
  WHERE OrderId=@SRC_ORDER AND SkuSnapshotCode='HVT-XUC-TRE' AND IsDeleted=0
  LIMIT 1
);
SET @KH1 = (SELECT CustomerId FROM Orders WHERE Id=@SRC_ORDER LIMIT 1);
SET @KH1_NAME = (SELECT CustomerSnapshotName FROM Orders WHERE Id=@SRC_ORDER LIMIT 1);
SET @RET_AMT = (SELECT UnitPrice FROM OrderDetails WHERE Id=@SRC_DETAIL LIMIT 1);

INSERT INTO ReturnOrders
  (Id, ReturnCode, SourceOrderId, SourceOrderCode, CustomerId, CustomerSnapshotName,
   ReturnAmount, ExchangeAmount, NetCustomerPays, RefundAmount, CustomerPaidAmount,
   RefundMethod, ExchangeOrderId, Note, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-9001-4000-8000-000000000001', 'TH-HVT-SAMPLE-001', @SRC_ORDER, 'HVT-SAMPLE-001', @KH1, @KH1_NAME,
       COALESCE(@RET_AMT,0), 0, 0, COALESCE(@RET_AMT,0), 0,
       'Cash', NULL, 'Trả 1 xúc tre demo — chờ kiểm hàng', DATE_SUB(@NOW, INTERVAL 1 DAY), @NOW, 0
WHERE @SRC_ORDER IS NOT NULL AND @SRC_DETAIL IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ReturnOrders WHERE ReturnCode='TH-HVT-SAMPLE-001');

INSERT INTO ReturnOrderDetails
  (Id, ReturnOrderId, SourceOrderDetailId, SkuId, SkuSnapshotName, SkuSnapshotCode,
   ReturnQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-9001-4000-8000-000000000001', 'dddddddd-9001-4000-8000-000000000001', @SRC_DETAIL,
       @SKU_XUC, @NAME_XUC, 'HVT-XUC-TRE',
       1, COALESCE(@RET_AMT,0), COALESCE(@RET_AMT,0), DATE_SUB(@NOW, INTERVAL 1 DAY), @NOW, 0
WHERE EXISTS (SELECT 1 FROM ReturnOrders WHERE ReturnCode='TH-HVT-SAMPLE-001')
  AND NOT EXISTS (SELECT 1 FROM ReturnOrderDetails WHERE Id='22222222-9001-4000-8000-000000000001');

UPDATE OrderDetails
SET ReturnedQuantity = GREATEST(ReturnedQuantity, 1),
    UpdatedAt = @NOW
WHERE Id = @SRC_DETAIL
  AND EXISTS (SELECT 1 FROM ReturnOrders WHERE ReturnCode='TH-HVT-SAMPLE-001');
