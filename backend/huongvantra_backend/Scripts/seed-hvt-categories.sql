-- =============================================================================
-- Hương Vân Trà — bootstrap danh mục trước khi import catalog bằng Excel.
-- Không tạo Product/SKU; có thể chạy lại an toàn.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET @NOW = UTC_TIMESTAMP(6);

USE `hvt_product_db`;

INSERT INTO Categories
  (Id, Name, Description, ParentId, IsActive, SyncedToStoreAt, CreatedAt, UpdatedAt, IsDeleted)
VALUES
  (9201, 'Trà xanh Tân Cương Thái Nguyên', 'Các dòng trà Hương Vân bán lẻ', NULL, 1, @NOW, @NOW, @NOW, 0),
  (9202, 'Set Quà Cao Cấp', 'Hộp và set quà trà cao cấp', NULL, 1, @NOW, @NOW, @NOW, 0),
  (9203, 'Kẹo Trà', 'Kẹo trà, chè lam và đặc sản từ trà', NULL, 1, @NOW, @NOW, @NOW, 0),
  (9204, 'Dụng Cụ Trà', 'Tống trà, xúc trà và phụ kiện thưởng trà', NULL, 1, @NOW, @NOW, @NOW, 0),
  (9205, 'Hoa Trà Sáng Tạo', 'Sản phẩm hoa trà nghệ thuật', NULL, 1, @NOW, @NOW, @NOW, 0),
  (9206, 'Nguyên liệu sản xuất', 'Nguyên liệu nội bộ, không bán trực tiếp', NULL, 1, NULL, @NOW, @NOW, 0),
  (9207, 'Trà nguyên liệu', 'Trà thô và hoa ướp dùng sản xuất', 9206, 1, NULL, @NOW, @NOW, 0),
  (9208, 'Bao bì sản xuất', 'Hộp, túi, hũ và tem dùng đóng gói', NULL, 1, NULL, @NOW, @NOW, 0)
ON DUPLICATE KEY UPDATE
  Name = VALUES(Name),
  Description = VALUES(Description),
  ParentId = VALUES(ParentId),
  IsActive = 1,
  SyncedToStoreAt = VALUES(SyncedToStoreAt),
  UpdatedAt = @NOW,
  IsDeleted = 0;
