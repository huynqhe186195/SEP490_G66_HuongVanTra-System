-- Seed mau: Bao cao cuoi ngay thu kho (hvt_inventory_db)
-- PowerShell:
--   Get-Content -Raw -Encoding UTF8 .\Scripts\seed-warehouse-daily-report-demo.sql |
--     docker exec -i hvt-mysql mysql -uhvtuser -phvtpass123 --default-character-set=utf8mb4 hvt_inventory_db
-- Xoa: Id/code DEMO-EOD- hoac GUID prefix aaaaaaaa-e0d1-...

SET NAMES utf8mb4;

-- Don ban demo cu (neu chay lai)
DELETE FROM StockTransferLines WHERE StockTransferId IN (
  'aaaaaaaa-e0d1-4000-8000-000000000031',
  'aaaaaaaa-e0d1-4000-8000-000000000032'
);
DELETE FROM StockTransfers WHERE Id IN (
  'aaaaaaaa-e0d1-4000-8000-000000000031',
  'aaaaaaaa-e0d1-4000-8000-000000000032'
);
DELETE FROM SupplierReceiptItems WHERE SupplierReceiptId IN (
  'aaaaaaaa-e0d1-4000-8000-000000000011',
  'aaaaaaaa-e0d1-4000-8000-000000000012',
  'aaaaaaaa-e0d1-4000-8000-000000000013',
  'aaaaaaaa-e0d1-4000-8000-000000000014',
  'aaaaaaaa-e0d1-4000-8000-000000000015',
  'aaaaaaaa-e0d1-4000-8000-000000000016'
);
DELETE FROM SupplierReceipts WHERE Id IN (
  'aaaaaaaa-e0d1-4000-8000-000000000011',
  'aaaaaaaa-e0d1-4000-8000-000000000012',
  'aaaaaaaa-e0d1-4000-8000-000000000013',
  'aaaaaaaa-e0d1-4000-8000-000000000014',
  'aaaaaaaa-e0d1-4000-8000-000000000015',
  'aaaaaaaa-e0d1-4000-8000-000000000016'
);
DELETE FROM ProductionOrders WHERE Id IN (
  'aaaaaaaa-e0d1-4000-8000-000000000021',
  'aaaaaaaa-e0d1-4000-8000-000000000022',
  'aaaaaaaa-e0d1-4000-8000-000000000023',
  'aaaaaaaa-e0d1-4000-8000-000000000024'
);
DELETE FROM StockAdjustmentRequestItems WHERE RequestId IN (
  'aaaaaaaa-e0d1-4000-8000-000000000041',
  'aaaaaaaa-e0d1-4000-8000-000000000042',
  'aaaaaaaa-e0d1-4000-8000-000000000043'
);
DELETE FROM StockAdjustmentRequests WHERE Id IN (
  'aaaaaaaa-e0d1-4000-8000-000000000041',
  'aaaaaaaa-e0d1-4000-8000-000000000042',
  'aaaaaaaa-e0d1-4000-8000-000000000043'
);
DELETE FROM StockDeductQueues WHERE Id IN (
  'aaaaaaaa-e0d1-4000-8000-000000000051',
  'aaaaaaaa-e0d1-4000-8000-000000000052',
  'aaaaaaaa-e0d1-4000-8000-000000000053',
  'aaaaaaaa-e0d1-4000-8000-000000000054'
);
DELETE FROM StocktakeRequestItems WHERE StocktakeRequestId IN (
  'aaaaaaaa-e0d1-4000-8000-000000000061',
  'aaaaaaaa-e0d1-4000-8000-000000000062',
  'aaaaaaaa-e0d1-4000-8000-000000000063'
);
DELETE FROM ShelfReplenishmentSuggestions WHERE Id = 'aaaaaaaa-e0d1-4000-8000-000000000071';
DELETE FROM StocktakeRequests WHERE Id IN (
  'aaaaaaaa-e0d1-4000-8000-000000000061',
  'aaaaaaaa-e0d1-4000-8000-000000000062',
  'aaaaaaaa-e0d1-4000-8000-000000000063'
);
DELETE FROM InventoryLedgerEntries WHERE Id IN (
  'aaaaaaaa-e0d1-4000-8000-000000000081',
  'aaaaaaaa-e0d1-4000-8000-000000000082',
  'aaaaaaaa-e0d1-4000-8000-000000000083',
  'aaaaaaaa-e0d1-4000-8000-000000000084',
  'aaaaaaaa-e0d1-4000-8000-000000000085',
  'aaaaaaaa-e0d1-4000-8000-000000000086',
  'aaaaaaaa-e0d1-4000-8000-000000000087'
);

