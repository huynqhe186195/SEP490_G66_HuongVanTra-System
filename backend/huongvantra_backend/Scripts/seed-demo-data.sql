-- =============================================================================
-- HuongVanTra — Seed dữ liệu demo (idempotent)
-- Chạy SAU khi:
--   1. init-databases.sql + EF migrations đã apply
--   2. Các service đã start ít nhất 1 lần (seed tier + user admin/sale01)
--
-- Cách chạy (PowerShell — khuyến nghị, giữ UTF-8):
--   docker cp .\Scripts\seed-demo-data.sql hvt-mysql:/tmp/seed-demo-data.sql
--   docker exec hvt-mysql mysql -uhvtuser -phvtpass123 -e "source /tmp/seed-demo-data.sql"
--
-- Hoặc pipe (ASCII an toàn):
--   Get-Content .\Scripts\seed-demo-data.sql -Raw | docker exec -i hvt-mysql mysql -uhvtuser -phvtpass123
--
-- Lưu ý: dùng tên ASCII (không dấu) để tránh lỗi encoding khi pipe qua PowerShell.
-- Snapshot đơn hàng theo format app: "Ho ten · KH-DEMO-xxx"
--
-- Xóa demo để seed lại (tuỳ chọn, bỏ comment):
--   DELETE FROM hvt_order_db.ReturnOrderDetails WHERE ReturnOrderId IN (SELECT Id FROM hvt_order_db.ReturnOrders WHERE ReturnCode LIKE 'TH-DEMO-%');
--   DELETE FROM hvt_order_db.ReturnOrders WHERE ReturnCode LIKE 'TH-DEMO-%';
--   DELETE FROM hvt_order_db.OrderActivities WHERE OrderId IN (SELECT Id FROM hvt_order_db.Orders WHERE OrderCode LIKE 'HVT-DEMO-%');
--   DELETE FROM hvt_order_db.Payments WHERE OrderId IN (SELECT Id FROM hvt_order_db.Orders WHERE OrderCode LIKE 'HVT-DEMO-%');
--   DELETE FROM hvt_order_db.OrderDetails WHERE OrderId IN (SELECT Id FROM hvt_order_db.Orders WHERE OrderCode LIKE 'HVT-DEMO-%');
--   DELETE FROM hvt_order_db.Orders WHERE OrderCode LIKE 'HVT-DEMO-%';
--   DELETE FROM hvt_order_db.PromotionScopes WHERE PromotionId IN (SELECT Id FROM hvt_order_db.Promotions WHERE PromoCode LIKE 'DEMO%');
--   DELETE FROM hvt_order_db.Promotions WHERE PromoCode LIKE 'DEMO%';
--   DELETE FROM hvt_inventory_db.StockDeductQueueItems WHERE QueueId IN (SELECT Id FROM hvt_inventory_db.StockDeductQueues WHERE OrderCode LIKE 'HVT-DEMO-%');
--   DELETE FROM hvt_inventory_db.StockDeductQueues WHERE OrderCode LIKE 'HVT-DEMO-%';
--   DELETE FROM hvt_inventory_db.SkuStocks WHERE SkuCode LIKE 'SKU-DEMO-%';
--   DELETE FROM hvt_customer_db.CustomerAddresses WHERE CustomerId IN (SELECT Id FROM hvt_customer_db.Customers WHERE CustomerCode LIKE 'KH-DEMO-%');
--   DELETE FROM hvt_customer_db.Customers WHERE CustomerCode LIKE 'KH-DEMO-%';
--   DELETE FROM hvt_product_db.ProductSKUs WHERE SkuCode LIKE 'SKU-DEMO-%';
--   DELETE FROM hvt_product_db.Products WHERE Id LIKE 'aaaaaaaa-%';
--   DELETE FROM hvt_product_db.Categories WHERE Id BETWEEN 9001 AND 9105;
-- =============================================================================

SET @NOW = UTC_TIMESTAMP(6);
SET @SALE_USER_ID = (
  SELECT u.Id FROM hvt_user_db.Users u
  WHERE u.Username = 'sale01' AND u.IsDeleted = 0
  LIMIT 1
);
SET @TIER_MEMBER = (SELECT Id FROM hvt_customer_db.CustomerTiers WHERE TierName = 'Member' LIMIT 1);
SET @TIER_SILVER = (SELECT Id FROM hvt_customer_db.CustomerTiers WHERE TierName = 'Silver' LIMIT 1);
SET @TIER_GOLD   = (SELECT Id FROM hvt_customer_db.CustomerTiers WHERE TierName = 'Gold' LIMIT 1);
-- Separator " · " (UTF-8 C2 B7) — tranh loi encoding PowerShell
SET @SNAP_SEP = CONCAT(' ', CONVERT(UNHEX('C2B7') USING utf8mb4), ' ');

-- -----------------------------------------------------------------------------
-- PRODUCT DB — Danh mục + sản phẩm + SKU
-- -----------------------------------------------------------------------------
USE `hvt_product_db`;

-- Danh muc CHA (9001-9003)
INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9001, 'Tra', 'Cac loai tra ban le', NULL, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9001);

INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9002, 'Qua tang', 'Combo, hop qua', NULL, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9002);

INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9003, 'Dung cu pha tra', 'Am, ly, phu kien', NULL, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9003);

-- Danh muc CON (9101-9105) — san pham gan vao cap con
INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9101, 'Tra xanh', 'Tra xanh cac vung mien', 9001, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9101);

INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9102, 'Tra den & Oolong', 'Tra den, hong tra, oolong', 9001, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9102);

INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9103, 'Tra thao duoc', 'Hoa qua, thao moc', 9001, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9103);

INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9104, 'Combo qua tang', 'Hop qua, set combo', 9002, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9104);

INSERT INTO Categories (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 9105, 'Am & ly', 'Am tra, bo ly su', 9003, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE Id = 9105);

-- Products (12)
INSERT INTO Products (Id, CategoryId, Name, Origin, FlavorProfile, Description, BaseUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000001', 9101, 'Trà Shan Tuyết Lào Cai', 'Lào Cai', 'Ngọt, hương hoa', 'Trà xanh cao cấp vùng núi', 'gói', 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000001');

INSERT INTO Products (Id, CategoryId, Name, Origin, FlavorProfile, Description, BaseUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000002', 9101, 'Trà Lài Thái Nguyên', 'Thái Nguyên', 'Thơm lài', 'Trà xanh ướp hoa nhài', 'gói', 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000002');

INSERT INTO Products (Id, CategoryId, Name, Origin, FlavorProfile, Description, BaseUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000003', 9101, 'Trà Búp Lộng Xuân', 'Bảo Lộc', 'Thanh mát', 'Búp non đầu vụ', 'gói', 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000003');

INSERT INTO Products (Id, CategoryId, Name, Origin, FlavorProfile, Description, BaseUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000004', 9102, 'Trà Đen Cổ Thụ Yunnan', 'Vân Nam', 'Đậm, ngọt hậu', 'Trà đen lên men', 'gói', 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000004');

INSERT INTO Products (Id, CategoryId, Name, Origin, FlavorProfile, Description, BaseUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000005', 9102, 'Hồng Trà Đài Loan', 'Đài Loan', 'Ngọt, hoa quả', 'Oolong nhẹ', 'gói', 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000005');

INSERT INTO Products (Id, CategoryId, Name, Origin, FlavorProfile, Description, BaseUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000006', 9103, 'Trà Atiso Đà Lạt', 'Lâm Đồng', 'Đắng nhẹ', 'Hỗ trợ tiêu hoá', 'gói', 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000006');

INSERT INTO Products (Id, CategoryId, Name, Origin, FlavorProfile, Description, BaseUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000007', 9103, 'Trà Hoa Cúc', 'Hà Nội', 'Hương hoa', 'Trà hoa khô', 'gói', 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000007');

INSERT INTO Products (Id, CategoryId, Name, Origin, FlavorProfile, Description, BaseUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000008', 9103, 'Trà Gừng Mật Ong', 'Việt Nam', 'Ấm, cay nhẹ', 'Thảo mộc gia truyền', 'gói', 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000008');

INSERT INTO Products (Id, CategoryId, Name, Origin, FlavorProfile, Description, BaseUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000009', 9104, 'Combo Tết An Khang', 'Việt Nam', 'Đa dạng', '3 loại trà + hộp quà', 'set', 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000009');

INSERT INTO Products (Id, CategoryId, Name, Origin, FlavorProfile, Description, BaseUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000010', 9104, 'Combo Trà Chiều', 'Việt Nam', 'Nhẹ nhàng', 'Trà + bánh kẹo', 'set', 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000010');

INSERT INTO Products (Id, CategoryId, Name, Origin, FlavorProfile, Description, BaseUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000011', 9105, 'Ấm sứ trắng 150ml', 'Bát Tràng', NULL, 'Ấm pha trà mini', 'cái', 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000011');

