-- Fix font + (optional) clear demo names to ASCII-safe Vietnamese without diacritics
-- (tranh loi encoding khi seed qua PowerShell/Windows)

UPDATE SupplierReceipts
SET CreatedByName = 'Thu kho Demo',
    ReviewedByName = CASE WHEN ReviewedByName IS NULL THEN NULL ELSE 'Quan ly Demo' END
WHERE ReceiptCode LIKE 'DEMO-EOD%';

UPDATE ProductionOrders
SET CreatedByName = 'Thu kho Demo',
    ReviewedByName = CASE WHEN ReviewedByName IS NULL THEN NULL ELSE 'Quan ly Demo' END
WHERE ProductionCode LIKE 'DEMO-EOD%';

UPDATE StockTransfers
SET CreatedByName = 'Thu kho Demo',
    CompletedByName = 'Thu kho Demo'
WHERE TransferCode LIKE 'DEMO-EOD%';

UPDATE StockAdjustmentRequests
SET RequestedByName = 'Sale Demo',
    ReviewedByName = CASE WHEN ReviewedByName IS NULL THEN NULL ELSE 'Thu kho Demo' END
WHERE RequestCode LIKE 'DEMO-EOD%';

UPDATE StockDeductQueues
SET ConfirmedByName = CASE WHEN ConfirmedByName IS NULL THEN NULL ELSE 'Thu kho Demo' END,
    CustomerSnapshotName = CASE
      WHEN OrderCode = 'DEMO-EOD-DH-01' THEN 'KH Demo'
      WHEN OrderCode = 'DEMO-EOD-DH-OPEN' THEN 'KH Demo 2'
      ELSE CustomerSnapshotName
    END
WHERE OrderCode LIKE 'DEMO-EOD%';

UPDATE StocktakeRequests
SET CreatedByName = CASE
      WHEN RequestCode = 'DEMO-EOD-KK-SRC' THEN 'Sale Demo'
      ELSE 'Thu kho Demo'
    END,
    ReviewedByName = 'Quan ly Demo'
WHERE RequestCode LIKE 'DEMO-EOD%';

UPDATE InventoryLedgerEntries
SET ActorName = 'Thu kho Demo'
WHERE ReferenceCode LIKE 'DEMO-EOD%';
