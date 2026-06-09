-- Chạy mỗi lần docker-compose up để đảm bảo tất cả databases tồn tại
-- (mysql-bootstrap container re-runs this so existing volumes get new DBs too)

CREATE DATABASE IF NOT EXISTS `hvt_customer_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `hvt_customer_db`.* TO 'hvtuser'@'%';

CREATE DATABASE IF NOT EXISTS `hvt_user_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `hvt_user_db`.* TO 'hvtuser'@'%';

CREATE DATABASE IF NOT EXISTS `hvt_product_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `hvt_product_db`.* TO 'hvtuser'@'%';

CREATE DATABASE IF NOT EXISTS `hvt_order_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `hvt_order_db`.* TO 'hvtuser'@'%';

CREATE DATABASE IF NOT EXISTS `hvt_inventory_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `hvt_inventory_db`.* TO 'hvtuser'@'%';

FLUSH PRIVILEGES;
