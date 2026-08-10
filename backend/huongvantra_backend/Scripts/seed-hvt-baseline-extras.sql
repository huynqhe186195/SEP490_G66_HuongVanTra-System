-- =============================================================================
-- Hương Vân Trà — seed phụ trợ đủ dùng (máy sạch sau reset volume).
-- KHÔNG tạo Product/SKU/Order/Stock demo (tránh lẫn catalog Excel).
-- Chạy SAU khi UserService + CustomerService đã start (có sale01 + tiers).
-- Idempotent.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET @NOW = UTC_TIMESTAMP(6);

SET @SALE_USER_ID = (
  SELECT u.Id FROM hvt_user_db.Users u
  WHERE u.Username = 'sale01' AND u.IsDeleted = 0
  LIMIT 1
);

SET @TIER_MEMBER = (SELECT Id FROM hvt_customer_db.CustomerTiers WHERE TierName = 'Member' AND IsDeleted = 0 LIMIT 1);
SET @TIER_SILVER = (SELECT Id FROM hvt_customer_db.CustomerTiers WHERE TierName = 'Silver' AND IsDeleted = 0 LIMIT 1);
SET @TIER_GOLD   = (SELECT Id FROM hvt_customer_db.CustomerTiers WHERE TierName = 'Gold' AND IsDeleted = 0 LIMIT 1);

-- -----------------------------------------------------------------------------
-- CUSTOMER DB — 5 khách + địa chỉ COD (mỗi khách ≥1 địa chỉ để lập đơn giao)
-- -----------------------------------------------------------------------------
USE `hvt_customer_db`;

