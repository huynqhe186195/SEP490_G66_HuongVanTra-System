-- Fake data hợp đồng mua bán hàng hóa để test
-- Chạy trong MySQL container: docker compose exec -e "MYSQL_PWD=$env:MYSQL_ROOT_PASSWORD" mysql mysql -u root hvt_document_db < Scripts/insert-fake-contract.sql

USE hvt_document_db;

-- Xóa data cũ nếu có (để test lại từ đầu)
DELETE FROM ContractLineItems WHERE ContractId = '11111111-1111-1111-1111-111111111111';
DELETE FROM Contracts WHERE Id = '11111111-1111-1111-1111-111111111111';

-- Insert fake Contract
INSERT INTO Contracts (
    Id, ContractCode, CustomerId, CustomerName, CustomerCode,
    CreatedByUserId, Title, ContractType, Status,
    EffectiveDate, ExpiryDate, PaymentTermDays,
    SignedAtLocation, PaymentMethod, DeliveryTerms, ShippingResponsibility,
    Notes, CreatedAt, UpdatedAt, IsDeleted
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'HD-2026-001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -- CustomerId (cần có khách hàng doanh nghiệp thật trong DB)
    'Công ty TNHH Thương mại ABC',
    'KH-DN-001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -- CreatedByUserId (user thật trong hệ thống)
    'Hợp đồng mua bán hàng hóa số 01/2026',
    'Purchase', -- ContractType enum
    'Draft', -- ContractStatus enum: Draft, Submitted, Approved, Rejected
    '2026-08-10', -- EffectiveDate
    '2026-12-31', -- ExpiryDate
    30, -- PaymentTermDays
    'Thành phố Hồ Chí Minh', -- SignedAtLocation
    'Chuyển khoản ngân hàng trong vòng 30 ngày kể từ ngày nhận hàng', -- PaymentMethod
    'Giao hàng tại kho Bên B, địa chỉ: 123 Đường ABC, Quận 1, TP.HCM. Thời gian giao hàng: trong vòng 7 ngày làm việc kể từ ngày ký hợp đồng.', -- DeliveryTerms
    'Bên A chịu chi phí vận chuyển đến kho Bên B', -- ShippingResponsibility
    'Hợp đồng thử nghiệm - Fake data để test chức năng xuất Word/PDF',
    NOW(),
    NOW(),
    0
);

-- Insert fake ContractLineItems (3 dòng hàng mẫu)
-- Lưu ý: SkuId phải là SKU thật có trong ProductService
-- Giả sử có các SKU sau (cần kiểm tra DB thực tế):
-- - SP-KE-HOP-200G: Sản phẩm kệ Hộp 200g
-- - SP-KE-TUI-500G: Sản phẩm kệ Túi 500g
-- - SP-KE-LON-1KG: Sản phẩm kệ Lon 1kg

INSERT INTO ContractLineItems (
    Id, ContractId, LineNumber, SkuId, SkuCode, ProductName, Unit,
    Quantity, UnitPrice, LineAmount, Note
) VALUES
(
    '22222222-2222-2222-2222-222222222221',
    '11111111-1111-1111-1111-111111111111',
    1,
    'cccccccc-cccc-cccc-cccc-cccccccccccc', -- SkuId thật (cần thay bằng GUID thật)
    'SP-KE-HOP-200G',
    'Hương Vân Trà - Hộp 200g',
    'Hộp',
    100.0000,
    85000.00,
    8500000.00,
    'Hàng mới 100%, đóng gói nguyên đai nguyên kiện'
),
(
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    2,
    'dddddddd-dddd-dddd-dddd-dddddddddddd', -- SkuId thật
    'SP-KE-TUI-500G',
    'Hương Vân Trà - Túi 500g',
    'Túi',
    200.0000,
    120000.00,
    24000000.00,
    'Giao hàng theo lô, mỗi lô 50 túi'
),
(
    '22222222-2222-2222-2222-222222222223',
    '11111111-1111-1111-1111-111111111111',
    3,
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', -- SkuId thật
    'SP-KE-LON-1KG',
    'Hương Vân Trà - Lon 1kg',
    'Lon',
    50.0000,
    250000.00,
    12500000.00,
    'Hàng cao cấp, đóng lon chân không'
);

-- Tổng giá trị hợp đồng: 45.000.000 VNĐ (Bốn mươi lăm triệu đồng chẵn)

SELECT 'Fake contract inserted successfully!' AS Result;
SELECT * FROM Contracts WHERE Id = '11111111-1111-1111-1111-111111111111';
SELECT * FROM ContractLineItems WHERE ContractId = '11111111-1111-1111-1111-111111111111' ORDER BY LineNumber;
