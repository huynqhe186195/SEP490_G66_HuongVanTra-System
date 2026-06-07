-- Khởi tạo databases cho từng Microservice (Database-per-Service)
-- File này chạy tự động khi MySQL container khởi động lần đầu

CREATE DATABASE IF NOT EXISTS `hvt_customer_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Cấp quyền cho user ứng dụng
GRANT ALL PRIVILEGES ON `hvt_customer_db`.* TO 'hvtuser'@'%';

CREATE DATABASE IF NOT EXISTS `hvt_user_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON `hvt_user_db`.* TO 'hvtuser'@'%';

CREATE DATABASE IF NOT EXISTS `hvt_product_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON `hvt_product_db`.* TO 'hvtuser'@'%';

-- Thêm database cho các service sau này
-- CREATE DATABASE IF NOT EXISTS `hvt_order_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

FLUSH PRIVILEGES;