INSERT INTO Products (Id, CategoryId, Name, Origin, FlavorProfile, Description, BaseUnit, IsVariantParent, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'aaaaaaaa-0001-4000-8000-000000000012', 9105, 'Bộ ly sứ 6 chiếc', 'Bát Tràng', NULL, 'Ly uống trà cổ điển', 'bộ', 0, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000012');

-- SKUs (15) — giá VNĐ
INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'SKU-DEMO-001', '8930000000001', 'Túi 100g', 100, 180000, 120000, 180000, 5, 200, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-001');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000002', 'aaaaaaaa-0001-4000-8000-000000000001', 'SKU-DEMO-002', '8930000000002', 'Túi 250g', 250, 420000, 280000, 420000, 5, 100, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-002');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000003', 'aaaaaaaa-0001-4000-8000-000000000002', 'SKU-DEMO-003', '8930000000003', 'Túi 100g', 100, 95000, 60000, 95000, 10, 300, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-003');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000004', 'aaaaaaaa-0001-4000-8000-000000000003', 'SKU-DEMO-004', '8930000000004', 'Túi 100g', 100, 150000, 95000, 150000, 5, 150, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-004');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000005', 'aaaaaaaa-0001-4000-8000-000000000004', 'SKU-DEMO-005', '8930000000005', 'Túi 100g', 100, 220000, 140000, 220000, 5, 120, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-005');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000006', 'aaaaaaaa-0001-4000-8000-000000000005', 'SKU-DEMO-006', '8930000000006', 'Túi 75g', 75, 280000, 180000, 280000, 3, 80, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-006');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000007', 'aaaaaaaa-0001-4000-8000-000000000006', 'SKU-DEMO-007', '8930000000007', 'Túi 50g', 50, 65000, 40000, 65000, 10, 250, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-007');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000008', 'aaaaaaaa-0001-4000-8000-000000000007', 'SKU-DEMO-008', '8930000000008', 'Túi 30g', 30, 45000, 25000, 45000, 10, 300, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-008');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000009', 'aaaaaaaa-0001-4000-8000-000000000008', 'SKU-DEMO-009', '8930000000009', 'Túi 80g', 80, 55000, 35000, 55000, 10, 200, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-009');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000010', 'aaaaaaaa-0001-4000-8000-000000000009', 'SKU-DEMO-010', '8930000000010', 'Hộp quà', 500, 890000, 550000, 890000, 2, 50, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-010');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000011', 'aaaaaaaa-0001-4000-8000-000000000010', 'SKU-DEMO-011', '8930000000011', 'Hộp quà', 400, 520000, 320000, 520000, 3, 60, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-011');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000012', 'aaaaaaaa-0001-4000-8000-000000000011', 'SKU-DEMO-012', '8930000000012', 'Cái', 200, 180000, 90000, 180000, 5, 40, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-012');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000013', 'aaaaaaaa-0001-4000-8000-000000000012', 'SKU-DEMO-013', '8930000000013', 'Bộ', 800, 350000, 200000, 350000, 3, 30, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-013');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000014', 'aaaaaaaa-0001-4000-8000-000000000002', 'SKU-DEMO-014', '8930000000014', 'Túi 500g', 500, 420000, 260000, 420000, 3, 80, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-014');

INSERT INTO ProductSKUs (Id, ProductId, SkuCode, Barcode, PackagingType, WeightInGrams, BasePrice, CostPrice, RetailPrice, MinStock, MaxStock, IsActive, IsSellable, AllowRewardPoints, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'bbbbbbbb-0001-4000-8000-000000000015', 'aaaaaaaa-0001-4000-8000-000000000004', 'SKU-DEMO-015', '8930000000015', 'Túi 250g', 250, 480000, 300000, 480000, 3, 60, 1, 1, 1, @NOW, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM ProductSKUs WHERE SkuCode = 'SKU-DEMO-015');

-- -----------------------------------------------------------------------------
-- CUSTOMER DB — Khách hàng + địa chỉ
-- -----------------------------------------------------------------------------
USE `hvt_customer_db`;

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TierId, TotalSpending, CurrentDebt, AssignedSaleId, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000001', 'KH-DEMO-001', 'Nguyễn Thị Lan', '0901000001', 'lan.nguyen@demo.vn', 'PhoThong', @TIER_MEMBER, 2500000, 0, @SALE_USER_ID, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-001');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TierId, TotalSpending, CurrentDebt, AssignedSaleId, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000002', 'KH-DEMO-002', 'Trần Văn Minh', '0901000002', 'minh.tran@demo.vn', 'PhoThong', @TIER_SILVER, 8200000, 150000, @SALE_USER_ID, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-002');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TierId, TotalSpending, CurrentDebt, AssignedSaleId, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000003', 'KH-DEMO-003', 'Lê Hoàng Anh', '0901000003', 'anh.le@demo.vn', 'DoanhNghiep', @TIER_GOLD, 28500000, 0, @SALE_USER_ID, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-003');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TierId, TotalSpending, CurrentDebt, AssignedSaleId, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000004', 'KH-DEMO-004', 'Phạm Thu Hà', '0901000004', NULL, 'PhoThong', @TIER_MEMBER, 450000, 0, @SALE_USER_ID, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-004');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TierId, TotalSpending, CurrentDebt, AssignedSaleId, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000005', 'KH-DEMO-005', 'Hoàng Quốc Bảo', '0901000005', 'bao.hoang@demo.vn', 'DoiNgoai', @TIER_SILVER, 6100000, 320000, @SALE_USER_ID, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-005');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TierId, TotalSpending, CurrentDebt, AssignedSaleId, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000006', 'KH-DEMO-006', 'Vũ Thị Mai', '0901000006', NULL, 'PhoThong', @TIER_MEMBER, 0, 0, @SALE_USER_ID, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-006');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TierId, TotalSpending, CurrentDebt, AssignedSaleId, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000007', 'KH-DEMO-007', 'Đỗ Văn Kiên', '0901000007', 'kien.do@demo.vn', 'PhoThong', @TIER_MEMBER, 1200000, 0, @SALE_USER_ID, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-007');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TierId, TotalSpending, CurrentDebt, AssignedSaleId, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000008', 'KH-DEMO-008', 'Bùi Thanh Tâm', '0901000008', NULL, 'PhoThong', @TIER_SILVER, 9800000, 0, @SALE_USER_ID, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-008');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TierId, TotalSpending, CurrentDebt, AssignedSaleId, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000009', 'KH-DEMO-009', 'Ngô Gia Huy', '0901000009', 'huy.ngo@demo.vn', 'DoanhNghiep', @TIER_GOLD, 41000000, 0, @SALE_USER_ID, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-009');