INSERT INTO Customers
  (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId,
   TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000001', 'KH-HVT-001', 'Nguyễn Thị Lan', '0901000001',
       'lan.nguyen@hvt.demo', 'PhoThong', NULL, @TIER_MEMBER, 0, 0, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-HVT-001');

INSERT INTO Customers
  (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId,
   TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000002', 'KH-HVT-002', 'Trần Văn Minh', '0901000002',
       'minh.tran@hvt.demo', 'PhoThong', NULL, @TIER_SILVER, 0, 0, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-HVT-002');

INSERT INTO Customers
  (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId,
   TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000003', 'KH-HVT-003', 'Lê Hoàng Anh', '0901000003',
       'anh.le@hvt.demo', 'DoanhNghiep', NULL, @TIER_GOLD, 0, 0, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-HVT-003');

INSERT INTO Customers
  (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId,
   TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000004', 'KH-HVT-004', 'Phạm Thu Hà', '0901000004',
       NULL, 'PhoThong', NULL, @TIER_MEMBER, 0, 0, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-HVT-004');

INSERT INTO Customers
  (Id, CustomerCode, FullName, PhoneNumber, Email, CustomerGroup, TaxCode, TierId,
   TotalSpending, CurrentDebt, AssignedSaleId, Source, Department, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'cccccccc-0001-4000-8000-000000000005', 'KH-HVT-005', 'Hoàng Quốc Bảo', '0901000005',
       'bao.hoang@hvt.demo', 'DoiNgoai', NULL, @TIER_SILVER, 0, 0, @SALE_USER_ID, NULL, NULL, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Customers WHERE CustomerCode = 'KH-HVT-005');

INSERT INTO CustomerAddresses
  (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province,
   IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000001', 'cccccccc-0001-4000-8000-000000000002',
       'Trần Văn Minh', '0901000002', '12 Nguyễn Trãi', 'Thanh Xuân Trung', 'Thanh Xuân', 'Hà Nội',
       1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000001');

INSERT INTO CustomerAddresses
  (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province,
   IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000002', 'cccccccc-0001-4000-8000-000000000005',
       'Hoàng Quốc Bảo', '0901000005', '45 Lê Lợi', 'Bến Nghé', 'Quận 1', 'TP. Hồ Chí Minh',
       1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000002');

INSERT INTO CustomerAddresses
  (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province,
   IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000003', 'cccccccc-0001-4000-8000-000000000001',
       'Nguyễn Thị Lan', '0901000001', '88 Láng Hạ', 'Láng Hạ', 'Đống Đa', 'Hà Nội',
       1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000003');

INSERT INTO CustomerAddresses
  (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province,
   IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000004', 'cccccccc-0001-4000-8000-000000000003',
       'Lê Hoàng Anh', '0901000003', '15 Trần Phú', 'Phường 5', 'Quận 5', 'TP. Hồ Chí Minh',
       1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000004');

INSERT INTO CustomerAddresses
  (Id, CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province,
   IsDefault, CreatedAt, UpdatedAt, IsDeleted)
SELECT '11111111-0001-4000-8000-000000000005', 'cccccccc-0001-4000-8000-000000000004',
       'Phạm Thu Hà', '0901000004', '22 Hoàng Diệu', 'Phường 6', 'Quận 4', 'TP. Hồ Chí Minh',
       1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM CustomerAddresses WHERE Id = '11111111-0001-4000-8000-000000000005');

-- -----------------------------------------------------------------------------
-- INVENTORY DB — 3 nhà cung cấp
-- -----------------------------------------------------------------------------
USE `hvt_inventory_db`;

INSERT INTO Suppliers
  (Id, SupplierCode, NormalizedSupplierCode, Name, Phone, Email, Address, Note,
   IsDeleted, CreatedAt, UpdatedAt)
SELECT 'aaaaaaaa-1001-4000-8000-000000000001', 'NCC-HVT-01', 'NCC-HVT-01',
       'Nông hộ trà Tân Cương', '0912000001', 'tancuong@hvt.demo',
       'Xã Tân Cương, TP. Thái Nguyên', 'Nguồn trà nguyên liệu chính',
       0, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM Suppliers WHERE NormalizedSupplierCode = 'NCC-HVT-01');

INSERT INTO Suppliers
  (Id, SupplierCode, NormalizedSupplierCode, Name, Phone, Email, Address, Note,
   IsDeleted, CreatedAt, UpdatedAt)
SELECT 'aaaaaaaa-1001-4000-8000-000000000002', 'NCC-HVT-02', 'NCC-HVT-02',
       'Công ty Bao bì Minh Phát', '0912000002', 'baobi@hvt.demo',
       'KCN Sóng Thần, Bình Dương', 'Hộp giấy, túi zip, tem nhãn',
       0, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM Suppliers WHERE NormalizedSupplierCode = 'NCC-HVT-02');

INSERT INTO Suppliers
  (Id, SupplierCode, NormalizedSupplierCode, Name, Phone, Email, Address, Note,
   IsDeleted, CreatedAt, UpdatedAt)
SELECT 'aaaaaaaa-1001-4000-8000-000000000003', 'NCC-HVT-03', 'NCC-HVT-03',
       'Xưởng gốm sứ Bát Tràng', '0912000003', NULL,
       'Bát Tràng, Gia Lâm, Hà Nội', 'Hũ sứ, tống trà, dụng cụ',
       0, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM Suppliers WHERE NormalizedSupplierCode = 'NCC-HVT-03');

INSERT INTO Suppliers
  (Id, SupplierCode, NormalizedSupplierCode, Name, Phone, Email, Address, Note,
   IsDeleted, CreatedAt, UpdatedAt)
SELECT 'aaaaaaaa-1001-4000-8000-000000000004', 'NCC-HVT-04', 'NCC-HVT-04',
       'HTX Thủ công dụng cụ trà', '0912000004', 'dungcu@hvt.demo',
       'Thái Nguyên', 'Xúc trà tre/gỗ/đồng — nguyên liệu dụng cụ',
       0, @NOW, @NOW
WHERE NOT EXISTS (SELECT 1 FROM Suppliers WHERE NormalizedSupplierCode = 'NCC-HVT-04');

-- -----------------------------------------------------------------------------
-- ORDER DB — 2 khuyến mãi mẫu
-- -----------------------------------------------------------------------------
USE `hvt_order_db`;

INSERT INTO Promotions
  (Id, PromoCode, NormalizedPromoCode, DiscountType, DiscountValue, MaxDiscountAmount,
   MinimumOrderAmount, ScopeType, UsageLimitTotal, UsageLimitPerCustomer,
   ValidFromUtc, ValidToUtc, IsActive, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'eeeeeeee-0001-4000-8000-000000000001', 'HVT10', 'HVT10', 'PERCENTAGE', 10, 100000,
       300000, 'ORDER', 200, 5, '2026-01-01 00:00:00.000000', '2026-12-31 23:59:59.000000',
       1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Promotions WHERE PromoCode = 'HVT10');

INSERT INTO Promotions
  (Id, PromoCode, NormalizedPromoCode, DiscountType, DiscountValue, MaxDiscountAmount,
   MinimumOrderAmount, ScopeType, UsageLimitTotal, UsageLimitPerCustomer,
   ValidFromUtc, ValidToUtc, IsActive, CreatedAt, UpdatedAt, IsDeleted)
SELECT 'eeeeeeee-0001-4000-8000-000000000002', 'HVT50K', 'HVT50K', 'FIXED', 50000, NULL,
       500000, 'ORDER', 100, 2, '2026-01-01 00:00:00.000000', '2026-12-31 23:59:59.000000',
       1, @NOW, @NOW, 0
WHERE NOT EXISTS (SELECT 1 FROM Promotions WHERE PromoCode = 'HVT50K');
