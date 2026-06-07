# SEP490 - Hệ thống Quản trị Hương Vân Trà

# Hướng dẫn cách build docker 
1. Build lại images (bắt buộc phải rebuild vì đã thay đổi Dockerfile)

  # Đứng tại thư mục gốc backend
  cd D:\FuLearning\SEP\SEP490_G66_HuongVanTra-System\backend\huongvantra_backend

  # Build lại tất cả services, bỏ cache cũ
  docker compose build --no-cache

  ▎ Lần này build sẽ vẫn lâu vì cần pull Alpine base image mới và compile lại từ đầu. Đây là lần cuối cùng mất thời gian
  ▎ như vậy.

  2. Khởi động lại toàn bộ stack

  docker compose up -d

  3. Kiểm tra containers đang chạy

  docker compose ps

  4. Xem log nếu có container bị lỗi

  # Xem log của một service cụ thể
  docker compose logs user-service
  docker compose logs customer-service
  docker compose logs gateway

  ---
  Sau khi build lần đầu xong, quy trình dev hàng ngày sẽ là:

  # Khi thay đổi source code — chỉ rebuild service đó thôi
  docker compose build user-service
  docker compose up -d user-service

  # Hoặc rebuild + restart cùng lúc
  docker compose up -d --build user-service

# Lần tới nếu muốn dọn dẹp định kỳ, bạn có thể dùng:

  # Chỉ xóa build cache (an toàn nhất)
  docker builder prune -f

  # Xóa tất cả: cache + images không dùng + containers stopped
  docker system prune -f

  # Xóa triệt để kể cả volumes (NGUY HIỂM — mất data mysql/rabbitmq)
  docker system prune -f --volumes