INSERT INTO Customers (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TierId, TotalSpending, CurrentDebt, AssignedSaleId, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000010', 'KH-DEMO-010', 'Lý Phương Chi', '0901000010', NULL, 'PhoThong', @TIER_MEMBER, 780000, 85000, @SALE_USER_ID, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-DEMO-010');

-- Địa chỉ giao (COD / trả hàng)
INSERT INTO CustomerAddresses (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000001', 'cccccccc-0001-4000-8000-000000000002', 'Trần Văn Minh', '0901000002', '12 Nguyễn Huệ', 'Bến Nghé', 'Quận 1', 'TP.HCM', 1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000001');

INSERT INTO CustomerAddresses (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000002', 'cccccccc-0001-4000-8000-000000000005', 'Hoàng Quốc Bảo', '0901000005', '88 Lê Văn Lương', 'Nhân Chính', 'Thanh Xuân', 'Hà Nội', 1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000002');

INSERT INTO CustomerAddresses (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000003', 'cccccccc-0001-4000-8000-000000000007', 'Đỗ Văn Kiên', '0901000007', '45 Trần Phú', 'Hải Châu', 'Hải Châu', 'Đà Nẵng', 1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000003');

INSERT INTO CustomerAddresses (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000004', 'cccccccc-0001-4000-8000-000000000009', 'Ngô Gia Huy', '0901000009', '200 Cách Mạng Tháng 8', 'Phường 10', 'Quận 3', 'TP.HCM', 1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000004');

-- -----------------------------------------------------------------------------
-- INVENTORY DB — Tồn kho quầy + kho
-- -----------------------------------------------------------------------------
USE `hvt_inventory_db`;

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000001', 'SKU-DEMO-001', 100, 45, 120, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000001');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000002', 'SKU-DEMO-002', 250, 18, 60, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000002');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000003', 'SKU-DEMO-003', 100, 80, 200, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000003');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000004', 'SKU-DEMO-004', 100, 35, 90, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000004');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000005', 'SKU-DEMO-005', 100, 22, 55, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000005');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000006', 'SKU-DEMO-006', 75, 15, 40, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000006');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000007', 'SKU-DEMO-007', 50, 60, 150, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000007');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000008', 'SKU-DEMO-008', 30, 90, 220, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000008');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000009', 'SKU-DEMO-009', 80, 55, 130, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000009');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000010', 'SKU-DEMO-010', 500, 8, 25, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000010');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000011', 'SKU-DEMO-011', 400, 12, 30, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000011');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000012', 'SKU-DEMO-012', 200, 10, 35, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000012');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000013', 'SKU-DEMO-013', 800, 6, 18, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000013');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000014', 'SKU-DEMO-014', 500, 14, 40, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000014');

INSERT INTO SkuStocks (SkuId, SkuCode, WeightInGrams, QuantityOnHand, WarehouseQuantityOnHand, CreatedAt, UpdatedAt)
SELECT 'bbbbbbbb-0001-4000-8000-000000000015', 'SKU-DEMO-015', 250, 9, 28, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM SkuStocks WHERE SkuId = 'bbbbbbbb-0001-4000-8000-000000000015');

-- -----------------------------------------------------------------------------
-- ORDER DB — Khuyến mãi + đơn hàng + phiếu trả
-- -----------------------------------------------------------------------------
USE `hvt_order_db`;

INSERT INTO Promotions (Id, PromoCode, NormalizedPromoCode, DiscountType, DiscountValue, MaxDiscountAmount, MinimumOrderAmount, ScopeType, UsageLimitTotal, UsageLimitPerCustomer, ValidFromUtc, ValidToUtc, IsActive, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'eeeeeeee-0001-4000-8000-000000000001', 'DEMO10', 'DEMO10', 'PERCENTAGE', 10, 100000, 300000, 'ORDER', 100, 3, '2026-01-01 00:00:00.000000', '2026-12-31 23:59:59.000000', 1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Promotions WHERE PromoCode = 'DEMO10');

INSERT INTO Promotions (Id, PromoCode, NormalizedPromoCode, DiscountType, DiscountValue, MaxDiscountAmount, MinimumOrderAmount, ScopeType, UsageLimitTotal, UsageLimitPerCustomer, ValidFromUtc, ValidToUtc, IsActive, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'eeeeeeee-0001-4000-8000-000000000002', 'DEMO50K', 'DEMO50K', 'FIXED', 50000, NULL, 500000, 'ORDER', 50, 1, '2026-01-01 00:00:00.000000', '2026-12-31 23:59:59.000000', 1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Promotions WHERE PromoCode = 'DEMO50K');