SET @actor := 'aaaaaaaa-e0d1-4000-8000-000000000001';
SET @sku := (SELECT SkuId FROM SkuStocks ORDER BY SkuCode LIMIT 1);
SET @sku_code := (SELECT SkuCode FROM SkuStocks WHERE SkuId = @sku LIMIT 1);
SET @now := UTC_TIMESTAMP(6);
SET @today_vn := DATE(DATE_ADD(@now, INTERVAL 7 HOUR));
SET @d1 := DATE_SUB(@now, INTERVAL 1 DAY);
SET @d2 := DATE_SUB(@now, INTERVAL 2 DAY);
SET @d3 := DATE_SUB(@now, INTERVAL 3 DAY);
SET @vn_d1 := DATE_SUB(@today_vn, INTERVAL 1 DAY);
SET @vn_d2 := DATE_SUB(@today_vn, INTERVAL 2 DAY);
SET @vn_d3 := DATE_SUB(@today_vn, INTERVAL 3 DAY);

-- ===== DA LAM HOM NAY =====

INSERT INTO SupplierReceipts (
  Id, ReceiptCode, SupplierName, ReceivedDate, Note, Status, TotalAmount,
  CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
  ReviewedBy, ReviewedByName, ReviewedByRoleName, ReviewedAt, SupplierNameSnapshot
) VALUES
(
  'aaaaaaaa-e0d1-4000-8000-000000000011', 'DEMO-EOD-PN-01', 'NCC Demo Tra',
  TIMESTAMP(@today_vn), 'Seed bao cao cuoi ngay', 'Completed', 1500000.00,
  @actor, 'Thu kho Demo', 'Warehouse', @now, @now,
  @actor, 'Quan ly Demo', 'Manager', @now, 'NCC Demo Tra'
),
(
  'aaaaaaaa-e0d1-4000-8000-000000000012', 'DEMO-EOD-PN-02', 'NCC Demo Bao Bi',
  TIMESTAMP(@today_vn), 'Seed bao cao cuoi ngay', 'Completed', 420000.00,
  @actor, 'Thu kho Demo', 'Warehouse', @now, @now,
  @actor, 'Quan ly Demo', 'Manager', @now, 'NCC Demo Bao Bi'
);

INSERT INTO SupplierReceiptItems (
  Id, SupplierReceiptId, SkuId, SkuCode, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
  SubmittedQuantity, Quantity, UnitCost, LotCode, ActualReceivedQuantity, DocumentQuantity, LineAmount,
  CreatedAt, UpdatedAt
) VALUES
(
  'aaaaaaaa-e0d1-4000-8000-000000000111', 'aaaaaaaa-e0d1-4000-8000-000000000011',
  @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo nhap', 'NGUYEN_LIEU', 'Piece',
  100, 100, 15000.00, 'DEMO-LOT-01', 100, 100, 1500000.00, @now, @now
),
(
  'aaaaaaaa-e0d1-4000-8000-000000000112', 'aaaaaaaa-e0d1-4000-8000-000000000012',
  @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo nhap 2', 'BAO_BI', 'Piece',
  20, 20, 21000.00, 'DEMO-LOT-02', 20, 20, 420000.00, @now, @now
);

