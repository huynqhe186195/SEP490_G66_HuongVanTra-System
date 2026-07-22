# SEP490 - Hệ thống Quản trị Hương Vân Trà

## Inventory / Warehouse Scope

Current Inventory scope separates `Warehouse` and `Shelf` stock, uses `WarehouseQuantityOnHand` for Kho tong and `QuantityOnHand` for Ke Hang/POS sellable stock, and keeps Product master changes behind approval workflows.

Read the acceptance and UAT guide here:

- `docs/inventory-acceptance-guide.md`

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

  # Nếu muốn build sạch sẽ docker, chạy theo thứ tự sau:

  Bước 1: Dừng và xóa toàn bộ container
  docker compose down

  Bước 2: Xóa tất cả image, cache build, network không dùng
  docker system prune -af

  ▎ Flag -a xóa tất cả image (kể cả image còn tag), -f không hỏi xác nhận.

  Bước 3: Rebuild và chạy lại toàn bộ
  docker compose up -d --build

  ---
  Lưu ý quan trọng: Data trong DB (MySQL, RabbitMQ) vẫn an toàn vì nằm trong volumes. Nếu muốn xóa luôn cả data DB thì thêm flag --volumes vào bước 1:

  docker compose down --volumes  # XÓA LUÔN DATA DB - cẩn thận!
========================================================================================================================================================

  Lần đầu (setup một lần duy nhất)

    # 1. Vào thư mục backend
    cd backend/huongvantra_backend

    # 2. Tạo file .env từ mẫu (nếu có r thì thôi)
    cp .env.example .env

    ---
    Chạy dev — không cần rebuild khi sửa code

    docker compose -f docker-compose.yml -f docker-compose.dev.yml up

    Cơ chế:
    - Frontend (port 5173): Vite dev server, bind mount source → save file là browser tự reload (5173: môi trường dev, 3000: môi trường production)
    - Backend ProductService (port 5003): dotnet watch run, bind mount source → save file .cs là service tự restart (~3-5 giây)
    - MySQL, RabbitMQ, Gateway: chạy bình thường từ docker-compose.yml

    Muốn chạy riêng 1 service:
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up product-service

    ---
    Chạy production — build Docker image đầy đủ

    docker compose up --build

    Dùng khi deploy, hoặc khi cần test image production thật sự.

    ---
    Sau khi pull code mới (đang chạy dev)

    Không cần làm gì thêm — dotnet watch và Vite tự detect thay đổi. Trường hợp duy nhất cần restart thủ công là khi thay đổi appsettings.json hoặc thêm NuGet package mới:

    docker compose -f docker-compose.yml -f docker-compose.dev.yml restart product-service

=========================================================================================================================
    Vì docker-compose.dev.yml dùng 2 cơ chế khác nhau cho production vs dev:

    Production (docker-compose.yml)
    product-service → build Dockerfile → runtime image (aspnet:8.0-alpine, ~120MB)
                      code được compile sẵn vào image
                      sửa code → phải docker build lại

    Dev (docker-compose.dev.yml)
    product-service → SDK image (dotnet/sdk:8.0, ~750MB)
                      bind mount source code vào container
                      dotnet watch run theo dõi file → tự rebuild khi save

    Comment có sẵn trong file giải thích lý do để mặc định là comment:

    ▎ SDK image (~750MB) nặng hơn runtime image — chỉ bật service đang làm việc.

    Tức là thiết kế ban đầu là: mỗi developer chỉ uncomment service mình đang làm để tiết kiệm RAM/CPU. Nếu cả team cùng develop ProductService thì uncomment là đúng.

    Nếu bạn muốn revert lại comment để mỗi người tự quyết định, tôi có thể làm vậy — khi đó hướng dẫn cho team sẽ là:

    # Muốn dev ProductService với hot-reload → mở docker-compose.dev.yml, uncomment phần product-service
    # Chỉ cần infra thì không cần uncomment gì
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up