-- 1) POS hoàn tất — tiền mặt
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000001', 'HVT-DEMO-001', 'Sale', 'cccccccc-0001-4000-8000-000000000001', 'Nguyễn Thị Lan', @SALE_USER_ID, 'POS', 'Completed', 'Synced', 275000, 0, NULL, NULL, 0, 275000, NULL, 'Khách mua tại quầy', DATE_SUB(@NOW, INTERVAL 5 DAY), DATE_SUB(@NOW, INTERVAL 5 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-001');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000001', 'dddddddd-0001-4000-8000-000000000001', 'bbbbbbbb-0001-4000-8000-000000000003', 'Trà Lài Thái Nguyên', 'SKU-DEMO-003', 2, 0, 95000, 190000, DATE_SUB(@NOW, INTERVAL 5 DAY), DATE_SUB(@NOW, INTERVAL 5 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000001');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000002', 'dddddddd-0001-4000-8000-000000000001', 'bbbbbbbb-0001-4000-8000-000000000007', 'Trà Atiso Đà Lạt', 'SKU-DEMO-007', 1, 0, 65000, 65000, DATE_SUB(@NOW, INTERVAL 5 DAY), DATE_SUB(@NOW, INTERVAL 5 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000002');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000001', 'dddddddd-0001-4000-8000-000000000001', 'Cash', 275000, 'Success', NULL, 0, DATE_SUB(@NOW, INTERVAL 5 DAY), DATE_SUB(@NOW, INTERVAL 5 DAY), DATE_SUB(@NOW, INTERVAL 5 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000001');

-- 2) POS hoàn tất — có mã DEMO10
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000002', 'HVT-DEMO-002', 'Sale', 'cccccccc-0001-4000-8000-000000000003', 'Lê Hoàng Anh', @SALE_USER_ID, 'POS', 'Completed', 'Synced', 890000, 89000, 'eeeeeeee-0001-4000-8000-000000000001', 'DEMO10', 89000, 801000, NULL, 'Mua combo Tết', DATE_SUB(@NOW, INTERVAL 4 DAY), DATE_SUB(@NOW, INTERVAL 4 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-002');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000003', 'dddddddd-0001-4000-8000-000000000002', 'bbbbbbbb-0001-4000-8000-000000000010', 'Combo Tết An Khang', 'SKU-DEMO-010', 1, 0, 890000, 890000, DATE_SUB(@NOW, INTERVAL 4 DAY), DATE_SUB(@NOW, INTERVAL 4 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000003');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000002', 'dddddddd-0001-4000-8000-000000000002', 'Cash', 801000, 'Success', NULL, 0, DATE_SUB(@NOW, INTERVAL 4 DAY), DATE_SUB(@NOW, INTERVAL 4 DAY), DATE_SUB(@NOW, INTERVAL 4 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000002');

-- 3) COD đang giao — chưa thu COD
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000003', 'HVT-DEMO-003', 'Sale', 'cccccccc-0001-4000-8000-000000000002', 'Trần Văn Minh', @SALE_USER_ID, 'COD', 'Shipping', 'PendingDeduction', 580000, 0, NULL, NULL, 0, 580000, '12 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM', 'Giao chiều', DATE_SUB(@NOW, INTERVAL 2 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-003');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000004', 'dddddddd-0001-4000-8000-000000000003', 'bbbbbbbb-0001-4000-8000-000000000001', 'Trà Shan Tuyết Lào Cai', 'SKU-DEMO-001', 2, 0, 180000, 360000, DATE_SUB(@NOW, INTERVAL 2 DAY), DATE_SUB(@NOW, INTERVAL 2 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000004');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000005', 'dddddddd-0001-4000-8000-000000000003', 'bbbbbbbb-0001-4000-8000-000000000005', 'Trà Đen Cổ Thụ Yunnan', 'SKU-DEMO-005', 1, 0, 220000, 220000, DATE_SUB(@NOW, INTERVAL 2 DAY), DATE_SUB(@NOW, INTERVAL 2 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000005');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, CodWarningDate, PaidAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000003', 'dddddddd-0001-4000-8000-000000000003', 'COD', 580000, 'Pending', NULL, 0, DATE_ADD(@NOW, INTERVAL 5 DAY), NULL, DATE_SUB(@NOW, INTERVAL 2 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000003');

-- 4) COD hoàn tất — đã xác nhận thu (dùng để test trả hàng)
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000004', 'HVT-DEMO-004', 'Sale', 'cccccccc-0001-4000-8000-000000000005', 'Hoàng Quốc Bảo', @SALE_USER_ID, 'COD', 'Completed', 'Synced', 420000, 0, NULL, NULL, 0, 420000, '88 Lê Văn Lương, Nhân Chính, Thanh Xuân, Hà Nội', 'Ship GHTK', DATE_SUB(@NOW, INTERVAL 7 DAY), DATE_SUB(@NOW, INTERVAL 6 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-004');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000006', 'dddddddd-0001-4000-8000-000000000004', 'bbbbbbbb-0001-4000-8000-000000000002', 'Trà Shan Tuyết Lào Cai', 'SKU-DEMO-002', 1, 0, 420000, 420000, DATE_SUB(@NOW, INTERVAL 7 DAY), DATE_SUB(@NOW, INTERVAL 7 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000006');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, CodWarningDate, PaidAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000004', 'dddddddd-0001-4000-8000-000000000004', 'COD', 420000, 'Success', NULL, 1, DATE_SUB(@NOW, INTERVAL 6 DAY), DATE_SUB(@NOW, INTERVAL 6 DAY), DATE_SUB(@NOW, INTERVAL 7 DAY), DATE_SUB(@NOW, INTERVAL 6 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000004');