INSERT INTO ProductionOrders (
  Id, ProductionCode, Note, Status, CreatedBy, CreatedByName, CreatedByRoleName,
  CreatedAt, UpdatedAt, CompletedAt, ReviewedAt, ReviewedByName
) VALUES
(
  'aaaaaaaa-e0d1-4000-8000-000000000021', 'DEMO-EOD-SX-01', 'Seed EOD',
  'Completed', @actor, 'Thu kho Demo', 'Warehouse', @now, @now, @now, @now, 'Quan ly Demo'
),
(
  'aaaaaaaa-e0d1-4000-8000-000000000022', 'DEMO-EOD-SX-OPEN', 'Seed EOD con do',
  'Approved', @actor, 'Thu kho Demo', 'Warehouse', @now, @now, NULL, @now, 'Quan ly Demo'
);

INSERT INTO StockTransfers (
  Id, TransferCode, SourceLocation, DestinationLocation, Status, Note,
  CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
  CompletedBy, CompletedByName, CompletedByRoleName, CompletedAt
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000031', 'DEMO-EOD-DC-01', 'Warehouse', 'Shelf', 'Completed', 'Seed EOD',
  @actor, 'Thu kho Demo', 'Warehouse', @now, @now,
  @actor, 'Thu kho Demo', 'Warehouse', @now
);

INSERT INTO StockTransferLines (
  Id, StockTransferId, SkuId, SkuCode, SkuNameSnapshot, Quantity, CreatedAt
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000131', 'aaaaaaaa-e0d1-4000-8000-000000000031',
  @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo chuyen ke', 15, @now
);

INSERT INTO StockAdjustmentRequests (
  Id, RequestCode, Reason, Status, RequestedBy, RequestedByName, RequestedByRoleName,
  RequestedAt, ReviewedBy, ReviewedByName, ReviewedAt, ReviewNote
) VALUES
(
  'aaaaaaaa-e0d1-4000-8000-000000000041', 'DEMO-EOD-YC-01', 'Seed EOD',
  'Approved', @actor, 'Sale Demo', 'SalePos', @now,
  @actor, 'Thu kho Demo', @now, 'Duyet demo'
),
(
  'aaaaaaaa-e0d1-4000-8000-000000000042', 'DEMO-EOD-YC-OPEN', 'Seed EOD con do',
  'Pending', @actor, 'Sale Demo', 'SalePos', @now,
  NULL, NULL, NULL, NULL
);

INSERT INTO StockAdjustmentRequestItems (
  Id, RequestId, SkuId, SkuCode, SkuSnapshotName, QuantityDelta, QuantityOnHandSnapshot,
  ApprovedQuantity, FulfilledQuantity, RejectedQuantity, Status
) VALUES
(
  'aaaaaaaa-e0d1-4000-8000-000000000141', 'aaaaaaaa-e0d1-4000-8000-000000000041',
  @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo YC', 10, 2, 10, 0, 0, 'Approved'
),
(
  'aaaaaaaa-e0d1-4000-8000-000000000142', 'aaaaaaaa-e0d1-4000-8000-000000000042',
  @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo YC open', 5, 1, 0, 0, 0, 'Pending'
);

INSERT INTO StockDeductQueues (
  Id, OrderId, OrderCode, OrderPaymentStatus, OrderStockStatus, QueueStatus, TotalAmount,
  IsDeducted, IsReserved, CreatedAt, ConfirmedAt, ConfirmedBy, ConfirmedByName, ConfirmedByRoleName,
  CustomerSnapshotName
) VALUES
(
  'aaaaaaaa-e0d1-4000-8000-000000000051', 'aaaaaaaa-e0d1-4000-8000-000000000501',
  'DEMO-EOD-DH-01', 'Paid', 'deducted', 'Confirmed', 250000.00,
  1, 0, @now, @now, @actor, 'Thu kho Demo', 'Warehouse', 'KH Demo'
),
(
  'aaaaaaaa-e0d1-4000-8000-000000000052', 'aaaaaaaa-e0d1-4000-8000-000000000502',
  'DEMO-EOD-DH-OPEN', 'Paid', 'pending_deduct', 'Waiting', 180000.00,
  0, 0, @now, NULL, NULL, NULL, NULL, 'KH Demo 2'
);

