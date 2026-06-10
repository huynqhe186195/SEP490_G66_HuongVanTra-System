# SEP490 - Hệ thống Quản trị Hương Vân Trà

## Sau khi `git pull` (cho cả team)

Mỗi máy chỉ cần chạy từ thư mục `backend\huongvantra_backend`:

```powershell
git pull
docker compose up --build -d
```

`mysql-bootstrap` sẽ tự tạo/cấp quyền các database (kể cả `hvt_inventory_db` trên volume MySQL cũ). Các service .NET tự chạy EF migration khi khởi động.

Nếu vẫn lỗi 500 (ví dụ cập nhật số lượng sản phẩm):

```powershell
.\Scripts\sync-after-pull.ps1
```

Hoặc chỉ tạo DB thủ công:

```powershell
.\Scripts\bootstrap-databases.ps1
docker compose restart inventory-service
```

Kiểm tra:

```powershell
docker logs hvt-mysql-bootstrap
docker logs hvt-inventory-service --tail 30
```

Lỗi thường gặp: `Access denied ... hvt_inventory_db` → chưa có database inventory (chạy script trên).

---

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

  # Script SQL đã có hvt_inventory_db và grant đủ quyền. Vấn đề là MySQL volume đã được khởi tạo từ trước — file init.sql chỉ chạy một lần duy nhất khi volume còn mới, nên database hvt_inventory_db và quyền cho hvtuser chưa được tạo trong lần này. (lỗi khi chạy migration)

  Cách fix: chạy thủ công lệnh SQL vào container MySQL đang chạy:

  docker exec -it hvt-mysql mysql -uroot -phvtroot123 -e "
  CREATE DATABASE IF NOT EXISTS \`hvt_inventory_db\`
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  GRANT ALL PRIVILEGES ON \`hvt_inventory_db\`.* TO 'hvtuser'@'%';
  FLUSH PRIVILEGES;
  "

  Sau đó restart inventory-service để nó chạy lại migration:

  docker compose restart inventory-service

  Rồi kiểm tra log:

  docker compose logs -f inventory-service

  Lần này bạn sẽ thấy migration chạy thành công thay vì Access denied.

  ✻ Sautéed for 1m 21s

  ❯ còn cách khác không?

  Có 2 cách khác:

  Cách 1: Xóa volume MySQL và khởi động lại từ đầu
  docker compose down -v
  docker compose up -d
  -v xóa volume → MySQL khởi động lại từ đầu → init.sql chạy lại → tất cả database và quyền được tạo đúng. Nhược điểm: mất toàn bộ data hiện có trong MySQL.

  ---
  Cách 2: Rebuild chỉ MySQL với volume mới
  docker compose down
  docker volume rm huongvantra_backend_mysql_data
  docker compose up -d
  Tương tự cách 1 nhưng xóa volume tường minh hơn. Cũng mất data.

  ---
  Nếu có data quan trọng cần giữ thì dùng lệnh docker exec mình đã đề xuất ở trên — đó là cách an toàn nhất. Còn nếu đây là môi trường dev và data không quan trọng thì cách 1 (down -v + up) tiện nhất.