-- 5) COD chờ thanh toán
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000005', 'HVT-DEMO-005', 'Sale', 'cccccccc-0001-4000-8000-000000000007', 'Đỗ Văn Kiên', @SALE_USER_ID, 'COD', 'PendingPayment', 'PendingDeduction', 350000, 0, NULL, NULL, 0, 350000, '45 Trần Phú, Hải Châu, Đà Nẵng', NULL, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-005');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000007', 'dddddddd-0001-4000-8000-000000000005', 'bbbbbbbb-0001-4000-8000-000000000013', 'Bộ ly sứ 6 chiếc', 'SKU-DEMO-013', 1, 0, 350000, 350000, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000007');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, CodWarningDate, PaidAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000005', 'dddddddd-0001-4000-8000-000000000005', 'COD', 350000, 'Pending', NULL, 0, DATE_ADD(@NOW, INTERVAL 7 DAY), NULL, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000005');

-- 6) POS ghi nợ một phần
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000006', 'HVT-DEMO-006', 'Sale', 'cccccccc-0001-4000-8000-000000000010', 'Lý Phương Chi', @SALE_USER_ID, 'POS', 'Completed', 'Synced', 565000, 0, NULL, NULL, 0, 565000, NULL, 'Trả trước 200k', DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-006');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000008', 'dddddddd-0001-4000-8000-000000000006', 'bbbbbbbb-0001-4000-8000-000000000011', 'Combo Trà Chiều', 'SKU-DEMO-011', 1, 0, 520000, 520000, DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000008');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000009', 'dddddddd-0001-4000-8000-000000000006', 'bbbbbbbb-0001-4000-8000-000000000008', 'Trà Hoa Cúc', 'SKU-DEMO-008', 1, 0, 45000, 45000, DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000009');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000006', 'dddddddd-0001-4000-8000-000000000006', 'Cash', 200000, 'Success', NULL, 0, DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), DATE_SUB(@NOW, INTERVAL 3 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000006');

-- 7) Đơn đổi (Exchange)
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000007', 'HVT-DEMO-DOI-001', 'Exchange', 'cccccccc-0001-4000-8000-000000000004', 'Phạm Thu Hà', @SALE_USER_ID, 'POS', 'Completed', 'Synced', 150000, 95000, NULL, NULL, 0, 55000, NULL, 'Đổi hàng từ HVT-DEMO-001 (TH-DEMO-001)', DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-DOI-001');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000010', 'dddddddd-0001-4000-8000-000000000007', 'bbbbbbbb-0001-4000-8000-000000000004', 'Trà Búp Lộng Xuân', 'SKU-DEMO-004', 1, 0, 150000, 150000, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000010');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, PaidAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000007', 'dddddddd-0001-4000-8000-000000000007', 'Cash', 55000, 'Success', NULL, 0, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000007');

-- Phiếu trả hàng (từ đơn POS HVT-DEMO-001 — đã trả 1 SP, còn 1 SP)
INSERT INTO ReturnOrders (Id, ReturnCode, SourceOrderId, SourceOrderCode, CustomerId, CustomerSnapshotName, ReturnAmount, ExchangeAmount, NetCustomerPays, RefundAmount, CustomerPaidAmount, RefundMethod, ExchangeOrderId, Note, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'ffffffff-0001-4000-8000-000000000001', 'TH-DEMO-001', 'dddddddd-0001-4000-8000-000000000001', 'HVT-DEMO-001', 'cccccccc-0001-4000-8000-000000000001', 'Nguyễn Thị Lan', 95000, 150000, 55000, 0, 55000, 'Cash', 'dddddddd-0001-4000-8000-000000000007', 'Đổi sang trà Búp Lộng Xuân', DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM ReturnOrders WHERE ReturnCode = 'TH-DEMO-001');