INSERT INTO StocktakeRequests (
  Id, RequestCode, Location, CountDate, Reason, Note, Status,
  CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
  ReviewedBy, ReviewedByName, ReviewedAt
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000061', 'DEMO-EOD-KK-01', 'Warehouse',
  TIMESTAMP(@today_vn), 'Seed EOD', NULL, 'Completed',
  @actor, 'Thu kho Demo', 'Warehouse', @now, @now,
  @actor, 'Quan ly Demo', @now
);

INSERT INTO StocktakeRequests (
  Id, RequestCode, Location, CountDate, Reason, Note, Status,
  CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
  ReviewedBy, ReviewedByName, ReviewedAt
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000062', 'DEMO-EOD-KK-SRC', 'Shelf',
  TIMESTAMP(@today_vn), 'Seed nguon goi y', NULL, 'Completed',
  @actor, 'Sale Demo', 'SalePos', @now, @now,
  @actor, 'Quan ly Demo', @now
);

INSERT INTO ShelfReplenishmentSuggestions (
  Id, SuggestionCode, SourceStocktakeRequestId, SourceStocktakeCode, Status, CreatedAt
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000071', 'DEMO-EOD-GY-OPEN',
  'aaaaaaaa-e0d1-4000-8000-000000000062', 'DEMO-EOD-KK-SRC', 'Open', @now
);

INSERT INTO SupplierReceipts (
  Id, ReceiptCode, SupplierName, ReceivedDate, Note, Status, TotalAmount,
  CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt, SupplierNameSnapshot
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000013', 'DEMO-EOD-PN-OPEN', 'NCC Demo Nhap',
  TIMESTAMP(@today_vn), 'Seed con do', 'Draft', 0.00,
  @actor, 'Thu kho Demo', 'Warehouse', @now, @now, 'NCC Demo Nhap'
);

INSERT INTO InventoryLedgerEntries (
  Id, TransactionGroupId, OccurredAtUtc, SkuId, SkuCode, SkuNameSnapshot, Location,
  QuantityBefore, QuantityDelta, QuantityAfter, TransactionType,
  ReferenceType, ReferenceId, ReferenceCode, ActorId, ActorName, ActorRole
) VALUES
(
  'aaaaaaaa-e0d1-4000-8000-000000000081', 'aaaaaaaa-e0d1-4000-8000-000000000080',
  @now, @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo', 'Warehouse',
  100, 50, 150, 'SUPPLIER_RECEIPT',
  'SupplierReceipt', 'aaaaaaaa-e0d1-4000-8000-000000000011', 'DEMO-EOD-PN-01',
  @actor, 'Thu kho Demo', 'Warehouse'
),
(
  'aaaaaaaa-e0d1-4000-8000-000000000082', 'aaaaaaaa-e0d1-4000-8000-000000000080',
  @now, @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo', 'Warehouse',
  150, -15, 135, 'STOCK_TRANSFER_WAREHOUSE_OUT',
  'StockTransfer', 'aaaaaaaa-e0d1-4000-8000-000000000031', 'DEMO-EOD-DC-01',
  @actor, 'Thu kho Demo', 'Warehouse'
),
(
  'aaaaaaaa-e0d1-4000-8000-000000000083', 'aaaaaaaa-e0d1-4000-8000-000000000080',
  @now, @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo', 'Warehouse',
  135, -8, 127, 'SALES_DEDUCT_LATER',
  'StockDeductQueue', 'aaaaaaaa-e0d1-4000-8000-000000000051', 'DEMO-EOD-DH-01',
  @actor, 'Thu kho Demo', 'Warehouse'
);

-- ===== HOM QUA (D-1) =====

INSERT INTO SupplierReceipts (
  Id, ReceiptCode, SupplierName, ReceivedDate, Note, Status, TotalAmount,
  CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
  ReviewedBy, ReviewedByName, ReviewedByRoleName, ReviewedAt, SupplierNameSnapshot
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000014', 'DEMO-EOD-PN-D1', 'NCC Demo Hom Qua',
  TIMESTAMP(@vn_d1), 'Seed D-1', 'Completed', 780000.00,
  @actor, 'Thu kho Demo', 'Warehouse', @d1, @d1,
  @actor, 'Quan ly Demo', 'Manager', @d1, 'NCC Demo Hom Qua'
);

INSERT INTO SupplierReceiptItems (
  Id, SupplierReceiptId, SkuId, SkuCode, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
  SubmittedQuantity, Quantity, UnitCost, LotCode, ActualReceivedQuantity, DocumentQuantity, LineAmount,
  CreatedAt, UpdatedAt
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000113', 'aaaaaaaa-e0d1-4000-8000-000000000014',
  @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo D-1', 'NGUYEN_LIEU', 'Piece',
  50, 50, 15600.00, 'DEMO-LOT-D1', 50, 50, 780000.00, @d1, @d1
);

INSERT INTO ProductionOrders (
  Id, ProductionCode, Note, Status, CreatedBy, CreatedByName, CreatedByRoleName,
  CreatedAt, UpdatedAt, CompletedAt, ReviewedAt, ReviewedByName
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000023', 'DEMO-EOD-SX-D1', 'Seed D-1',
  'Completed', @actor, 'Thu kho Demo', 'Warehouse', @d1, @d1, @d1, @d1, 'Quan ly Demo'
);

INSERT INTO StockTransfers (
  Id, TransferCode, SourceLocation, DestinationLocation, Status, Note,
  CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
  CompletedBy, CompletedByName, CompletedByRoleName, CompletedAt
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000032', 'DEMO-EOD-DC-D1', 'Warehouse', 'Shelf', 'Completed', 'Seed D-1',
  @actor, 'Thu kho Demo', 'Warehouse', @d1, @d1,
  @actor, 'Thu kho Demo', 'Warehouse', @d1
);

INSERT INTO StockTransferLines (
  Id, StockTransferId, SkuId, SkuCode, SkuNameSnapshot, Quantity, CreatedAt
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000132', 'aaaaaaaa-e0d1-4000-8000-000000000032',
  @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo chuyen ke D-1', 8, @d1
);

INSERT INTO StockDeductQueues (
  Id, OrderId, OrderCode, OrderPaymentStatus, OrderStockStatus, QueueStatus, TotalAmount,
  IsDeducted, IsReserved, CreatedAt, ConfirmedAt, ConfirmedBy, ConfirmedByName, ConfirmedByRoleName,
  CustomerSnapshotName
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000053', 'aaaaaaaa-e0d1-4000-8000-000000000503',
  'DEMO-EOD-DH-D1', 'Paid', 'deducted', 'Confirmed', 120000.00,
  1, 0, @d1, @d1, @actor, 'Thu kho Demo', 'Warehouse', 'KH Demo D1'
);

INSERT INTO StocktakeRequests (
  Id, RequestCode, Location, CountDate, Reason, Note, Status,
  CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
  ReviewedBy, ReviewedByName, ReviewedAt
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000063', 'DEMO-EOD-KK-D1', 'Warehouse',
  TIMESTAMP(@vn_d1), 'Seed D-1', NULL, 'Completed',
  @actor, 'Thu kho Demo', 'Warehouse', @d1, @d1,
  @actor, 'Quan ly Demo', @d1
);