INSERT INTO ReturnOrderDetails (Id, ReturnOrderId, SourceOrderDetailId, SkuId, SkuSnapshotName, SkuSnapshotCode, ReturnQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '44444444-0001-4000-8000-000000000001', 'ffffffff-0001-4000-8000-000000000001', '22222222-0001-4000-8000-000000000001', 'bbbbbbbb-0001-4000-8000-000000000003', 'Trà Lài Thái Nguyên', 'SKU-DEMO-003', 1, 95000, 95000, DATE_SUB(@NOW, INTERVAL 1 DAY), DATE_SUB(@NOW, INTERVAL 1 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM ReturnOrderDetails WHERE Id = '44444444-0001-4000-8000-000000000001');

-- Cập nhật ReturnedQuantity trên đơn gốc (nếu seed lần đầu)
UPDATE OrderDetails
SET ReturnedQuantity = 1, UpdatedAt = @NOW
WHERE Id = '22222222-0001-4000-8000-000000000001'
  AND ReturnedQuantity = 0;

-- 8) COD hoàn tất lớn — doanh nghiệp
INSERT INTO Orders (Id, OrderCode, OrderKind, CustomerId, CustomerSnapshotName, EmployeeId, OrderChannel, OrderStatus, InventorySyncStatus, TotalAmount, DiscountAmount, PromotionId, PromotionCode, PromotionDiscountAmount, FinalAmount, ShippingAddress, Note, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'dddddddd-0001-4000-8000-000000000008', 'HVT-DEMO-008', 'Sale', 'cccccccc-0001-4000-8000-000000000009', 'Ngô Gia Huy', @SALE_USER_ID, 'COD', 'Completed', 'Synced', 1780000, 50000, 'eeeeeeee-0001-4000-8000-000000000002', 'DEMO50K', 50000, 1730000, '200 Cách Mạng Tháng 8, Quận 3, TP.HCM', 'Đơn sỉ', DATE_SUB(@NOW, INTERVAL 10 DAY), DATE_SUB(@NOW, INTERVAL 9 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Orders WHERE OrderCode = 'HVT-DEMO-008');

INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)
SELECT '22222222-0001-4000-8000-000000000011', 'dddddddd-0001-4000-8000-000000000008', 'bbbbbbbb-0001-4000-8000-000000000010', 'Combo Tết An Khang', 'SKU-DEMO-010', 2, 0, 890000, 1780000, DATE_SUB(@NOW, INTERVAL 10 DAY), DATE_SUB(@NOW, INTERVAL 10 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM OrderDetails WHERE Id = '22222222-0001-4000-8000-000000000011');

INSERT INTO Payments (Id, OrderId, PaymentMethod, Amount, PaymentStatus, TransactionRef, IsCodVerified, CodWarningDate, PaidAt, CreatedAt, UpdatedAt, IsDeleted)
SELECT '33333333-0001-4000-8000-000000000008', 'dddddddd-0001-4000-8000-000000000008', 'COD', 1730000, 'Success', NULL, 1, DATE_SUB(@NOW, INTERVAL 9 DAY), DATE_SUB(@NOW, INTERVAL 9 DAY), DATE_SUB(@NOW, INTERVAL 10 DAY), DATE_SUB(@NOW, INTERVAL 9 DAY), 0
WHERE NOT EXISTS (SELECT 1 FROM Payments WHERE Id = '33333333-0001-4000-8000-000000000008');

-- Hoạt động đơn hàng (mẫu)
INSERT INTO OrderActivities (Id, OrderId, ActivityType, Description, ActorId, ActorName, CreatedAt)
SELECT '55555555-0001-4000-8000-000000000001', 'dddddddd-0001-4000-8000-000000000004', 'Completed', 'Đơn HVT-DEMO-004 hoàn tất — đã xác nhận thu COD.', @SALE_USER_ID, 'sale01', DATE_SUB(@NOW, INTERVAL 6 DAY)
WHERE NOT EXISTS (SELECT 1 FROM OrderActivities WHERE Id = '55555555-0001-4000-8000-000000000001');

INSERT INTO OrderActivities (Id, OrderId, ActivityType, Description, ActorId, ActorName, CreatedAt)
SELECT '55555555-0001-4000-8000-000000000002', 'dddddddd-0001-4000-8000-000000000001', 'Returned', 'Tra hang TH-DEMO-001: doi/mua them, khach tra them 55.000 d.', @SALE_USER_ID, 'sale01', DATE_SUB(@NOW, INTERVAL 1 DAY)
WHERE NOT EXISTS (SELECT 1 FROM OrderActivities WHERE Id = '55555555-0001-4000-8000-000000000002');

-- -----------------------------------------------------------------------------
-- SYNC — sửa tên + snapshot (chạy mỗi lần, kể cả data đã seed trước đó)
-- -----------------------------------------------------------------------------
USE `hvt_customer_db`;

UPDATE Customers SET FullName = 'Nguyen Thi Lan',    UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-001';
UPDATE Customers SET FullName = 'Tran Van Minh',     UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-002';
UPDATE Customers SET FullName = 'Le Hoang Anh',        UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-003';
UPDATE Customers SET FullName = 'Pham Thu Ha',         UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-004';
UPDATE Customers SET FullName = 'Hoang Quoc Bao',      UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-005';
UPDATE Customers SET FullName = 'Vu Thi Mai',          UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-006';
UPDATE Customers SET FullName = 'Do Van Kien',         UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-007';
UPDATE Customers SET FullName = 'Bui Thanh Tam',       UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-008';
UPDATE Customers SET FullName = 'Ngo Gia Huy',         UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-009';
UPDATE Customers SET FullName = 'Ly Phuong Chi',       UpdatedAt = @NOW WHERE CustomerCode = 'KH-DEMO-010';

UPDATE CustomerAddresses SET ReceiverName = 'Tran Van Minh',  UpdatedAt = @NOW WHERE Id = '11111111-0001-4000-8000-000000000001';
UPDATE CustomerAddresses SET ReceiverName = 'Hoang Quoc Bao',   UpdatedAt = @NOW WHERE Id = '11111111-0001-4000-8000-000000000002';
UPDATE CustomerAddresses SET ReceiverName = 'Do Van Kien',      UpdatedAt = @NOW WHERE Id = '11111111-0001-4000-8000-000000000003';
UPDATE CustomerAddresses SET ReceiverName = 'Ngo Gia Huy',      UpdatedAt = @NOW WHERE Id = '11111111-0001-4000-8000-000000000004';

USE `hvt_product_db`;

UPDATE Categories SET Name = 'Tra', Description = 'Cac loai tra ban le', ParentId = NULL, UpdatedAt = @NOW WHERE Id = 9001;
UPDATE Categories SET Name = 'Qua tang', Description = 'Combo, hop qua', ParentId = NULL, UpdatedAt = @NOW WHERE Id = 9002;
UPDATE Categories SET Name = 'Dung cu pha tra', Description = 'Am, ly, phu kien', ParentId = NULL, UpdatedAt = @NOW WHERE Id = 9003;

UPDATE Categories SET Name = 'Tra xanh', Description = 'Tra xanh cac vung mien', ParentId = 9001, UpdatedAt = @NOW WHERE Id = 9101;
UPDATE Categories SET Name = 'Tra den & Oolong', Description = 'Tra den, hong tra, oolong', ParentId = 9001, UpdatedAt = @NOW WHERE Id = 9102;
UPDATE Categories SET Name = 'Tra thao duoc', Description = 'Hoa qua, thao moc', ParentId = 9001, UpdatedAt = @NOW WHERE Id = 9103;
UPDATE Categories SET Name = 'Combo qua tang', Description = 'Hop qua, set combo', ParentId = 9002, UpdatedAt = @NOW WHERE Id = 9104;
UPDATE Categories SET Name = 'Am & ly', Description = 'Am tra, bo ly su', ParentId = 9003, UpdatedAt = @NOW WHERE Id = 9105;

UPDATE Products SET Name = 'Tra Shan Tuyet Lao Cai' WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000001';
UPDATE Products SET Name = 'Tra Lai Thai Nguyen' WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000002';
UPDATE Products SET Name = 'Tra Bup Long Xuan' WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000003';
UPDATE Products SET Name = 'Tra Den Co Thu Yunnan' WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000004';
UPDATE Products SET Name = 'Hong Tra Dai Loan' WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000005';
UPDATE Products SET Name = 'Tra Atiso Da Lat' WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000006';
UPDATE Products SET Name = 'Tra Hoa Cuc' WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000007';
UPDATE Products SET Name = 'Tra Gung Mat Ong' WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000008';
UPDATE Products SET Name = 'Combo Tet An Khang' WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000009';
UPDATE Products SET Name = 'Combo Tra Chieu' WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000010';
UPDATE Products SET Name = 'Am su trang 150ml' WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000011';
UPDATE Products SET Name = 'Bo ly su 6 chiec' WHERE Id = 'aaaaaaaa-0001-4000-8000-000000000012';

USE `hvt_order_db`;

UPDATE Orders o
INNER JOIN hvt_customer_db.Customers c ON c.Id = o.CustomerId
SET o.CustomerSnapshotName = CONCAT(c.FullName, @SNAP_SEP, c.CustomerCode),
    o.UpdatedAt = @NOW
WHERE o.OrderCode LIKE 'HVT-DEMO-%'
  AND c.CustomerCode LIKE 'KH-DEMO-%';

UPDATE ReturnOrders r
INNER JOIN hvt_customer_db.Customers c ON c.Id = r.CustomerId
SET r.CustomerSnapshotName = CONCAT(c.FullName, @SNAP_SEP, c.CustomerCode),
    r.UpdatedAt = @NOW
WHERE r.ReturnCode LIKE 'TH-DEMO-%'
  AND c.CustomerCode LIKE 'KH-DEMO-%';

UPDATE OrderDetails d
INNER JOIN hvt_product_db.Products p ON p.Id = (
  SELECT s.ProductId FROM hvt_product_db.ProductSKUs s WHERE s.SkuCode = d.SkuSnapshotCode LIMIT 1
)
SET d.SkuSnapshotName = p.Name,
    d.UpdatedAt = @NOW
WHERE d.SkuSnapshotCode LIKE 'SKU-DEMO-%';

UPDATE ReturnOrderDetails d
INNER JOIN hvt_product_db.Products p ON p.Id = (
  SELECT s.ProductId FROM hvt_product_db.ProductSKUs s WHERE s.SkuCode = d.SkuSnapshotCode LIMIT 1
)
SET d.SkuSnapshotName = p.Name,
    d.UpdatedAt = @NOW
WHERE d.SkuSnapshotCode LIKE 'SKU-DEMO-%';

SELECT 'Seed demo data completed.' AS Result;