INSERT INTO InventoryLedgerEntries (
  Id, TransactionGroupId, OccurredAtUtc, SkuId, SkuCode, SkuNameSnapshot, Location,
  QuantityBefore, QuantityDelta, QuantityAfter, TransactionType,
  ReferenceType, ReferenceId, ReferenceCode, ActorId, ActorName, ActorRole
) VALUES
(
  'aaaaaaaa-e0d1-4000-8000-000000000084', 'aaaaaaaa-e0d1-4000-8000-000000000084',
  @d1, @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo', 'Warehouse',
  80, 50, 130, 'SUPPLIER_RECEIPT',
  'SupplierReceipt', 'aaaaaaaa-e0d1-4000-8000-000000000014', 'DEMO-EOD-PN-D1',
  @actor, 'Thu kho Demo', 'Warehouse'
),
(
  'aaaaaaaa-e0d1-4000-8000-000000000085', 'aaaaaaaa-e0d1-4000-8000-000000000084',
  @d1, @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo', 'Warehouse',
  130, -8, 122, 'STOCK_TRANSFER_WAREHOUSE_OUT',
  'StockTransfer', 'aaaaaaaa-e0d1-4000-8000-000000000032', 'DEMO-EOD-DC-D1',
  @actor, 'Thu kho Demo', 'Warehouse'
);

-- ===== HOM KIA (D-2) =====

INSERT INTO SupplierReceipts (
  Id, ReceiptCode, SupplierName, ReceivedDate, Note, Status, TotalAmount,
  CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
  ReviewedBy, ReviewedByName, ReviewedByRoleName, ReviewedAt, SupplierNameSnapshot
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000015', 'DEMO-EOD-PN-D2', 'NCC Demo Hom Kia',
  TIMESTAMP(@vn_d2), 'Seed D-2', 'Completed', 320000.00,
  @actor, 'Thu kho Demo', 'Warehouse', @d2, @d2,
  @actor, 'Quan ly Demo', 'Manager', @d2, 'NCC Demo Hom Kia'
);

INSERT INTO SupplierReceiptItems (
  Id, SupplierReceiptId, SkuId, SkuCode, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
  SubmittedQuantity, Quantity, UnitCost, LotCode, ActualReceivedQuantity, DocumentQuantity, LineAmount,
  CreatedAt, UpdatedAt
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000114', 'aaaaaaaa-e0d1-4000-8000-000000000015',
  @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo D-2', 'BAO_BI', 'Piece',
  16, 16, 20000.00, 'DEMO-LOT-D2', 16, 16, 320000.00, @d2, @d2
);

INSERT INTO ProductionOrders (
  Id, ProductionCode, Note, Status, CreatedBy, CreatedByName, CreatedByRoleName,
  CreatedAt, UpdatedAt, CompletedAt, ReviewedAt, ReviewedByName
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000024', 'DEMO-EOD-SX-D2', 'Seed D-2',
  'Completed', @actor, 'Thu kho Demo', 'Warehouse', @d2, @d2, @d2, @d2, 'Quan ly Demo'
);

INSERT INTO StockAdjustmentRequests (
  Id, RequestCode, Reason, Status, RequestedBy, RequestedByName, RequestedByRoleName,
  RequestedAt, ReviewedBy, ReviewedByName, ReviewedAt, ReviewNote
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000043', 'DEMO-EOD-YC-D2', 'Seed D-2',
  'Approved', @actor, 'Sale Demo', 'SalePos', @d2,
  @actor, 'Thu kho Demo', @d2, 'Duyet D-2'
);

INSERT INTO StockAdjustmentRequestItems (
  Id, RequestId, SkuId, SkuCode, SkuSnapshotName, QuantityDelta, QuantityOnHandSnapshot,
  ApprovedQuantity, FulfilledQuantity, RejectedQuantity, Status
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000143', 'aaaaaaaa-e0d1-4000-8000-000000000043',
  @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo YC D-2', 6, 3, 6, 0, 0, 'Approved'
);

INSERT INTO StockDeductQueues (
  Id, OrderId, OrderCode, OrderPaymentStatus, OrderStockStatus, QueueStatus, TotalAmount,
  IsDeducted, IsReserved, CreatedAt, ConfirmedAt, ConfirmedBy, ConfirmedByName, ConfirmedByRoleName,
  CustomerSnapshotName
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000054', 'aaaaaaaa-e0d1-4000-8000-000000000504',
  'DEMO-EOD-DH-D2', 'Paid', 'deducted', 'Confirmed', 95000.00,
  1, 0, @d2, @d2, @actor, 'Thu kho Demo', 'Warehouse', 'KH Demo D2'
);

INSERT INTO InventoryLedgerEntries (
  Id, TransactionGroupId, OccurredAtUtc, SkuId, SkuCode, SkuNameSnapshot, Location,
  QuantityBefore, QuantityDelta, QuantityAfter, TransactionType,
  ReferenceType, ReferenceId, ReferenceCode, ActorId, ActorName, ActorRole
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000086', 'aaaaaaaa-e0d1-4000-8000-000000000086',
  @d2, @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo', 'Warehouse',
  60, 16, 76, 'SUPPLIER_RECEIPT',
  'SupplierReceipt', 'aaaaaaaa-e0d1-4000-8000-000000000015', 'DEMO-EOD-PN-D2',
  @actor, 'Thu kho Demo', 'Warehouse'
);

-- ===== 3 NGAY TRUOC (D-3) =====

INSERT INTO SupplierReceipts (
  Id, ReceiptCode, SupplierName, ReceivedDate, Note, Status, TotalAmount,
  CreatedBy, CreatedByName, CreatedByRoleName, CreatedAt, UpdatedAt,
  ReviewedBy, ReviewedByName, ReviewedByRoleName, ReviewedAt, SupplierNameSnapshot
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000016', 'DEMO-EOD-PN-D3', 'NCC Demo D3',
  TIMESTAMP(@vn_d3), 'Seed D-3', 'Completed', 210000.00,
  @actor, 'Thu kho Demo', 'Warehouse', @d3, @d3,
  @actor, 'Quan ly Demo', 'Manager', @d3, 'NCC Demo D3'
);

INSERT INTO SupplierReceiptItems (
  Id, SupplierReceiptId, SkuId, SkuCode, SkuNameSnapshot, ProductTypeSnapshot, InventoryUnitSnapshot,
  SubmittedQuantity, Quantity, UnitCost, LotCode, ActualReceivedQuantity, DocumentQuantity, LineAmount,
  CreatedAt, UpdatedAt
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000115', 'aaaaaaaa-e0d1-4000-8000-000000000016',
  @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo D-3', 'NGUYEN_LIEU', 'Piece',
  14, 14, 15000.00, 'DEMO-LOT-D3', 14, 14, 210000.00, @d3, @d3
);

INSERT INTO InventoryLedgerEntries (
  Id, TransactionGroupId, OccurredAtUtc, SkuId, SkuCode, SkuNameSnapshot, Location,
  QuantityBefore, QuantityDelta, QuantityAfter, TransactionType,
  ReferenceType, ReferenceId, ReferenceCode, ActorId, ActorName, ActorRole
) VALUES (
  'aaaaaaaa-e0d1-4000-8000-000000000087', 'aaaaaaaa-e0d1-4000-8000-000000000087',
  @d3, @sku, IFNULL(@sku_code, 'DEMO-SKU'), 'SP demo', 'Warehouse',
  40, 14, 54, 'SUPPLIER_RECEIPT',
  'SupplierReceipt', 'aaaaaaaa-e0d1-4000-8000-000000000016', 'DEMO-EOD-PN-D3',
  @actor, 'Thu kho Demo', 'Warehouse'
);

SELECT 'Seed DEMO-EOD xong (hom nay + D-1 + D-2 + D-3). Mo Bao cao cuoi ngay.' AS Message;
